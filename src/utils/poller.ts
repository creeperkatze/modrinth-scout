import type { Client, TextChannel } from 'discord.js'

import type { ModrinthProject, ModrinthVersion } from '../api/modrinth.js'
import { modrinth } from '../api/modrinth.js'
import { supporterPerksEnabled } from '../config/supporterPerks.js'
import { queries } from '../db/queries.js'
import type { ProjectWithChannel } from '../db/schemas/project.js'
import { buildVersionNotification } from './embeds/index.js'
import { createModuleLogger } from './logger.js'

const log = createModuleLogger('poller')

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SUPPORTER_POLL_INTERVAL_MS = 60 * 1000 // 1 minute
const HEARTBEAT_INTERVAL_MS = 60 * 1000 // 1 minute

type ProjectEntry = {
	slug: string
	lastUpdated: Date
	guildIds: string[]
	channels: { channelId: string; roleId?: string | null; releaseType: string[] }[]
}

function groupByProject(rows: ProjectWithChannel[]): Map<string, ProjectEntry> {
	const map = new Map<string, ProjectEntry>()
	for (const row of rows) {
		const entry = map.get(row.projectId)
		if (entry) {
			entry.guildIds.push(row.guildId)
			entry.channels.push({
				channelId: row.channelId,
				roleId: row.roleId,
				releaseType: row.releaseType,
			})
		} else {
			map.set(row.projectId, {
				slug: row.slug,
				lastUpdated: row.lastUpdated,
				guildIds: [row.guildId],
				channels: [{ channelId: row.channelId, roleId: row.roleId, releaseType: row.releaseType }],
			})
		}
	}
	return map
}

async function fetchProjects(ids: string[]): Promise<ModrinthProject[]> {
	// Modrinth's endpoint caps at ~810 IDs per request, 512 keeps us safe
	const chunks: string[][] = []
	for (let i = 0; i < ids.length; i += 512) chunks.push(ids.slice(i, i + 512))
	const t0 = Date.now()
	const projects = (await Promise.all(chunks.map((chunk) => modrinth.getProjects(chunk, 0)))).flat()
	log.debug(
		{ durationMs: Date.now() - t0, returned: projects.length, chunks: chunks.length },
		'Batch project fetch done',
	)
	return projects
}

async function notifyChannels(
	client: Client,
	project: ModrinthProject,
	newVersions: ModrinthVersion[],
	channels: ProjectEntry['channels'],
) {
	const notified: string[] = []
	for (const { channelId, roleId, releaseType } of channels) {
		const filtered = newVersions.filter((v) => releaseType.includes(v.version_type))
		if (filtered.length === 0) continue

		const channel = client.channels.cache.get(channelId) as TextChannel | undefined
		if (!channel?.isTextBased()) {
			log.warn({ projectId: project.id, channelId, roleId }, 'Channel not found or not text-based')
			continue
		}

		const pages: ModrinthVersion[][] = []
		for (let i = 0; i < filtered.length; i += 10) pages.push(filtered.slice(i, i + 10))
		const versionLabel = filtered.length > 1 ? 'View Newest Version' : 'View Version'
		const { components } = buildVersionNotification(project, filtered.at(-1)!, versionLabel)
		const mention = roleId ? channel.guild.roles.cache.get(roleId)?.toString() : undefined

		for (let i = 0; i < pages.length; i++) {
			const embeds = pages[i].flatMap((v) => buildVersionNotification(project, v).embeds)
			const isLast = i === pages.length - 1
			await channel.send({
				content: isLast ? mention : undefined,
				embeds,
				components: isLast ? components : [],
			})
		}
		notified.push(channelId)
	}
	return notified
}

async function poll(client: Client, supporterOnly: boolean) {
	const startedAt = Date.now()
	const rows = await queries.getPollingProjects(supporterOnly)
	if (rows.length === 0) {
		log.debug(
			{ supporterOnly, durationMs: Date.now() - startedAt },
			'Poll tick skipped with no tracked projects',
		)
		return
	}

	const byProject = groupByProject(rows)
	log.debug(
		{ uniqueProjects: byProject.size, supporterOnly, rows: rows.length },
		'Poll tick started',
	)

	const projects = await fetchProjects([...byProject.keys()])
	let changedProjects = 0
	let notificationsSent = 0

	for (const project of projects) {
		const info = byProject.get(project.id)
		if (!info) continue

		const updatedAt = new Date(project.updated)
		if (updatedAt.getTime() === info.lastUpdated.getTime()) continue

		changedProjects += 1
		log.debug({ projectId: project.id, slug: project.slug }, 'Change detected, fetching versions')
		try {
			await queries.updateLastUpdated(project.id, updatedAt, info.guildIds)

			const t0 = Date.now()
			const versions = await modrinth.getProjectVersions(project.id)
			log.debug(
				{ durationMs: Date.now() - t0, slug: project.slug, total: versions.length },
				'Versions fetched',
			)

			const newVersions = versions
				.filter((v) => new Date(v.date_published) > info.lastUpdated)
				.reverse()
			if (newVersions.length === 0) {
				log.debug({ slug: project.slug }, 'No new versions after date filter, skipping')
				continue
			}

			const notified = await notifyChannels(client, project, newVersions, info.channels)
			notificationsSent += notified.length
			log.info(
				{
					projectId: project.id,
					slug: project.slug,
					newVersions: newVersions.length,
					channels: notified.length,
					guilds: info.guildIds.length,
				},
				'Notifications sent',
			)
		} catch (err) {
			log.error({ projectId: project.id, err }, 'Failed to check project')
		}
	}

	log.debug(
		{
			supporterOnly,
			rows: rows.length,
			projects: projects.length,
			changedProjects,
			notificationsSent,
			durationMs: Date.now() - startedAt,
		},
		'Poll tick complete',
	)
}

export function startPoller(client: Client) {
	const createRunner = (supporterOnly: boolean, intervalMs: number) => {
		const run = async () => {
			await poll(client, supporterOnly).catch((err) =>
				log.error({ err }, 'Unhandled error in poll'),
			)
			setTimeout(run, intervalMs).unref()
		}
		setTimeout(run, intervalMs).unref()
	}

	if (supporterPerksEnabled) {
		createRunner(false, POLL_INTERVAL_MS)
		createRunner(true, SUPPORTER_POLL_INTERVAL_MS)
	} else {
		createRunner(false, SUPPORTER_POLL_INTERVAL_MS)
	}
	log.info(
		{
			intervalMs: supporterPerksEnabled ? POLL_INTERVAL_MS : SUPPORTER_POLL_INTERVAL_MS,
			supporterIntervalMs: supporterPerksEnabled ? SUPPORTER_POLL_INTERVAL_MS : null,
			supportEnabled: supporterPerksEnabled,
		},
		'Poller started',
	)

	if (process.env.BETTERSTACK_HEARTBEAT_URL) {
		const url = process.env.BETTERSTACK_HEARTBEAT_URL
		setInterval(() => {
			const startedAt = Date.now()
			fetch(url)
				.then(() => log.debug({ durationMs: Date.now() - startedAt }, 'Heartbeat ping succeeded'))
				.catch((err) => log.warn({ err }, 'Heartbeat ping failed'))
		}, HEARTBEAT_INTERVAL_MS).unref()
		log.info({ intervalMs: HEARTBEAT_INTERVAL_MS }, 'Heartbeat started')
	}
}
