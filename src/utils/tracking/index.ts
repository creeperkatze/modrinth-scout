import type { Client } from 'discord.js'

import { usesDonatorPerks } from '../../config/donatorPerks.js'
import { createModuleLogger } from '../logger.js'
import { trackingDurationSeconds, trackingEntries, trackingTicksTotal } from '../metrics.js'
import { trackAuthorUpdates } from './author.js'
import type { TrackingTarget } from './load.js'
import { loadTrackingBatch } from './load.js'
import { trackProjectUpdates } from './project.js'

const log = createModuleLogger('tracking')

const TRACKING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DONATOR_TRACKING_INTERVAL_MS = 60 * 1000 // 1 minute

// 'all' is the single-runner case, when donator perks are switched off entirely
function tierLabel(donatorOnly: boolean | undefined): string {
	if (donatorOnly === undefined) return 'all'
	return donatorOnly ? 'donator' : 'free'
}

function countEntries(targets: TrackingTarget[]): number {
	return targets.reduce((total, target) => total + target.subscriptions.length, 0)
}

// One database load per tick feeds both the project and author runs
async function runTick(client: Client, donatorOnly: boolean | undefined) {
	const tier = tierLabel(donatorOnly)
	const startedAt = Date.now()
	const stopTimer = trackingDurationSeconds.startTimer({ tier })

	try {
		const batch = await loadTrackingBatch(donatorOnly)

		trackingEntries.set({ kind: 'project', tier }, countEntries(batch.projects))
		trackingEntries.set({ kind: 'author', tier }, countEntries(batch.authors))

		// A failure in one half is contained so the other still runs, but the tick counts as failed
		const [projects, authors] = await Promise.all([
			trackProjectUpdates(client, batch.projects, tier).catch((err) => {
				log.error({ err, tier }, 'Project tracking run failed')
				return null
			}),
			trackAuthorUpdates(client, batch.authors, tier).catch((err) => {
				log.error({ err, tier }, 'Author tracking run failed')
				return null
			}),
		])

		trackingTicksTotal.inc({ tier, status: projects && authors ? 'success' : 'error' })

		if (batch.entryCount === 0) {
			log.debug(
				{ tier, durationMs: Date.now() - startedAt },
				'Tracking tick skipped, nothing tracked',
			)
			return
		}

		log.info(
			{ tier, entries: batch.entryCount, projects, authors, durationMs: Date.now() - startedAt },
			'Tracking tick completed',
		)
	} catch (err) {
		trackingTicksTotal.inc({ tier, status: 'error' })
		throw err
	} finally {
		stopTimer()
	}
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
