import type { ProjectWithChannel } from './schemas/project.js'
import { ProjectModel } from './schemas/project.js'
import { ServerModel } from './schemas/server.js'
import { SupporterModel } from './schemas/supporter.js'

export const MAX_TRACKED_PER_GUILD = 5
export const MAX_TRACKED_SUPPORTER = 100

export const queries = {
	getServerConfig: (guildId: string) => ServerModel.findById(guildId).lean(),

	initServerConfig: (guildId: string) =>
		ServerModel.updateOne({ _id: guildId }, { $setOnInsert: { _id: guildId } }, { upsert: true }),

	setServerConfig: (
		guildId: string,
		channelId: string,
		configuredBy: string,
		roleId?: string | null,
	) =>
		ServerModel.findByIdAndUpdate(
			guildId,
			{ $set: { channelId, configuredBy, roleId: roleId ?? null } },
			{ returnDocument: 'after' },
		),

	deleteServer: (guildId: string) =>
		Promise.all([ServerModel.findByIdAndDelete(guildId), ProjectModel.deleteMany({ guildId })]),

	getTrackedProjects: (guildId: string) => ProjectModel.find({ guildId }).lean(),

	countTrackedProjects: (guildId: string) => ProjectModel.countDocuments({ guildId }),

	addTrackedProject: (
		guildId: string,
		projectId: string,
		slug: string,
		name: string,
		lastUpdated: string,
		addedBy: string,
	) => ProjectModel.create({ guildId, projectId, slug, name, lastUpdated, addedBy }),

	removeTrackedProject: (guildId: string, projectId: string) =>
		ProjectModel.deleteOne({ guildId, projectId }),

	getAllTrackedWithConfig: () =>
		ProjectModel.aggregate<ProjectWithChannel>([
			{
				$lookup: {
					from: 'servers',
					localField: 'guildId',
					foreignField: '_id',
					as: 'config',
				},
			},
			{ $unwind: '$config' },
			{ $set: { channelId: '$config.channelId', roleId: '$config.roleId' } },
			{ $unset: 'config' },
		]),

	updateLastUpdated: (projectId: string, lastUpdated: string) =>
		ProjectModel.updateMany({ projectId }, { $set: { lastUpdated } }),

	removeAllTrackedProjects: (guildId: string) => ProjectModel.deleteMany({ guildId }),

	removeServerConfig: (guildId: string) => ServerModel.findByIdAndDelete(guildId),

	countAllTrackedProjects: () => ProjectModel.countDocuments(),

	countUniqueTrackedProjects: () => ProjectModel.distinct('projectId').then((ids) => ids.length),

	countConfiguredServers: () => ServerModel.countDocuments(),

	createDonation: (data: { discordUserId: string | null; email: string; transactionId: string }) =>
		SupporterModel.create(data),

	activateByUserId: async (
		discordUserId: string,
		guildId: string,
	): Promise<'ok' | 'not_found' | 'already_used'> => {
		const entry = await SupporterModel.findOne({ discordUserId, usedByGuildId: null })
		if (!entry) {
			const used = await SupporterModel.findOne({ discordUserId })
			return used ? 'already_used' : 'not_found'
		}
		await Promise.all([
			SupporterModel.updateOne({ _id: entry._id }, { usedByGuildId: guildId }),
			ServerModel.updateOne({ _id: guildId }, { $set: { isSupporter: true } }, { upsert: true }),
		])
		return 'ok'
	},
}
