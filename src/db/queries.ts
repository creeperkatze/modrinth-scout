import type { ITrackedProjectWithChannel } from './schema.js'
import { ServerConfig, TrackedProject } from './schema.js'

export const MAX_TRACKED_PER_GUILD = 25

export const queries = {
	getServerConfig: (guildId: string) => ServerConfig.findById(guildId).lean(),

	setServerConfig: (guildId: string, channelId: string, configuredBy: string) =>
		ServerConfig.findByIdAndUpdate(
			guildId,
			{ channelId, configuredBy, configuredAt: new Date() },
			{ upsert: true, new: true },
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
	) =>
		TrackedProject.create({
			guildId,
			projectId,
			slug,
			name,
			lastUpdated,
			addedBy,
			addedAt: new Date(),
		}),

	removeTrackedProject: (guildId: string, projectId: string) =>
		TrackedProject.deleteOne({ guildId, projectId }),

	// Mongoose lowercases and pluralises model names for collection lookups
	getAllTrackedWithConfig: () =>
		TrackedProject.aggregate<ITrackedProjectWithChannel>([
			{
				$lookup: {
					from: 'serverconfigs',
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
