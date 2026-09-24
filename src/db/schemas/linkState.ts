import { InferSchemaType, model, Schema } from 'mongoose'

// Pending OAuth flows, keyed by the `state` param sent to Modrinth. Single-use, expired by TTL index
const linkStateSchema = new Schema(
	{
		state: { type: String, required: true, unique: true },
		discordUserId: { type: String, required: true },
		expiresAt: { type: Date, required: true },
	},
	{ collection: 'link_states' },
)

linkStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type LinkState = InferSchemaType<typeof linkStateSchema>
export const LinkStateModel = model('LinkState', linkStateSchema)
