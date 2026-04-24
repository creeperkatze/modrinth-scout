import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

export const serverConfigs = sqliteTable('server_configs', {
	guildId: text('guild_id').primaryKey(),
	channelId: text('channel_id').notNull(),
	configuredBy: text('configured_by').notNull(),
	configuredAt: integer('configured_at').notNull(),
})

export const trackedProjects = sqliteTable(
	'tracked_projects',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		guildId: text('guild_id').notNull(),
		projectId: text('project_id').notNull(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		lastUpdated: text('last_updated').notNull(),
		addedBy: text('added_by').notNull(),
		addedAt: integer('added_at').notNull(),
	},
	(t) => [unique().on(t.guildId, t.projectId)],
)
