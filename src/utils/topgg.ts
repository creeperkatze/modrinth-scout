import { Api } from '@top-gg/sdk'
import type { Client } from 'discord.js'

import { createModuleLogger } from './logger.js'

const log = createModuleLogger('topgg')

const POST_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

const api = process.env.TOPGG_TOKEN ? new Api(process.env.TOPGG_TOKEN) : null

export function postTopggStats(client: Client) {
	if (!api) return

	const startedAt = Date.now()
	api
		.postMetrics({ serverCount: client.guilds.cache.size })
		.then(() => log.info({ durationMs: Date.now() - startedAt }, 'Stats posted to top.gg'))
		.catch((err) => log.warn({ err }, 'Failed to post stats to top.gg'))
}

export function startTopggStats(client: Client) {
	if (!api) return

	postTopggStats(client)
	setInterval(() => postTopggStats(client), POST_INTERVAL_MS).unref()
	log.info({ intervalMs: POST_INTERVAL_MS }, 'top.gg stats posting started')
}
