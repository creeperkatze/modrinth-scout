import type { ITrackedProjectWithChannel } from './schema.js'
import { ServerConfig, TrackedProject } from './schema.js'

export const MAX_TRACKED_PER_GUILD = 100

export const queries = {
	getServerConfig: (guildId: string) => ServerConfig.findById(guildId).lean(),

	setServerConfig: (guildId: string, channelId: string, configuredBy: string) =>
		ServerConfig.findByIdAndUpdate(
			guildId,
			{ channelId, configuredBy },
			{ upsert: true, returnDocument: 'after' },
		),

	getTrackedProjects: (guildId: string) => TrackedProject.find({ guildId }).lean(),

	countTrackedProjects: (guildId: string) => TrackedProject.countDocuments({ guildId }),

	addTrackedProject: (
		guildId: string,
		projectId: string,
		slug: string,
		name: string,
		lastUpdated: string,
		addedBy: string,
	) => TrackedProject.create({ guildId, projectId, slug, name, lastUpdated, addedBy }),

	removeTrackedProject: (guildId: string, projectId: string) =>
		TrackedProject.deleteOne({ guildId, projectId }),

	getAllTrackedWithConfig: () =>
		TrackedProject.aggregate<ITrackedProjectWithChannel>([
			{
				$lookup: {
					from: 'servers',
					localField: 'guildId',
					foreignField: '_id',
					as: 'config',
				},
			},
			{ $unwind: '$config' },
			{ $set: { channelId: '$config.channelId' } },
			{ $unset: 'config' },
		]),

	updateLastUpdated: (projectId: string, lastUpdated: string) =>
		TrackedProject.updateMany({ projectId }, { $set: { lastUpdated } }),
}
