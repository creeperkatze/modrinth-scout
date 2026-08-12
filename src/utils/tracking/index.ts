import type { Client } from 'discord.js'

import { usesDonatorPerks } from '../../config/donatorPerks.js'
import { createModuleLogger } from '../logger.js'
import { trackAuthorUpdates } from './author.js'
import { loadTrackingBatch } from './load.js'
import { trackProjectUpdates } from './project.js'

const log = createModuleLogger('tracking')

const TRACKING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DONATOR_TRACKING_INTERVAL_MS = 60 * 1000 // 1 minute

// One database load, and one summary line, per tick, for both the project and author runs
async function runTick(client: Client, donatorOnly: boolean | undefined) {
	const startedAt = Date.now()
	const batch = await loadTrackingBatch(donatorOnly)

	const [projects, authors] = await Promise.all([
		trackProjectUpdates(client, batch.projects, donatorOnly).catch((err) => {
			log.error({ err }, 'Unhandled error in project tracking run')
			return null
		}),
		trackAuthorUpdates(client, batch.authors, donatorOnly).catch((err) => {
			log.error({ err }, 'Unhandled error in author tracking run')
			return null
		}),
	])

	if (batch.entryCount === 0) {
		log.debug(
			{ donatorOnly, durationMs: Date.now() - startedAt },
			'Tracking tick skipped, nothing tracked',
		)
		return
	}

	log.info(
		{
			donatorOnly,
			entries: batch.entryCount,
			projects,
			authors,
			durationMs: Date.now() - startedAt,
		},
		'Tracking tick completed',
	)
}

export function startTracking(client: Client) {
	const createRunner = (donatorOnly: boolean | undefined, intervalMs: number) => {
		const run = async () => {
			await runTick(client, donatorOnly).catch((err) =>
				log.error({ err }, 'Unhandled error in tracking tick'),
			)
			setTimeout(run, intervalMs).unref()
		}
		setTimeout(run, intervalMs).unref()
	}

	if (usesDonatorPerks) {
		createRunner(false, TRACKING_INTERVAL_MS)
		createRunner(true, DONATOR_TRACKING_INTERVAL_MS)
	} else {
		createRunner(undefined, DONATOR_TRACKING_INTERVAL_MS)
	}
	log.info(
		{
			intervalMs: usesDonatorPerks ? TRACKING_INTERVAL_MS : DONATOR_TRACKING_INTERVAL_MS,
			donatorIntervalMs: usesDonatorPerks ? DONATOR_TRACKING_INTERVAL_MS : null,
			donatorPerksEnabled: usesDonatorPerks,
		},
		'Tracking started',
	)
}
