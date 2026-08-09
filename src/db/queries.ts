import type { TrackedAuthorWithChannel } from './schemas/author.js'
import { AuthorModel } from './schemas/author.js'
import type { ProjectWithChannel } from './schemas/project.js'
import { ProjectModel } from './schemas/project.js'
import type { Server } from './schemas/server.js'
import { ServerModel } from './schemas/server.js'
import { SupporterModel } from './schemas/supporter.js'

export const MAX_TRACKED = 5
export const MAX_TRACKED_SUPPORTER = 100
export const MAX_TRACKED_AUTHORS = 1
export const MAX_TRACKED_AUTHORS_SUPPORTER = 10

type ServerPollingConfig = {
	_id: string
	trackingChannelId: string
	trackingRoleId: Server['trackingRoleId']
	changelogSummariesEnabled: boolean
}

export const queries = {
	getServerConfig: (guildId: string) => ServerModel.findById(guildId).lean(),

	initServerConfig: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $setOnInsert: { _id: guildId } }, { upsert: true }),

	setServerConfig: (guildId: string, trackingChannelId: string, trackingRoleId?: string | null) =>
		ServerModel.findByIdAndUpdate(
			guildId,
			{
				$set: {
					trackingChannelId,
					trackingRoleId: trackingRoleId ?? null,
				},
			},
			{ returnDocument: 'after', upsert: true },
		),

	setTrackingRole: (guildId: string, roleId: string | null) =>
		ServerModel.updateOne({ _id: guildId }, { $set: { trackingRoleId: roleId } }, { upsert: true }),

	deleteServer: (guildId: string) =>
		Promise.all([
			ServerModel.findByIdAndDelete(guildId),
			ProjectModel.deleteMany({ guildId }),
			AuthorModel.deleteMany({ guildId }),
		]),

	getTrackedProjects: (guildId: string) => ProjectModel.find({ guildId }).lean(),

	findTrackedProjectById: (guildId: string, projectId: string) =>
		ProjectModel.findOne({ guildId, projectId }).lean(),

	countTrackedProjects: (guildId: string) => ProjectModel.countDocuments({ guildId }),

	addTrackedProject: (
		guildId: string,
		projectId: string,
		slug: string,
		name: string,
		lastUpdated: Date,
		releaseType?: string[],
		channelId?: string | null,
		roleId?: string | null,
	) =>
		ProjectModel.create({
			guildId,
			projectId,
			slug,
			name,
			lastUpdated,
			releaseType,
			channelId: channelId ?? null,
			roleId: roleId ?? null,
		}),

	removeTrackedProject: (guildId: string, projectId: string) =>
		ProjectModel.deleteOne({ guildId, projectId }),

	getPollingProjects: async (supporterOnly?: boolean): Promise<ProjectWithChannel[]> => {
		const servers = await ServerModel.find({
			trackingPaused: { $ne: true },
			trackingChannelId: { $ne: null },
			...(supporterOnly !== undefined ? { isSupporter: supporterOnly } : {}),
		})
			.select('_id trackingChannelId trackingRoleId changelogSummariesEnabled')
			.lean<ServerPollingConfig[]>()

		if (servers.length === 0) {
			return []
		}

		const serverConfigByGuildId = new Map(servers.map((server) => [server._id, server]))
		const projects = await ProjectModel.find({
			guildId: { $in: servers.map((server) => server._id) },
		}).lean()

		return projects.flatMap((project) => {
			const config = serverConfigByGuildId.get(project.guildId)
			if (!config) {
				return []
			}

			const channelId = project.channelId ?? config.trackingChannelId
			if (!channelId) {
				return []
			}

			return [
				{
					...project,
					channelId,
					roleId: project.roleId ?? config.trackingRoleId,
					changelogSummariesEnabled: config.changelogSummariesEnabled,
				},
			]
		})
	},

	updateLastUpdated: (projectId: string, lastUpdated: Date, guildIds: string[]) =>
		ProjectModel.updateMany({ projectId, guildId: { $in: guildIds } }, { $set: { lastUpdated } }),

	removeAllTrackedProjects: (guildId: string) => ProjectModel.deleteMany({ guildId }),

	getTrackedAuthors: (guildId: string) => AuthorModel.find({ guildId }).lean(),

	findTrackedAuthorById: (guildId: string, authorId: string) =>
		AuthorModel.findOne({ guildId, authorId }).lean(),

	countTrackedAuthors: (guildId: string) => AuthorModel.countDocuments({ guildId }),

	addTrackedAuthor: (
		guildId: string,
		authorId: string,
		authorType: 'user' | 'organization',
		username: string,
		name: string,
		knownProjectIds: string[],
		channelId?: string | null,
		roleId?: string | null,
	) =>
		AuthorModel.create({
			guildId,
			authorId,
			authorType,
			username,
			name,
			knownProjectIds,
			channelId: channelId ?? null,
			roleId: roleId ?? null,
		}),

	removeTrackedAuthor: (guildId: string, authorId: string) =>
		AuthorModel.deleteOne({ guildId, authorId }),

	getPollingAuthors: async (supporterOnly?: boolean): Promise<TrackedAuthorWithChannel[]> => {
		const servers = await ServerModel.find({
			trackingPaused: { $ne: true },
			trackingChannelId: { $ne: null },
			...(supporterOnly !== undefined ? { isSupporter: supporterOnly } : {}),
		})
			.select('_id trackingChannelId trackingRoleId')
			.lean<Pick<ServerPollingConfig, '_id' | 'trackingChannelId' | 'trackingRoleId'>[]>()

		if (servers.length === 0) {
			return []
		}

		const serverConfigByGuildId = new Map(servers.map((server) => [server._id, server]))
		const authors = await AuthorModel.find({
			guildId: { $in: servers.map((server) => server._id) },
		}).lean()

		return authors.flatMap((author) => {
			const config = serverConfigByGuildId.get(author.guildId)
			if (!config) {
				return []
			}

			const channelId = author.channelId ?? config.trackingChannelId
			if (!channelId) {
				return []
			}

			return [
				{
					...author,
					channelId,
					roleId: author.roleId ?? config.trackingRoleId,
				},
			]
		})
	},

	updateKnownProjects: (authorId: string, projectIds: string[], guildIds: string[]) =>
		AuthorModel.updateMany(
			{ authorId, guildId: { $in: guildIds } },
			{ $set: { knownProjectIds: projectIds } },
		),

	removeAllTrackedAuthors: (guildId: string) => AuthorModel.deleteMany({ guildId }),

	clearTrackingConfig: (guildId: string) =>
		ServerModel.updateOne(
			{ _id: guildId },
			{
				$set: {
					trackingChannelId: null,
					trackingRoleId: null,
					trackingPaused: false,
				},
			},
		),

	pauseTracking: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $set: { trackingPaused: true } }),

	resumeTracking: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $set: { trackingPaused: false } }),

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

	countAllTrackedProjects: () => ProjectModel.countDocuments(),

	countUniqueTrackedProjects: () => ProjectModel.distinct('projectId').then((ids) => ids.length),

	countAllTrackedAuthors: () => AuthorModel.countDocuments(),

	countConfiguredServers: () => ServerModel.countDocuments(),

	createDonation: (data: {
		discordUserId: string | null
		email: string
		transactionId: string
		showPublicly?: boolean
	}) => SupporterModel.create(data),

	getPublicSupporters: () =>
		SupporterModel.find({
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
		const server = await ServerModel.findById(guildId).select('isSupporter').lean()
		if (server?.isSupporter) {
			return 'already_active'
		}

		const entry = await SupporterModel.findOneAndUpdate(
			{ discordUserId, usedByGuildId: null },
			{ $set: { usedByGuildId: guildId, showPublicly: showPublicly } },
			{ returnDocument: 'after' },
		)
		if (!entry) {
			const used = await SupporterModel.findOne({ discordUserId })
			return used ? 'already_used' : 'not_found'
		}
		await ServerModel.updateOne({ _id: guildId }, { $set: { isSupporter: true } }, { upsert: true })
		return 'ok'
	},
}
