import { createModuleLogger } from './logger.js'

const log = createModuleLogger('heartbeat')

const HEARTBEAT_INTERVAL_MS = 60 * 1000 // 1 minute

export function startHeartbeat() {
	const url = process.env.BETTERSTACK_HEARTBEAT_URL
	if (!url) return

	setInterval(() => {
		const startedAt = Date.now()
		fetch(url)
			.then(() => log.debug({ durationMs: Date.now() - startedAt }, 'Heartbeat ping succeeded'))
			.catch((err) => log.warn({ err }, 'Heartbeat ping failed'))
	}, HEARTBEAT_INTERVAL_MS).unref()
	log.info({ intervalMs: HEARTBEAT_INTERVAL_MS }, 'Heartbeat started')
}
