import type { Client } from 'discord.js'

import { usesDonatorPerks } from '../../config/donatorPerks.js'
import { createModuleLogger } from '../logger.js'
import { pollAuthorUpdates } from './author.js'
import { pollProjectUpdates } from './project.js'

const log = createModuleLogger('tracking')

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DONATOR_POLL_INTERVAL_MS = 60 * 1000 // 1 minute

export function startTracking(client: Client) {
	const createRunner = (donatorOnly: boolean | undefined, intervalMs: number) => {
		const run = async () => {
			await Promise.all([
				pollProjectUpdates(client, donatorOnly).catch((err) =>
					log.error({ err }, 'Unhandled error in project tracking tick'),
				),
				pollAuthorUpdates(client, donatorOnly).catch((err) =>
					log.error({ err }, 'Unhandled error in author tracking tick'),
				),
			])
			setTimeout(run, intervalMs).unref()
		}
		setTimeout(run, intervalMs).unref()
	}

	if (usesDonatorPerks) {
		createRunner(false, POLL_INTERVAL_MS)
		createRunner(true, DONATOR_POLL_INTERVAL_MS)
	} else {
		createRunner(undefined, DONATOR_POLL_INTERVAL_MS)
	}
	log.info(
		{
			intervalMs: usesDonatorPerks ? POLL_INTERVAL_MS : DONATOR_POLL_INTERVAL_MS,
			donatorIntervalMs: usesDonatorPerks ? DONATOR_POLL_INTERVAL_MS : null,
			donatorPerksEnabled: usesDonatorPerks,
		},
		'Tracking started',
	)
}
