import { InferSchemaType, model, Schema } from 'mongoose'

import { RELEASE_TYPES } from './tracking.js'

// Bottom layer of the settings chain in utils/tracking/settings.ts
const trackingDefaultsSchema = new Schema(
	{
		channelId: { type: String, default: null },
		roleId: { type: String, default: null },
		releaseTypes: { type: [String], default: () => [...RELEASE_TYPES] },
		paused: { type: Boolean, default: false },
	},
	{ _id: false },
)

export const GUILD_OPTIONS = ['autoEmbeds', 'jarIdentify', 'changelogSummaries'] as const
export type GuildOption = (typeof GUILD_OPTIONS)[number]

const optionsSchema = new Schema(
	{
		autoEmbeds: { type: Boolean, default: false },
		jarIdentify: { type: Boolean, default: false },
		changelogSummaries: { type: Boolean, default: false },
	},
	{ _id: false },
)

const teamTargetSchema = new Schema(
	{
		id: { type: String, required: true },
		slug: { type: String, required: true },
		name: { type: String, required: true },
	},
	{ _id: false },
)

// One rule per role. Every condition is optional and all set ones must hold, a rule without any
// only needs a linked Modrinth account. Evaluated in utils/roles.ts
const roleRuleSchema = new Schema(
	{
		roleId: { type: String, required: true },
		// Accepted team membership
		project: { type: teamTargetSchema, default: null },
		organization: { type: teamTargetSchema, default: null },
		// Summed over every project the user is a team member of
		minDownloads: { type: Number, default: null },
		minProjects: { type: Number, default: null },
		minFollowers: { type: Number, default: null },
		projectType: { type: String, default: null },
		// A key from BADGE_LABELS in utils/embeds/user.ts
		badge: { type: String, default: null },
		minAccountAgeDays: { type: Number, default: null },
	},
	{ _id: false },
)

const guildSchema = new Schema(
	{
		_id: { type: String },
		name: { type: String, default: null },
		memberCount: { type: Number, default: 0 },
		isDonator: { type: Boolean, default: false },
		voteRewardExpiresAt: { type: Date, default: null },
		tracking: { type: trackingDefaultsSchema, default: () => ({}) },
		options: { type: optionsSchema, default: () => ({}) },
		roles: { type: [roleRuleSchema], default: () => [] },
	},
	{ collection: 'guilds', timestamps: true },
)

export type RoleRule = InferSchemaType<typeof roleRuleSchema>
export type GuildConfig = InferSchemaType<typeof guildSchema>
export const GuildConfigModel = model('GuildConfig', guildSchema)
