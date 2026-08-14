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

const guildSchema = new Schema(
	{
		_id: { type: String },
		name: { type: String, default: null },
		memberCount: { type: Number, default: 0 },
		isDonator: { type: Boolean, default: false },
		voteRewardExpiresAt: { type: Date, default: null },
		tracking: { type: trackingDefaultsSchema, default: () => ({}) },
		options: { type: optionsSchema, default: () => ({}) },
	},
	{ collection: 'guilds', timestamps: true },
)

export type GuildConfig = InferSchemaType<typeof guildSchema>
export const GuildConfigModel = model('GuildConfig', guildSchema)
