import type { Labrinth } from '@modrinth/api-client'
import { type Client, type NewsChannel, type TextChannel } from 'discord.js'

import { usesSupporterPerks } from '../../config/supporterPerks.js'
import { MAX_TRACKED, MAX_TRACKED_SUPPORTER, queries } from '../../db/queries.js'
import type { TrackedAuthorWithChannel } from '../../db/schemas/author.js'
import { modrinthClient } from '../api/modrinth.js'
import { buildNewProjectNotification } from '../embeds/index.js'
import { createModuleLogger } from '../logger.js'
import {
	trackingAuthorAutoTrackedTotal,
	trackingAuthorDurationSeconds,
	trackingAuthorNotificationsTotal,
	trackingAuthorTicksTotal,
} from '../metrics.js'
import { isUnreachableChannelError, pauseTrackingForUnreachableChannel } from './shared.js'

const log = createModuleLogger('tracking:author')

type AuthorEntry = {
	authorId: string
	authorType: 'user' | 'organization'
	username: string
	knownProjectIds: Set<string>
	guildIds: string[]
	channels: { guildId: string; channelId: string; roleId?: string | null }[]
}

function groupByAuthor(rows: TrackedAuthorWithChannel[]): Map<string, AuthorEntry> {
	const map = new Map<string, AuthorEntry>()
	for (const row of rows) {
		const key = `${row.authorType}:${row.authorId}`
		const channel = { guildId: row.guildId, channelId: row.channelId, roleId: row.roleId }
		const entry = map.get(key)
		if (entry) {
			entry.guildIds.push(row.guildId)
			entry.channels.push(channel)
		} else {
			map.set(key, {
				authorId: row.authorId,
				authorType: row.authorType as 'user' | 'organization',
				username: row.username,
				knownProjectIds: new Set(row.knownProjectIds),
				guildIds: [row.guildId],
				channels: [channel],
			})
		}
	}
	return map
}

export async function fetchAuthorProjects(
	authorType: 'user' | 'organization',
	authorId: string,
): Promise<Labrinth.Projects.v3.Project[]> {
	if (authorType === 'organization') {
		return modrinthClient.labrinth.organizations_v3.getProjects(authorId)
	}
	return modrinthClient.request<Labrinth.Projects.v3.Project[]>(`/user/${authorId}/projects`, {
		api: 'labrinth',
		version: 3,
		method: 'GET',
	})
}

async function fetchAuthorProfile(
	authorType: 'user' | 'organization',
	authorId: string,
): Promise<{ name: string; avatarUrl?: string } | undefined> {
	try {
		if (authorType === 'organization') {
			const organization = await modrinthClient.labrinth.organizations_v3.get(authorId)
			return { name: organization.name, avatarUrl: organization.icon_url ?? undefined }
		}
		const user = await modrinthClient.labrinth.users_v3.get(authorId)
		return { name: user.username, avatarUrl: user.avatar_url ?? undefined }
	} catch (err) {
		log.warn({ err, authorType, authorId }, 'Failed to fetch author profile')
		return undefined
	}
}

async function notifyAuthorChannels(
	client: Client,
	project: Labrinth.Projects.v3.Project,
	author: { name: string; avatarUrl?: string },
	channels: AuthorEntry['channels'],
): Promise<string[]> {
	const notified: string[] = []
	for (const { guildId, channelId, roleId } of channels) {
		const channel = client.channels.cache.get(channelId) as TextChannel | NewsChannel | undefined
		if (!channel?.isTextBased()) {
			log.warn(
				{ projectId: project.id, guildId, channelId, roleId },
				'Channel not found or not text-based',
			)
			await pauseTrackingForUnreachableChannel(client, guildId, channelId)
			continue
		}

		const mention = roleId ? channel.guild.roles.cache.get(roleId)?.toString() : undefined
		const payload = buildNewProjectNotification(project, author)

		try {
			await channel.send({
				content: mention,
				embeds: payload.embeds,
				components: payload.components,
			})
		} catch (err) {
			if (isUnreachableChannelError(err)) {
				log.warn(
					{ projectId: project.id, guildId, channelId, err },
					'Failed to notify channel, unreachable',
				)
				await pauseTrackingForUnreachableChannel(client, guildId, channelId)
				continue
			}
			throw err
		}
		notified.push(channelId)
	}
	return notified
}

async function autoTrackDiscoveredProject(
	guildId: string,
	project: Labrinth.Projects.v3.Project,
	channelId: string,
	roleId: string | null | undefined,
): Promise<boolean> {
	const existing = await queries.findTrackedProjectById(guildId, project.id)
	if (existing) return false

	const [config, count] = await Promise.all([
		queries.getServerConfig(guildId),
		queries.countTrackedProjects(guildId),
	])
	const hasPerks = !usesSupporterPerks || Boolean(config?.isSupporter)
	const limit = hasPerks ? MAX_TRACKED_SUPPORTER : MAX_TRACKED
	if (count >= limit) {
		log.debug(
			{ guildId, projectId: project.id, count, limit },
			'Skipped auto-tracking project, server at tracking limit',
		)
		return false
	}

	// Only store an explicit per-project override if it differs from the server default,
	// so auto-tracked projects keep following the server default if it changes later.
	const channelOverride = channelId !== (config?.trackingChannelId ?? null) ? channelId : null
	const roleOverride =
		(roleId ?? null) !== (config?.trackingRoleId ?? null) ? (roleId ?? null) : null

	await queries.addTrackedProject(
		guildId,
		project.id,
		project.slug ?? project.id,
		project.name,
		new Date(project.updated),
		undefined,
		channelOverride,
		roleOverride,
	)
	return true
}

export async function pollAuthorUpdates(client: Client, supporterOnly?: boolean) {
	const startedAt = Date.now()
	const supporterLabel = supporterOnly ? 'true' : 'false'
	const stopTimer = trackingAuthorDurationSeconds.startTimer({ supporter: supporterLabel })

	try {
		const rows = await queries.getPollingAuthors(supporterOnly)
		if (rows.length === 0) {
			log.debug(
				{ supporterOnly, durationMs: Date.now() - startedAt },
				'Author tracking tick skipped with no tracked creators',
			)
			trackingAuthorTicksTotal.inc({ supporter: supporterLabel, status: 'success' })
			return
		}

		const byAuthor = groupByAuthor(rows)
		log.debug(
			{ uniqueAuthors: byAuthor.size, supporterOnly, rows: rows.length },
			'Author tracking tick started',
		)

		let newProjectsFound = 0
		let notificationsSent = 0
		let autoTracked = 0
		let failedAuthors = 0

		for (const info of byAuthor.values()) {
			try {
				const projects = await fetchAuthorProjects(info.authorType, info.authorId)
				const newProjects = projects.filter((p) => !info.knownProjectIds.has(p.id))

				await queries.updateKnownProjects(
					info.authorId,
					projects.map((p) => p.id),
					info.guildIds,
				)

				if (newProjects.length === 0) continue
				newProjectsFound += newProjects.length

				const profile = await fetchAuthorProfile(info.authorType, info.authorId)
				const author = { name: profile?.name ?? info.username, avatarUrl: profile?.avatarUrl }

				for (const project of newProjects) {
					const notified = await notifyAuthorChannels(client, project, author, info.channels)
					notificationsSent += notified.length

					for (const { guildId, channelId, roleId } of info.channels) {
						const tracked = await autoTrackDiscoveredProject(guildId, project, channelId, roleId)
						if (tracked) autoTracked += 1
					}
				}

				log.info(
					{
						authorId: info.authorId,
						username: info.username,
						newProjects: newProjects.length,
						guilds: info.guildIds.length,
					},
					'New projects discovered',
				)
			} catch (err) {
				failedAuthors += 1
				log.error({ authorId: info.authorId, err }, 'Failed to check author')
			}
		}

		trackingAuthorNotificationsTotal.inc(notificationsSent)
		trackingAuthorAutoTrackedTotal.inc(autoTracked)
		log.info(
			{
				supporterOnly,
				trackedAuthors: rows.length,
				uniqueAuthors: byAuthor.size,
				failedAuthors,
				newProjectsFound,
				notificationsSent,
				autoTracked,
				durationMs: Date.now() - startedAt,
			},
			'Author tracking tick completed',
		)
		trackingAuthorTicksTotal.inc({ supporter: supporterLabel, status: 'success' })
	} catch (err) {
		trackingAuthorTicksTotal.inc({ supporter: supporterLabel, status: 'error' })
		throw err
	} finally {
		stopTimer()
	}
}
