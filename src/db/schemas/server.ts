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

const serverSchema = new Schema(
	{
		_id: { type: String },
		isDonator: { type: Boolean, default: false },
		tracking: { type: trackingDefaultsSchema, default: () => ({}) },
		autoEmbedsEnabled: { type: Boolean, default: false },
		changelogSummariesEnabled: { type: Boolean, default: false },
		jarIdentifyEnabled: { type: Boolean, default: false },
	},
	{ collection: 'servers', timestamps: true },
)

export type Server = InferSchemaType<typeof serverSchema>
export const ServerModel = model('Server', serverSchema)
