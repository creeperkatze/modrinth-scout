import { InferSchemaType, model, Schema } from 'mongoose'

const serverSchema = new Schema(
	{
		_id: { type: String },
		channelId: { type: String, default: null },
		configuredBy: { type: String, default: null },
		roleId: { type: String, default: null },
		isSupporter: { type: Boolean, default: false },
		paused: { type: Boolean, default: false },
	},
	{ collection: 'servers', timestamps: true },
)

export type Server = InferSchemaType<typeof serverSchema>
export const ServerModel = model('Server', serverSchema)
