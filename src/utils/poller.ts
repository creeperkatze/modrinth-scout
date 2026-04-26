import type { Client, TextChannel } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { queries } from '../db/queries.js'
import { buildVersionNotification } from './embeds/index.js'
import { logger } from './logger.js'

const log = logger.child({ module: 'poller' })

const POLL_INTERVAL_MS = 5 * 60 * 1000

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

	const allIds = [...byProject.keys()]
	const chunks: string[][] = []
	for (let i = 0; i < allIds.length; i += 500) chunks.push(allIds.slice(i, i + 500))
	const projects = (await Promise.all(chunks.map((ids) => modrinth.getProjects(ids, 0)))).flat()

	for (const project of projects) {
		const info = byProject.get(project.id)
		if (!info || project.updated === info.lastUpdated) continue

		try {
			await queries.updateLastUpdated(project.id, project.updated)

			const versions = await modrinth.getProjectVersions(project.slug)
			const newVersions = versions
				.filter((v) => new Date(v.date_published) > new Date(info.lastUpdated))
				.reverse()
			if (newVersions.length === 0) continue

			const embeds = newVersions.flatMap((v) => buildVersionNotification(project, v).embeds)
			const components = newVersions
				.flatMap((v) => buildVersionNotification(project, v).components)
				.slice(0, 5)

			const notified: string[] = []
			for (const { channelId, roleId } of info.channels) {
				const channel = client.channels.cache.get(channelId) as TextChannel | undefined
				if (channel?.isTextBased()) {
					const mention = roleId ? channel.guild.roles.cache.get(roleId)?.toString() : undefined
					await channel.send({ content: mention, embeds, components })
					notified.push(channelId)
				} else {
					log.warn({ projectId: project.id, channelId }, 'Channel not found or not text-based')
				}
			}
			log.info(
				{ projectId: project.id, slug: project.slug, channels: notified.length },
				'Update detected, notifications sent',
			)
		} catch (err) {
			log.error({ projectId: project.id, err }, 'Failed to check project')
		}
	}
}

export function startPoller(client: Client) {
	const run = () => poll(client).catch((err) => log.error({ err }, 'Unhandled error in poll'))
	const timer = setInterval(run, POLL_INTERVAL_MS)
	timer.unref()
	log.info({ intervalMs: POLL_INTERVAL_MS }, 'Poller started')
}
