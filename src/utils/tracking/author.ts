import type { Labrinth } from '@modrinth/api-client'
import { type Client } from 'discord.js'

import { queries } from '../../db/queries.js'
import type { AuthorKind } from '../../db/schemas/tracking.js'
import { modrinthClient } from '../api/modrinth.js'
import { buildNewProjectNotification } from '../embeds/index.js'
import { createModuleLogger } from '../logger.js'
import {
	trackingAuthorAutoTrackedTotal,
	trackingAuthorDurationSeconds,
	trackingAuthorNotificationsTotal,
	trackingAuthorTicksTotal,
} from '../metrics.js'
import { deliver } from './deliver.js'
import type { TrackingSubscription, TrackingTarget } from './load.js'

const log = createModuleLogger('tracking:author')

export type AuthorProfile = { name: string; avatarUrl?: string }

export async function fetchAuthorProjects(
	kind: AuthorKind,
	authorId: string,
): Promise<Labrinth.Projects.v3.Project[]> {
	if (kind === 'organization') {
		return modrinthClient.labrinth.organizations_v3.getProjects(authorId)
	}
	return modrinthClient.request<Labrinth.Projects.v3.Project[]>(`/user/${authorId}/projects`, {
		api: 'labrinth',
		version: 3,
		method: 'GET',
	})
}

async function fetchAuthorProfile(
	kind: AuthorKind,
	authorId: string,
): Promise<AuthorProfile | undefined> {
	try {
		if (kind === 'organization') {
			const organization = await modrinthClient.labrinth.organizations_v3.get(authorId)
			return { name: organization.name, avatarUrl: organization.icon_url ?? undefined }
		}
		const user = await modrinthClient.labrinth.users_v3.get(authorId)
		return { name: user.username, avatarUrl: user.avatar_url ?? undefined }
	} catch (err) {
		log.warn({ err, kind, authorId }, 'Failed to fetch author profile')
		return undefined
	}
}

async function announceAndTrack(
	client: Client,
	target: TrackingTarget,
	subscription: TrackingSubscription,
	newProjects: Labrinth.Projects.v3.Project[],
	author: AuthorProfile,
): Promise<{ notified: number; autoTracked: number }> {
	let notified = 0
	let autoTracked = 0

	for (const project of newProjects) {
		const outcome = await deliver(
			client,
			subscription,
			[buildNewProjectNotification(project, author)],
			{
				authorId: target.targetId,
				projectId: project.id,
			},
		)
		if (outcome === 'sent') notified += 1

		// No overrides, so editing the author moves every project it discovered at once
		const tracked = await queries.addDiscoveredProject({
			guildId: subscription.guildId,
			targetId: project.id,
			slug: project.slug ?? project.id,
			name: project.name,
			notifiedThrough: new Date(project.updated),
			sourceAuthorId: target.targetId,
		})
		if (tracked) autoTracked += 1
	}

	return { notified, autoTracked }
}

export type AuthorRunStats = {
	tracked: number
	failed: number
	newProjects: number
	notificationsSent: number
	autoTracked: number
}

const EMPTY_STATS: AuthorRunStats = {
	tracked: 0,
	failed: 0,
	newProjects: 0,
	notificationsSent: 0,
	autoTracked: 0,
}

export async function trackAuthorUpdates(
	client: Client,
	targets: TrackingTarget[],
	donatorOnly?: boolean,
): Promise<AuthorRunStats> {
	const donatorLabel = donatorOnly ? 'true' : 'false'
	const stopTimer = trackingAuthorDurationSeconds.startTimer({ supporter: donatorLabel })

	try {
		if (targets.length === 0) {
			trackingAuthorTicksTotal.inc({ supporter: donatorLabel, status: 'success' })
			return EMPTY_STATS
		}

		let newProjectsFound = 0
		let notificationsSent = 0
		let autoTracked = 0
		let failedAuthors = 0

		for (const target of targets) {
			const kind = target.kind as AuthorKind
			let projects: Labrinth.Projects.v3.Project[]
			try {
				projects = await fetchAuthorProjects(kind, target.targetId)
			} catch (err) {
				failedAuthors += 1
				log.error({ authorId: target.targetId, err }, 'Failed to check author')
				continue
			}

			const projectIds = projects.map((p) => p.id)
			let profile: AuthorProfile | undefined

			for (const subscription of target.subscriptions) {
				const known = new Set(subscription.knownProjectIds)
				const newProjects = projects.filter((p) => !known.has(p.id))

				try {
					if (newProjects.length > 0) {
						newProjectsFound += newProjects.length
						profile ??= (await fetchAuthorProfile(kind, target.targetId)) ?? { name: target.name }

						const result = await announceAndTrack(
							client,
							target,
							subscription,
							newProjects,
							profile,
						)
						notificationsSent += result.notified
						autoTracked += result.autoTracked

						log.info(
							{
								authorId: target.targetId,
								slug: target.slug,
								guildId: subscription.guildId,
								newProjects: newProjects.length,
							},
							'New projects discovered',
						)
					}

					// Rewritten only when it moved, which also picks up projects the author has dropped
					if (newProjects.length > 0 || projectIds.length !== subscription.knownProjectIds.length) {
						await queries.setKnownProjects(subscription.id, projectIds)
					}
				} catch (err) {
					failedAuthors += 1
					log.error(
						{ authorId: target.targetId, guildId: subscription.guildId, err },
						'Failed to announce author projects',
					)
				}
			}
		}

		trackingAuthorNotificationsTotal.inc(notificationsSent)
		trackingAuthorAutoTrackedTotal.inc(autoTracked)
		trackingAuthorTicksTotal.inc({ supporter: donatorLabel, status: 'success' })
		return {
			tracked: targets.length,
			failed: failedAuthors,
			newProjects: newProjectsFound,
			notificationsSent,
			autoTracked,
		}
	} catch (err) {
		trackingAuthorTicksTotal.inc({ supporter: donatorLabel, status: 'error' })
		throw err
	} finally {
		stopTimer()
	}
}
