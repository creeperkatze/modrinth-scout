import { DonatorModel } from './schemas/donator.js'
import type { Server } from './schemas/server.js'
import { ServerModel } from './schemas/server.js'
import type { AuthorKind, TrackingEntry, TrackingOverrides } from './schemas/tracking.js'
import { AUTHOR_KINDS, TrackingModel } from './schemas/tracking.js'

export const MAX_TRACKED = 5
export const MAX_TRACKED_DONATOR = 100
export const MAX_TRACKED_AUTHORS = 1
export const MAX_TRACKED_AUTHORS_DONATOR = 10

const AUTHOR_KIND_FILTER = { kind: { $in: [...AUTHOR_KINDS] } }
const PROJECT_KIND_FILTER = { kind: 'project' as const }

export type TrackingCandidateServer = {
	_id: string
	tracking: Server['tracking']
	changelogSummariesEnabled: boolean
}

export type TrackingCandidates = {
	servers: TrackingCandidateServer[]
	entries: (TrackingEntry & { _id: unknown })[]
}

export const queries = {
	getServerConfig: (guildId: string) => ServerModel.findById(guildId).lean(),

	initServerConfig: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $setOnInsert: { _id: guildId } }, { upsert: true }),

	// Patch-style so the manage list's channel and role selects can each move one field alone
	setTrackingDefaults: (
		guildId: string,
		patch: { channelId?: string | null; roleId?: string | null; releaseTypes?: string[] },
	) => {
		const $set: Record<string, unknown> = {}
		if (patch.channelId !== undefined) $set['tracking.channelId'] = patch.channelId
		if (patch.roleId !== undefined) $set['tracking.roleId'] = patch.roleId
		if (patch.releaseTypes !== undefined) $set['tracking.releaseTypes'] = patch.releaseTypes
		return ServerModel.updateOne({ _id: guildId }, { $set }, { upsert: true })
	},

	clearTrackingDefaults: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $unset: { tracking: '' } }, { upsert: false }),

	pauseTracking: (guildId: string) =>
		ServerModel.updateOne(
			{ _id: guildId },
			{ $set: { 'tracking.paused': true } },
			{ upsert: true },
		),

	resumeTracking: (guildId: string) =>
		ServerModel.updateOne(
			{ _id: guildId },
			{ $set: { 'tracking.paused': false } },
			{ upsert: true },
		),

	deleteServer: (guildId: string) =>
		Promise.all([ServerModel.findByIdAndDelete(guildId), TrackingModel.deleteMany({ guildId })]),

	// Only manually added projects, author-discovered ones show under their author instead
	getTrackedProjects: (guildId: string) =>
		TrackingModel.find({ guildId, ...PROJECT_KIND_FILTER, sourceAuthorId: null }).lean(),

	getTrackedAuthors: (guildId: string) =>
		TrackingModel.find({ guildId, ...AUTHOR_KIND_FILTER }).lean(),

	findTrackedEntry: (guildId: string, targetId: string) =>
		TrackingModel.findOne({ guildId, targetId }).lean(),

	countTrackedProjects: (guildId: string) =>
		TrackingModel.countDocuments({ guildId, ...PROJECT_KIND_FILTER, sourceAuthorId: null }),

	countTrackedAuthors: (guildId: string) =>
		TrackingModel.countDocuments({ guildId, ...AUTHOR_KIND_FILTER }),

	countProjectsFromAuthor: (guildId: string, authorId: string) =>
		TrackingModel.countDocuments({ guildId, ...PROJECT_KIND_FILTER, sourceAuthorId: authorId }),

	countProjectsByAuthors: async (
		guildId: string,
		authorIds: string[],
	): Promise<Map<string, number>> => {
		if (authorIds.length === 0) return new Map()
		const results = await TrackingModel.aggregate<{ _id: string; count: number }>([
			{ $match: { guildId, ...PROJECT_KIND_FILTER, sourceAuthorId: { $in: authorIds } } },
			{ $group: { _id: '$sourceAuthorId', count: { $sum: 1 } } },
		])
		return new Map(results.map((r) => [r._id, r.count]))
	},

	// Detaches the project from its source author so it survives that author being untracked
	trackProjectManually: (entry: {
		guildId: string
		targetId: string
		slug: string
		name: string
		notifiedThrough: Date
		overrides: TrackingOverrides
	}) =>
		TrackingModel.findOneAndUpdate(
			{ guildId: entry.guildId, targetId: entry.targetId, kind: 'project' },
			{
				$set: {
					slug: entry.slug,
					name: entry.name,
					sourceAuthorId: null,
					overrides: entry.overrides,
				},
				$setOnInsert: {
					guildId: entry.guildId,
					targetId: entry.targetId,
					kind: 'project',
					notifiedThrough: entry.notifiedThrough,
				},
			},
			{ upsert: true, returnDocument: 'after' },
		).lean(),

	// Atomic insert-if-missing, and no overrides of its own so it inherits from the author entry
	addDiscoveredProject: async (entry: {
		guildId: string
		targetId: string
		slug: string
		name: string
		notifiedThrough: Date
		sourceAuthorId: string
	}): Promise<boolean> => {
		const result = await TrackingModel.updateOne(
			{ guildId: entry.guildId, targetId: entry.targetId, kind: 'project' },
			{ $setOnInsert: { ...entry, kind: 'project', overrides: {} } },
			{ upsert: true },
		)
		return result.upsertedCount > 0
	},

	addTrackedAuthor: (entry: {
		guildId: string
		kind: AuthorKind
		targetId: string
		slug: string
		name: string
		knownProjectIds: string[]
		overrides: TrackingOverrides
	}) => TrackingModel.create({ ...entry, notifiedThrough: new Date() }),

	removeTrackedProject: (guildId: string, targetId: string) =>
		TrackingModel.deleteOne({ guildId, targetId, ...PROJECT_KIND_FILTER }),

	removeTrackedAuthor: (guildId: string, authorId: string) =>
		Promise.all([
			TrackingModel.deleteOne({ guildId, targetId: authorId, ...AUTHOR_KIND_FILTER }),
			TrackingModel.deleteMany({ guildId, ...PROJECT_KIND_FILTER, sourceAuthorId: authorId }),
		]),

	removeAllTracking: (guildId: string) => TrackingModel.deleteMany({ guildId }),

	// Raw rows for one tracking tick, resolved into targets by utils/tracking/load.ts
	getTrackingCandidates: async (donatorOnly?: boolean): Promise<TrackingCandidates> => {
		const servers = await ServerModel.find({
			'tracking.paused': { $ne: true },
			...(donatorOnly !== undefined ? { isDonator: donatorOnly } : {}),
		})
			.select('_id tracking changelogSummariesEnabled')
			.lean<TrackingCandidateServer[]>()

		if (servers.length === 0) return { servers: [], entries: [] }

		const entries = await TrackingModel.find({
			guildId: { $in: servers.map((server) => server._id) },
		}).lean()

		return { servers, entries }
	},

	advanceNotifiedThrough: (id: unknown, notifiedThrough: Date) =>
		TrackingModel.updateOne({ _id: id }, { $set: { notifiedThrough } }),

	setKnownProjects: (id: unknown, knownProjectIds: string[]) =>
		TrackingModel.updateOne({ _id: id }, { $set: { knownProjectIds } }),

	countAllTrackedProjects: () => TrackingModel.countDocuments(PROJECT_KIND_FILTER),

	countUniqueTrackedProjects: () =>
		TrackingModel.distinct('targetId', PROJECT_KIND_FILTER).then((ids) => ids.length),

	countAllTrackedAuthors: () => TrackingModel.countDocuments(AUTHOR_KIND_FILTER),

	countConfiguredServers: () => ServerModel.countDocuments(),

	countDonatorServers: () => ServerModel.countDocuments({ isDonator: true }),

	createDonation: (data: {
		discordUserId: string | null
		email: string
		transactionId: string
		showPublicly?: boolean
	}) => DonatorModel.create(data),

	getPublicDonators: () =>
		DonatorModel.find({
			discordUserId: { $ne: null },
			usedByGuildId: { $ne: null },
			showPublicly: true,
		})
			.sort({ createdAt: 1 })
			.select('discordUserId usedByGuildId')
			.lean(),

	activateByUserId: async (
		discordUserId: string,
		guildId: string,
		showPublicly = true,
	): Promise<'ok' | 'not_found' | 'already_used' | 'already_active'> => {
		const server = await ServerModel.findById(guildId).select('isDonator').lean()
		if (server?.isDonator) {
			return 'already_active'
		}

		const entry = await DonatorModel.findOneAndUpdate(
			{ discordUserId, usedByGuildId: null },
			{ $set: { usedByGuildId: guildId, showPublicly: showPublicly } },
			{ returnDocument: 'after' },
		)
		if (!entry) {
			const used = await DonatorModel.findOne({ discordUserId })
			return used ? 'already_used' : 'not_found'
		}
		await ServerModel.updateOne({ _id: guildId }, { $set: { isDonator: true } }, { upsert: true })
		return 'ok'
	},

	setAutoEmbeds: (guildId: string, enabled: boolean) =>
		ServerModel.updateOne(
			{ _id: guildId },
			{ $set: { autoEmbedsEnabled: enabled } },
			{ upsert: true },
		),

	setChangelogSummaries: (guildId: string, enabled: boolean) =>
		ServerModel.updateOne(
			{ _id: guildId },
			{ $set: { changelogSummariesEnabled: enabled } },
			{ upsert: true },
		),

	setJarIdentify: (guildId: string, enabled: boolean) =>
		ServerModel.updateOne(
			{ _id: guildId },
			{ $set: { jarIdentifyEnabled: enabled } },
			{ upsert: true },
		),
}
