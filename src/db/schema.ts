import { model, Schema } from 'mongoose'

export interface ServerConfig {
	_id: string
	channelId: string
	configuredBy: string
	roleId?: string | null
	isSupporter?: boolean
}

export interface SupporterDonation {
	discordUserId: string | null
	email: string
	transactionId: string
	usedByGuildId?: string | null
}

export interface TrackedProject {
	guildId: string
	projectId: string
	slug: string
	name: string
	lastUpdated: string
	addedBy: string
}

export interface TrackedProjectWithChannel extends TrackedProject {
	channelId: string
	roleId?: string | null
}

const serverConfigSchema = new Schema<ServerConfig>(
	{
		_id: { type: String },
		channelId: { type: String, required: true },
		configuredBy: { type: String, required: true },
		roleId: { type: String, default: null },
		isSupporter: { type: Boolean, default: false },
	},
	{ collection: 'servers', timestamps: true },
)

const supporterDonationSchema = new Schema<SupporterDonation>(
	{
		discordUserId: { type: String, default: null },
		email: { type: String, required: true },
		transactionId: { type: String, required: true, unique: true },
		usedByGuildId: { type: String, default: null },
	},
	{ collection: 'supporters', timestamps: true },
)

const trackedProjectSchema = new Schema<TrackedProject>(
	{
		guildId: { type: String, required: true },
		projectId: { type: String, required: true },
		slug: { type: String, required: true },
		name: { type: String, required: true },
		lastUpdated: { type: String, required: true },
		addedBy: { type: String, required: true },
	},
	{ collection: 'projects', timestamps: true },
)

trackedProjectSchema.index({ guildId: 1, projectId: 1 }, { unique: true })

export const ServerConfigModel = model<ServerConfig>('ServerConfig', serverConfigSchema)
export const TrackedProjectModel = model<TrackedProject>('TrackedProject', trackedProjectSchema)
export const SupporterDonationModel = model<SupporterDonation>(
	'SupporterDonation',
	supporterDonationSchema,
)
