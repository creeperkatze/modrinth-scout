import { InferSchemaType, model, Schema } from 'mongoose'

// /account link sign-ins in progress, keyed by the `state` param sent to Modrinth.
// Single-use, expired by TTL index
const pendingLinkSchema = new Schema(
	{
		state: { type: String, required: true, unique: true },
		discordUserId: { type: String, required: true },
		expiresAt: { type: Date, required: true },
	},
	{ collection: 'pending_links' },
)

pendingLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type PendingLink = InferSchemaType<typeof pendingLinkSchema>
export const PendingLinkModel = model('PendingLink', pendingLinkSchema)
