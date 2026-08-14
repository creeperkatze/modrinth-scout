import { VOTE_REWARD_DURATION_MS } from '../config/voteRewards.js'
import { DonatorModel } from './schemas/donator.js'
import type { GuildConfig, GuildOption } from './schemas/guild.js'
import { GuildConfigModel } from './schemas/guild.js'
import type { AuthorKind, TrackingEntry, TrackingOverrides } from './schemas/tracking.js'
import { AUTHOR_KINDS, TrackingModel } from './schemas/tracking.js'
import { VoteLinkModel } from './schemas/voteLink.js'

export const MAX_TRACKED = 5
export const MAX_TRACKED_DONATOR = 100
export const MAX_TRACKED_AUTHORS = 1
export const MAX_TRACKED_AUTHORS_DONATOR = 10

export function hasActivePerks(
	config: Pick<GuildConfig, 'isDonator' | 'voteRewardExpiresAt'> | null | undefined,
): boolean {
	if (!config) return false
	if (config.isDonator) return true
	return Boolean(config.voteRewardExpiresAt && config.voteRewardExpiresAt.getTime() > Date.now())
}

const AUTHOR_KIND_FILTER = { kind: { $in: [...AUTHOR_KINDS] } }
const PROJECT_KIND_FILTER = { kind: 'project' as const }

export type TrackingCandidateGuild = {
	_id: string
	tracking: GuildConfig['tracking']
	options: GuildConfig['options']
}

export type TrackingCandidates = {
	guilds: TrackingCandidateGuild[]
	entries: (TrackingEntry & { _id: unknown })[]
}

export const queries = {
	getGuildConfig: (guildId: string) => GuildConfigModel.findById(guildId).lean(),

	initGuildConfig: (guildId: string, name: string, memberCount: number) =>
		GuildConfigModel.updateOne(
			{ _id: guildId },
			{ $set: { name, memberCount }, $setOnInsert: { _id: guildId } },
			{ upsert: true },
		),

	// Patch-style so the manage list's channel and role selects can each move one field alone
	setTrackingDefaults: (
		guildId: string,
		patch: { channelId?: string | null; roleId?: string | null; releaseTypes?: string[] },
	) => {
		const $set: Record<string, unknown> = {}
		if (patch.channelId !== undefined) $set['tracking.channelId'] = patch.channelId
		if (patch.roleId !== undefined) $set['tracking.roleId'] = patch.roleId
		if (patch.releaseTypes !== undefined) $set['tracking.releaseTypes'] = patch.releaseTypes
		return GuildConfigModel.updateOne({ _id: guildId }, { $set }, { upsert: true })
	},

	clearTrackingDefaults: (guildId: string) =>
		GuildConfigModel.updateOne({ _id: guildId }, { $unset: { tracking: '' } }, { upsert: false }),

	pauseTracking: (guildId: string) =>
		GuildConfigModel.updateOne(
			{ _id: guildId },
			{ $set: { 'tracking.paused': true } },
			{ upsert: true },
		),

	resumeTracking: (guildId: string) =>
		GuildConfigModel.updateOne(
			{ _id: guildId },
			{ $set: { 'tracking.paused': false } },
			{ upsert: true },
		),

	deleteGuild: (guildId: string) =>
		Promise.all([
			GuildConfigModel.findByIdAndDelete(guildId),
			TrackingModel.deleteMany({ guildId }),
			VoteLinkModel.deleteMany({ guildId }),
		]),

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
		const now = new Date()
		const perksFilter =
			donatorOnly === true
				? { $or: [{ isDonator: true }, { voteRewardExpiresAt: { $gt: now } }] }
				: donatorOnly === false
					? {
							isDonator: false,
							$or: [{ voteRewardExpiresAt: null }, { voteRewardExpiresAt: { $lte: now } }],
						}
					: {}

		const guilds = await GuildConfigModel.find({
			'tracking.paused': { $ne: true },
			...perksFilter,
		})
			.select('_id tracking options')
			.lean<TrackingCandidateGuild[]>()

		if (guilds.length === 0) return { guilds: [], entries: [] }

		const entries = await TrackingModel.find({
			guildId: { $in: guilds.map((guild) => guild._id) },
		}).lean()

		return { guilds, entries }
	},

	advanceNotifiedThrough: (id: unknown, notifiedThrough: Date) =>
		TrackingModel.updateOne({ _id: id }, { $set: { notifiedThrough } }),

	setKnownProjects: (id: unknown, knownProjectIds: string[]) =>
		TrackingModel.updateOne({ _id: id }, { $set: { knownProjectIds } }),

	countAllTrackedProjects: () => TrackingModel.countDocuments(PROJECT_KIND_FILTER),

	countUniqueTrackedProjects: () =>
		TrackingModel.distinct('targetId', PROJECT_KIND_FILTER).then((ids) => ids.length),

	countAllTrackedAuthors: () => TrackingModel.countDocuments(AUTHOR_KIND_FILTER),

	countConfiguredGuilds: () => GuildConfigModel.countDocuments(),

	countDonatorGuilds: () => GuildConfigModel.countDocuments({ isDonator: true }),

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
		const guild = await GuildConfigModel.findById(guildId).select('isDonator').lean()
		if (guild?.isDonator) {
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
		await GuildConfigModel.updateOne(
			{ _id: guildId },
			{ $set: { isDonator: true } },
			{ upsert: true },
		)
		return 'ok'
	},

	setOption: (guildId: string, option: GuildOption, enabled: boolean) =>
		GuildConfigModel.updateOne(
			{ _id: guildId },
			{ $set: { [`options.${option}`]: enabled } },
			{ upsert: true },
		),

	// One voter can only boost one guild at a time, re-linking overwrites the previous guild
	linkVote: (discordUserId: string, guildId: string) =>
		VoteLinkModel.findOneAndUpdate({ discordUserId }, { $set: { guildId } }, { upsert: true }),

	// Returns the boosted guild id, or null if this voter hasn't linked one
	extendVoteReward: async (discordUserId: string): Promise<string | null> => {
		const link = await VoteLinkModel.findOne({ discordUserId }).lean()
		if (!link) return null

		await GuildConfigModel.updateOne(
			{ _id: link.guildId },
			{ $set: { voteRewardExpiresAt: new Date(Date.now() + VOTE_REWARD_DURATION_MS) } },
		)
		return link.guildId
	},
}
