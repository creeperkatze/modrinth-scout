import { model, Schema } from 'mongoose'

export interface IServerConfig {
	_id: string // guildId
	channelId: string
	configuredBy: string
}

export interface ITrackedProject {
	guildId: string
	projectId: string
	slug: string
	name: string
	lastUpdated: string
	addedBy: string
}

export interface ITrackedProjectWithChannel extends ITrackedProject {
	channelId: string
}

const serverConfigSchema = new Schema<IServerConfig>(
	{
		_id: { type: String },
		channelId: { type: String, required: true },
		configuredBy: { type: String, required: true },
	},
	{ collection: 'servers', timestamps: true },
)

const trackedProjectSchema = new Schema<ITrackedProject>(
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

export const ServerConfig = model<IServerConfig>('ServerConfig', serverConfigSchema)
export const TrackedProject = model<ITrackedProject>('TrackedProject', trackedProjectSchema)
