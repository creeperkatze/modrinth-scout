import { InferSchemaType, model, Schema } from 'mongoose'

const serverSchema = new Schema(
	{
		_id: { type: String },
		isSupporter: { type: Boolean, default: false },
		trackingChannelId: { type: String, default: null },
		trackingRoleId: { type: String, default: null },
		trackingPaused: { type: Boolean, default: false },
	},
	{ collection: 'servers', timestamps: true },
)

export type Server = InferSchemaType<typeof serverSchema>
export const ServerModel = model('Server', serverSchema)
