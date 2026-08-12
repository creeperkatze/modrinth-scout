import { queries } from '../../db/queries.js'
import type { TrackingKind, TrackingOverrides } from '../../db/schemas/tracking.js'
import { isAuthorKind } from '../../db/schemas/tracking.js'
import type { TrackingSettings } from './settings.js'
import { resolveTrackingSettings } from './settings.js'

// One guild's subscription to a target, with its settings already resolved down the chain
export type TrackingSubscription = {
	id: unknown
	guildId: string
	notifiedThrough: Date
	knownProjectIds: string[]
	changelogSummaries: boolean
	settings: TrackingSettings & { channelId: string }
}

// A Modrinth entity plus every guild waiting on it, so the API is hit once however many track it
export type TrackingTarget = {
	kind: TrackingKind
	targetId: string
	slug: string
	name: string
	subscriptions: TrackingSubscription[]
}

export type TrackingBatch = {
	projects: TrackingTarget[]
	authors: TrackingTarget[]
	entryCount: number
}

// Resolves every entry against its author and guild defaults, drops those with nowhere to post
export async function loadTrackingBatch(donatorOnly?: boolean): Promise<TrackingBatch> {
	const { guilds, entries } = await queries.getTrackingCandidates(donatorOnly)
	if (entries.length === 0) return { projects: [], authors: [], entryCount: 0 }

	const guildById = new Map(guilds.map((guild) => [guild._id, guild]))

	// Middle layer of the chain, the author entry a discovered project inherits from
	const authorOverrides = new Map<string, TrackingOverrides>()
	for (const entry of entries) {
		if (isAuthorKind(entry.kind as TrackingKind)) {
			authorOverrides.set(`${entry.guildId}:${entry.targetId}`, entry.overrides ?? {})
		}
	}

	const byTarget = new Map<string, TrackingTarget>()
	let entryCount = 0

	for (const entry of entries) {
		const guild = guildById.get(entry.guildId)
		if (!guild) continue

		const parentOverrides = entry.sourceAuthorId
			? authorOverrides.get(`${entry.guildId}:${entry.sourceAuthorId}`)
			: undefined

		const settings = resolveTrackingSettings(entry.overrides, parentOverrides, guild.tracking)
		if (!settings.channelId) continue

		const kind = entry.kind as TrackingKind
		const key = `${kind}:${entry.targetId}`
		const target = byTarget.get(key)
		const subscription: TrackingSubscription = {
			id: entry._id,
			guildId: entry.guildId,
			notifiedThrough: entry.notifiedThrough,
			knownProjectIds: entry.knownProjectIds ?? [],
			changelogSummaries: Boolean(guild.options?.changelogSummaries),
			settings: { ...settings, channelId: settings.channelId },
		}
		entryCount += 1

		if (target) {
			target.subscriptions.push(subscription)
		} else {
			byTarget.set(key, {
				kind,
				targetId: entry.targetId,
				slug: entry.slug,
				name: entry.name,
				subscriptions: [subscription],
			})
		}
	}

	const projects: TrackingTarget[] = []
	const authors: TrackingTarget[] = []
	for (const target of byTarget.values()) {
		if (isAuthorKind(target.kind)) authors.push(target)
		else projects.push(target)
	}

	return { projects, authors, entryCount }
}
