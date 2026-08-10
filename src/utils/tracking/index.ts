import type { Client } from 'discord.js'

import { usesSupporterPerks } from '../../config/supporterPerks.js'
import { createModuleLogger } from '../logger.js'
import { pollAuthorUpdates } from './author.js'
import { pollProjectUpdates } from './project.js'

const log = createModuleLogger('tracking')

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SUPPORTER_POLL_INTERVAL_MS = 60 * 1000 // 1 minute

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
}
