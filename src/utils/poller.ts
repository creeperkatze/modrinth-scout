import type { Client, TextChannel } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { queries } from '../db/queries.js'
import { buildVersionNotification } from './embeds/index.js'
import { logger } from './logger.js'

const log = logger.child({ module: 'poller' })

const POLL_INTERVAL_MS = 1 * 60 * 1000

async function poll(client: Client) {
	const rows = await queries.getAllTrackedWithConfig()
	if (rows.length === 0) return

	// Deduplicate: one API call per unique project, track which channels to notify
	const byProject = new Map<
		string,
		{ slug: string; lastUpdated: string; channels: { channelId: string; roleId?: string | null }[] }
	>()
	for (const row of rows) {
		const existing = byProject.get(row.projectId)
		if (existing) {
			existing.channels.push({ channelId: row.channelId, roleId: row.roleId })
		} else {
			byProject.set(row.projectId, {
				slug: row.slug,
				lastUpdated: row.lastUpdated,
				channels: [{ channelId: row.channelId, roleId: row.roleId }],
			})
		}
	}

	log.debug({ uniqueProjects: byProject.size }, 'Poll tick')

	for (const [projectId, info] of byProject) {
		try {
			const project = await modrinth.getProject(info.slug)
			if (project.updated === info.lastUpdated) continue

			queries.updateLastUpdated(projectId, project.updated)

			const versions = await modrinth.getProjectVersions(info.slug)
			if (versions.length === 0) continue
			const payload = buildVersionNotification(project, versions[0])
			const notified: string[] = []
			for (const { channelId, roleId } of info.channels) {
				const channel = client.channels.cache.get(channelId) as TextChannel | undefined
				if (channel?.isTextBased()) {
					await channel.send({ ...payload, content: roleId ? `<@&${roleId}>` : undefined })
					notified.push(channelId)
				} else {
					log.warn({ projectId, channelId }, 'Channel not found or not text-based')
				}
			}
			log.info(
				{ projectId, slug: info.slug, channels: notified.length },
				'Update detected, notifications sent',
			)
		} catch (err) {
			log.error({ projectId, err }, 'Failed to check project')
		}
	}
}

export function startPoller(client: Client) {
	const run = () => poll(client).catch((err) => log.error({ err }, 'Unhandled error in poll'))
	const timer = setInterval(run, POLL_INTERVAL_MS)
	timer.unref()
	log.info({ intervalMs: POLL_INTERVAL_MS }, 'Poller started')
}
