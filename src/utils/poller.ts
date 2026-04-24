import type { Client, TextChannel } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { queries } from '../db/queries.js'
import { buildUpdateNotification } from './embeds.js'

const POLL_INTERVAL_MS = 5 * 60 * 1000

async function poll(client: Client) {
	const rows = queries.getAllTrackedWithConfig()
	if (rows.length === 0) return

	// Deduplicate: one API call per unique project, track which channels to notify
	const byProject = new Map<string, { slug: string; lastUpdated: string; channelIds: string[] }>()
	for (const row of rows) {
		const existing = byProject.get(row.projectId)
		if (existing) {
			existing.channelIds.push(row.channelId)
		} else {
			byProject.set(row.projectId, {
				slug: row.slug,
				lastUpdated: row.lastUpdated,
				channelIds: [row.channelId],
			})
		}
	}

	for (const [projectId, info] of byProject) {
		try {
			const project = await modrinth.getProject(info.slug)
			if (project.updated === info.lastUpdated) continue

			queries.updateLastUpdated(projectId, project.updated)

			const payload = buildUpdateNotification(project)
			for (const channelId of info.channelIds) {
				const channel = client.channels.cache.get(channelId) as TextChannel | undefined
				if (channel?.isTextBased()) await channel.send(payload)
			}
		} catch (err) {
			console.error(`[poller] Failed to check project ${projectId}:`, err)
		}
	}
}

export function startPoller(client: Client) {
	const run = () => poll(client).catch((err) => console.error('[poller] Unhandled error:', err))
	const timer = setInterval(run, POLL_INTERVAL_MS)
	timer.unref()
}
