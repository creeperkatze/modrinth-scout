import { and, eq } from 'drizzle-orm'

import { db } from './index.js'
import { serverConfigs, trackedProjects } from './schema.js'

export const MAX_TRACKED_PER_GUILD = 25

export const queries = {
	getServerConfig: (guildId: string) =>
		db.select().from(serverConfigs).where(eq(serverConfigs.guildId, guildId)).get(),

	setServerConfig: (guildId: string, channelId: string, configuredBy: string) =>
		db
			.insert(serverConfigs)
			.values({ guildId, channelId, configuredBy, configuredAt: Date.now() })
			.onConflictDoUpdate({
				target: serverConfigs.guildId,
				set: { channelId, configuredBy, configuredAt: Date.now() },
			})
			.run(),

	getTrackedProjects: (guildId: string) =>
		db.select().from(trackedProjects).where(eq(trackedProjects.guildId, guildId)).all(),

	countTrackedProjects: (guildId: string) =>
		db.select().from(trackedProjects).where(eq(trackedProjects.guildId, guildId)).all().length,

	addTrackedProject: (
		guildId: string,
		projectId: string,
		slug: string,
		name: string,
		lastUpdated: string,
		addedBy: string,
	) =>
		db
			.insert(trackedProjects)
			.values({ guildId, projectId, slug, name, lastUpdated, addedBy, addedAt: Date.now() })
			.run(),

	removeTrackedProject: (guildId: string, projectId: string) =>
		db
			.delete(trackedProjects)
			.where(and(eq(trackedProjects.guildId, guildId), eq(trackedProjects.projectId, projectId)))
			.run(),

	getAllTrackedWithConfig: () =>
		db
			.select({
				guildId: trackedProjects.guildId,
				projectId: trackedProjects.projectId,
				slug: trackedProjects.slug,
				name: trackedProjects.name,
				lastUpdated: trackedProjects.lastUpdated,
				channelId: serverConfigs.channelId,
			})
			.from(trackedProjects)
			.innerJoin(serverConfigs, eq(trackedProjects.guildId, serverConfigs.guildId))
			.all(),

	updateLastUpdated: (projectId: string, lastUpdated: string) =>
		db
			.update(trackedProjects)
			.set({ lastUpdated })
			.where(eq(trackedProjects.projectId, projectId))
			.run(),
}
