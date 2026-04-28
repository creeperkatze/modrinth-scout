import type { ProjectWithChannel } from './schemas/project.js'
import { ProjectModel } from './schemas/project.js'
import type { Server } from './schemas/server.js'
import { ServerModel } from './schemas/server.js'
import { SupporterModel } from './schemas/supporter.js'

export const MAX_TRACKED_PER_GUILD = 5
export const MAX_TRACKED_SUPPORTER = 100

type ServerPollingConfig = {
	_id: string
	trackingChannelId: string
	trackingRoleId: Server['trackingRoleId']
}

export const queries = {
	getServerConfig: (guildId: string) => ServerModel.findById(guildId).lean(),

	initServerConfig: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $setOnInsert: { _id: guildId } }, { upsert: true }),

	setServerConfig: (guildId: string, channelId: string, roleId?: string | null) =>
		ServerModel.findByIdAndUpdate(
			guildId,
			{ $set: { trackingChannelId: channelId, trackingRoleId: roleId ?? null } },
			{ returnDocument: 'after' },
		),

	deleteServer: (guildId: string) =>
		Promise.all([ServerModel.findByIdAndDelete(guildId), ProjectModel.deleteMany({ guildId })]),

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
			.select('_id trackingChannelId trackingRoleId')
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
				},
			]
		})
	},

	updateLastUpdated: (projectId: string, lastUpdated: Date, guildIds: string[]) =>
		ProjectModel.updateMany({ projectId, guildId: { $in: guildIds } }, { $set: { lastUpdated } }),

	removeAllTrackedProjects: (guildId: string) => ProjectModel.deleteMany({ guildId }),

	removeServerConfig: (guildId: string) => ServerModel.findByIdAndDelete(guildId),

	pauseTracking: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $set: { trackingPaused: true } }),

	resumeTracking: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $set: { trackingPaused: false } }),

	countAllTrackedProjects: () => ProjectModel.countDocuments(),

	countUniqueTrackedProjects: () => ProjectModel.distinct('projectId').then((ids) => ids.length),

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

		const entry = await SupporterModel.findOne({ discordUserId, usedByGuildId: null })
		if (!entry) {
			const used = await SupporterModel.findOne({ discordUserId })
			return used ? 'already_used' : 'not_found'
		}
		await Promise.all([
			SupporterModel.updateOne(
				{ _id: entry._id },
				{ usedByGuildId: guildId, showPublicly: showPublicly },
			),
			ServerModel.updateOne({ _id: guildId }, { $set: { isSupporter: true } }, { upsert: true }),
		])
		return 'ok'
	},
}
