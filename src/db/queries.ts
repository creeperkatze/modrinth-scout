import type { TrackedProjectWithChannel } from './schema.js'
import { ServerConfigModel, SupporterDonationModel, TrackedProjectModel } from './schema.js'

export const MAX_TRACKED_PER_GUILD = 5
export const MAX_TRACKED_SUPPORTER = 100

export const queries = {
	getServerConfig: (guildId: string) => ServerConfigModel.findById(guildId).lean(),

	setServerConfig: (
		guildId: string,
		channelId: string,
		configuredBy: string,
		roleId?: string | null,
	) =>
		ServerConfigModel.findByIdAndUpdate(
			guildId,
			{ channelId, configuredBy, roleId: roleId ?? null },
			{ upsert: true, returnDocument: 'after' },
		),

	getTrackedProjects: (guildId: string) => TrackedProjectModel.find({ guildId }).lean(),

	countTrackedProjects: (guildId: string) => TrackedProjectModel.countDocuments({ guildId }),

	addTrackedProject: (
		guildId: string,
		projectId: string,
		slug: string,
		name: string,
		lastUpdated: string,
		addedBy: string,
	) => TrackedProjectModel.create({ guildId, projectId, slug, name, lastUpdated, addedBy }),

	removeTrackedProject: (guildId: string, projectId: string) =>
		TrackedProjectModel.deleteOne({ guildId, projectId }),

	getAllTrackedWithConfig: () =>
		TrackedProjectModel.aggregate<TrackedProjectWithChannel>([
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
		TrackedProjectModel.updateMany({ projectId }, { $set: { lastUpdated } }),

	removeAllTrackedProjects: (guildId: string) => TrackedProjectModel.deleteMany({ guildId }),

	removeServerConfig: (guildId: string) => ServerConfigModel.findByIdAndDelete(guildId),

	countAllTrackedProjects: () => TrackedProjectModel.countDocuments(),

	countUniqueTrackedProjects: () =>
		TrackedProjectModel.distinct('projectId').then((ids) => ids.length),

	countConfiguredServers: () => ServerConfigModel.countDocuments(),

	createDonation: (data: { discordUserId: string | null; email: string; transactionId: string }) =>
		SupporterDonationModel.create(data),

	activateByUserId: async (
		discordUserId: string,
		guildId: string,
	): Promise<'ok' | 'not_found' | 'already_used'> => {
		const entry = await SupporterDonationModel.findOne({ discordUserId, usedByGuildId: null })
		if (!entry) {
			const used = await SupporterDonationModel.findOne({ discordUserId })
			return used ? 'already_used' : 'not_found'
		}
		await Promise.all([
			SupporterDonationModel.updateOne({ _id: entry._id }, { usedByGuildId: guildId }),
			ServerConfigModel.updateOne({ _id: guildId }, { isSupporter: true }),
		])
		return 'ok'
	},
}
