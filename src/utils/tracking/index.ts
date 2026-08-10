import type { Client } from 'discord.js'

import { usesSupporterPerks } from '../../config/supporterPerks.js'
import { createModuleLogger } from '../logger.js'
import { pollAuthorUpdates } from './author.js'
import { pollProjectUpdates } from './project.js'

const log = createModuleLogger('tracking')

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SUPPORTER_POLL_INTERVAL_MS = 60 * 1000 // 1 minute
const HEARTBEAT_INTERVAL_MS = 60 * 1000 // 1 minute

export function startTracking(client: Client) {
	const createRunner = (supporterOnly: boolean | undefined, intervalMs: number) => {
		const run = async () => {
			await Promise.all([
				pollProjectUpdates(client, supporterOnly).catch((err) =>
					log.error({ err }, 'Unhandled error in project tracking tick'),
				),
				pollAuthorUpdates(client, supporterOnly).catch((err) =>
					log.error({ err }, 'Unhandled error in author tracking tick'),
				),
			])
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
		'Tracking started',
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
