import type { Labrinth } from '@modrinth/api-client'
import { type Client, DiscordAPIError, type TextChannel } from 'discord.js'

import { aiSummariesEnabled } from '../config/ai.js'
import { usesSupporterPerks } from '../config/supporterPerks.js'
import { queries } from '../db/queries.js'
import type { ProjectWithChannel } from '../db/schemas/project.js'
import { summarizeChangelog } from './ai/summary.js'
import { modrinthClient } from './api/modrinth.js'
import { buildTrackingPausedNotice, buildVersionNotification } from './embeds/index.js'
import { createModuleLogger } from './logger.js'
import { pollDurationSeconds, pollNotificationsTotal, pollTicksTotal } from './metrics.js'

const log = createModuleLogger('poller')

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SUPPORTER_POLL_INTERVAL_MS = 60 * 1000 // 1 minute
const HEARTBEAT_INTERVAL_MS = 60 * 1000 // 1 minute

// These error codes mean the channel needs a fix on the Discord server owners side, not ours
function isUnreachableChannelError(err: unknown): err is DiscordAPIError {
	return err instanceof DiscordAPIError && (err.status === 403 || err.status === 404)
}

type ProjectEntry = {
	slug: string
	lastUpdated: Date
	guildIds: string[]
	channels: {
		guildId: string
		channelId: string
		roleId?: string | null
		releaseType: string[]
		changelogSummariesEnabled: boolean
	}[]
}

function groupByProject(rows: ProjectWithChannel[]): Map<string, ProjectEntry> {
	const map = new Map<string, ProjectEntry>()
	for (const row of rows) {
		const entry = map.get(row.projectId)
		const channel = {
			guildId: row.guildId,
			channelId: row.channelId,
			roleId: row.roleId,
			releaseType: row.releaseType,
			changelogSummariesEnabled: row.changelogSummariesEnabled,
		}
		if (entry) {
			entry.guildIds.push(row.guildId)
			entry.channels.push(channel)
		} else {
			map.set(row.projectId, {
				slug: row.slug,
				lastUpdated: row.lastUpdated,
				guildIds: [row.guildId],
				channels: [channel],
			})
		}
	}
	return map
}

async function pauseTrackingForUnreachableChannel(
	client: Client,
	guildId: string,
	channelId: string,
) {
	const config = await queries.getServerConfig(guildId)
	if (config?.trackingPaused) return

	await queries.pauseTracking(guildId)
	log.warn({ guildId, channelId }, 'Tracking paused, notification channel is unreachable')

	const guild = client.guilds.cache.get(guildId)
	const systemChannel = guild?.systemChannel
	if (!systemChannel?.isTextBased()) return

	try {
		await systemChannel.send({ embeds: [buildTrackingPausedNotice(channelId)] })
	} catch (err) {
		log.debug({ guildId, err }, 'Could not post pause notice to system channel')
	}
}

async function fetchProjects(ids: string[]): Promise<Labrinth.Projects.v3.Project[]> {
	const chunks: string[][] = []
	for (let i = 0; i < ids.length; i += 512) chunks.push(ids.slice(i, i + 512))
	const t0 = Date.now()
	const projects = (
		await Promise.all(chunks.map((chunk) => modrinthClient.labrinth.projects_v3.getMultiple(chunk)))
	).flat()
	log.debug(
		{ durationMs: Date.now() - t0, returned: projects.length, chunks: chunks.length },
		'Batch project fetch done',
	)
	return projects
}

async function notifyChannels(
	client: Client,
	project: Labrinth.Projects.v3.Project,
	newVersions: Labrinth.Versions.v3.Version[],
	channels: ProjectEntry['channels'],
	summaries: Map<string, string | null>,
) {
	const notified: string[] = []
	for (const { guildId, channelId, roleId, releaseType, changelogSummariesEnabled } of channels) {
		const filtered = newVersions.filter((v) => releaseType.includes(v.version_type))
		if (filtered.length === 0) continue

		const channel = client.channels.cache.get(channelId) as TextChannel | undefined
		if (!channel?.isTextBased()) {
			log.warn(
				{ projectId: project.id, guildId, channelId, roleId },
				'Channel not found or not text-based',
			)
			await pauseTrackingForUnreachableChannel(client, guildId, channelId)
			continue
		}

		const mention = roleId ? channel.guild.roles.cache.get(roleId)?.toString() : undefined

		try {
			for (let i = 0; i < filtered.length; i++) {
				const payload = await buildVersionNotification(
					project,
					filtered[i],
					undefined,
					changelogSummariesEnabled ? summaries.get(filtered[i].id) : null,
				)
				const isFirst = i === 0
				await channel.send({
					content: isFirst ? mention : undefined,
					embeds: payload.embeds,
					components: payload.components,
				})
			}
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

async function poll(client: Client, supporterOnly?: boolean) {
	const startedAt = Date.now()
	const supporterLabel = supporterOnly ? 'true' : 'false'
	const stopTimer = pollDurationSeconds.startTimer({ supporter: supporterLabel })

	try {
		const rows = await queries.getPollingProjects(supporterOnly)
		if (rows.length === 0) {
			log.debug(
				{ supporterOnly, durationMs: Date.now() - startedAt },
				'Poll tick skipped with no tracked projects',
			)
			pollTicksTotal.inc({ supporter: supporterLabel, status: 'success' })
			return
		}

		const byProject = groupByProject(rows)
		log.debug(
			{ uniqueProjects: byProject.size, supporterOnly, rows: rows.length },
			'Poll tick started',
		)

		const projects = await fetchProjects([...byProject.keys()])
		let changedProjects = 0
		let failedProjects = 0
		let newVersionsFound = 0
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
				const versions = await modrinthClient.labrinth.versions_v3.getProjectVersions(project.id)
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
				newVersionsFound += newVersions.length

				const wantsSummaries =
					aiSummariesEnabled && info.channels.some((c) => c.changelogSummariesEnabled)
				const summaries = wantsSummaries
					? new Map<string, string | null>(
							await Promise.all(
								newVersions.map(
									async (version) =>
										[version.id, await summarizeChangelog(project, version)] as const,
								),
							),
						)
					: new Map<string, string | null>()

				const notified = await notifyChannels(
					client,
					project,
					newVersions,
					info.channels,
					summaries,
				)
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
				failedProjects += 1
				log.error({ projectId: project.id, err }, 'Failed to check project')
			}
		}

		pollNotificationsTotal.inc(notificationsSent)
		log.info(
			{
				supporterOnly,
				trackedProjects: rows.length,
				uniqueProjects: byProject.size,
				checkedProjects: projects.length,
				updatedProjects: changedProjects,
				failedProjects,
				newVersionsFound,
				notificationsSent,
				durationMs: Date.now() - startedAt,
			},
			'Poll tick completed',
		)
		pollTicksTotal.inc({ supporter: supporterLabel, status: 'success' })
	} catch (err) {
		pollTicksTotal.inc({ supporter: supporterLabel, status: 'error' })
		throw err
	} finally {
		stopTimer()
	}
}

export function startPoller(client: Client) {
	const createRunner = (supporterOnly: boolean | undefined, intervalMs: number) => {
		const run = async () => {
			await poll(client, supporterOnly).catch((err) =>
				log.error({ err }, 'Unhandled error in poll'),
			)
			setTimeout(run, intervalMs).unref()
		}
		setTimeout(run, intervalMs).unref()
	}

	if (usesSupporterPerks) {
		createRunner(false, POLL_INTERVAL_MS)
		createRunner(true, SUPPORTER_POLL_INTERVAL_MS)
	} else {
		createRunner(undefined, SUPPORTER_POLL_INTERVAL_MS)
	}
	log.info(
		{
			intervalMs: usesSupporterPerks ? POLL_INTERVAL_MS : SUPPORTER_POLL_INTERVAL_MS,
			supporterIntervalMs: usesSupporterPerks ? SUPPORTER_POLL_INTERVAL_MS : null,
			supportEnabled: usesSupporterPerks,
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
