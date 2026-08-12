import type { Labrinth } from '@modrinth/api-client'
import { type Client } from 'discord.js'

import { aiSummariesEnabled } from '../../config/ai.js'
import { queries } from '../../db/queries.js'
import { summarizeChangelog } from '../ai/summary.js'
import { modrinthClient } from '../api/modrinth.js'
import { buildVersionNotification } from '../embeds/index.js'
import { createModuleLogger } from '../logger.js'
import {
	trackingProjectDurationSeconds,
	trackingProjectNotificationsTotal,
	trackingProjectTicksTotal,
} from '../metrics.js'
import { deliver } from './deliver.js'
import type { TrackingTarget } from './load.js'

const log = createModuleLogger('tracking:project')

async function fetchProjects(ids: string[]): Promise<Labrinth.Projects.v3.Project[]> {
	const chunks: string[][] = []
	for (let i = 0; i < ids.length; i += 512) chunks.push(ids.slice(i, i + 512))
	const t0 = Date.now()
	const projects = (
		await Promise.all(chunks.map((chunk) => modrinthClient.labrinth.projects_v3.getMultiple(chunk)))
	).flat()
	log.debug(
		{ durationMs: Date.now() - t0, returned: projects.length, chunks: chunks.length },
		'Batch project fetch done',
	)
	return projects
}

function oldestCursor(target: TrackingTarget): Date {
	let oldest = target.subscriptions[0].notifiedThrough
	for (const subscription of target.subscriptions) {
		if (subscription.notifiedThrough < oldest) oldest = subscription.notifiedThrough
	}
	return oldest
}

export async function trackProjectUpdates(
	client: Client,
	targets: TrackingTarget[],
	donatorOnly?: boolean,
) {
	const startedAt = Date.now()
	const donatorLabel = donatorOnly ? 'true' : 'false'
	const stopTimer = trackingProjectDurationSeconds.startTimer({ supporter: donatorLabel })

	try {
		if (targets.length === 0) {
			log.debug(
				{ donatorOnly, durationMs: Date.now() - startedAt },
				'Project tracking tick skipped with no tracked projects',
			)
			trackingProjectTicksTotal.inc({ supporter: donatorLabel, status: 'success' })
			return
		}

		const byTargetId = new Map(targets.map((target) => [target.targetId, target]))
		log.debug({ uniqueProjects: targets.length, donatorOnly }, 'Project tracking tick started')

		const projects = await fetchProjects([...byTargetId.keys()])
		let changedProjects = 0
		let failedProjects = 0
		let newVersionsFound = 0
		let notificationsSent = 0

		for (const project of projects) {
			const target = byTargetId.get(project.id)
			if (!target) continue

			const updatedAt = new Date(project.updated)
			// Nothing to do until the project has moved past the least caught-up subscriber
			if (updatedAt <= oldestCursor(target)) continue

			changedProjects += 1
			log.debug({ projectId: project.id, slug: project.slug }, 'Change detected, fetching versions')
			try {
				const t0 = Date.now()
				const versions = await modrinthClient.labrinth.versions_v3.getProjectVersions(project.id)
				log.debug(
					{ durationMs: Date.now() - t0, slug: project.slug, total: versions.length },
					'Versions fetched',
				)

				// Computed at most once per version per tick, and only if a subscriber wants them
				const summaries = new Map<string, Promise<string | null>>()
				const summaryFor = (version: Labrinth.Versions.v3.Version) => {
					let summary = summaries.get(version.id)
					if (!summary) {
						summary = summarizeChangelog(project, version)
						summaries.set(version.id, summary)
					}
					return summary
				}

				for (const subscription of target.subscriptions) {
					if (updatedAt <= subscription.notifiedThrough) continue

					const newVersions = versions
						.filter((v) => new Date(v.date_published) > subscription.notifiedThrough)
						.filter((v) => subscription.settings.releaseTypes.includes(v.version_type))
						.reverse()

					if (newVersions.length === 0) {
						await queries.advanceNotifiedThrough(subscription.id, updatedAt)
						continue
					}
					newVersionsFound += newVersions.length

					const wantsSummaries = aiSummariesEnabled && subscription.changelogSummariesEnabled
					const payloads = await Promise.all(
						newVersions.map(async (version) =>
							buildVersionNotification(
								project,
								version,
								undefined,
								wantsSummaries ? await summaryFor(version) : null,
							),
						),
					)

					const outcome = await deliver(client, subscription, payloads, { projectId: project.id })
					// Advanced on 'unreachable' too, replaying the backlog on resume is worse than skipping
					await queries.advanceNotifiedThrough(subscription.id, updatedAt)
					if (outcome === 'sent') notificationsSent += 1
				}

				log.info(
					{
						projectId: project.id,
						slug: project.slug,
						subscriptions: target.subscriptions.length,
					},
					'Notifications sent',
				)
			} catch (err) {
				failedProjects += 1
				log.error({ projectId: project.id, err }, 'Failed to check project')
			}
		}

		trackingProjectNotificationsTotal.inc(notificationsSent)
		log.info(
			{
				donatorOnly,
				uniqueProjects: targets.length,
				checkedProjects: projects.length,
				updatedProjects: changedProjects,
				failedProjects,
				newVersionsFound,
				notificationsSent,
				durationMs: Date.now() - startedAt,
			},
			'Project tracking tick completed',
		)
		trackingProjectTicksTotal.inc({ supporter: donatorLabel, status: 'success' })
	} catch (err) {
		trackingProjectTicksTotal.inc({ supporter: donatorLabel, status: 'error' })
		throw err
	} finally {
		stopTimer()
	}
}
