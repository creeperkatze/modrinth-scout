import { InferSchemaType, model, Schema } from 'mongoose'

// /account link sign-ins in progress, keyed by the `state` param sent to Modrinth.
// Single-use, expired by TTL index
const pendingAccountSchema = new Schema(
	{
		state: { type: String, required: true, unique: true },
		discordUserId: { type: String, required: true },
		expiresAt: { type: Date, required: true },
	},
	{ collection: 'pending_accounts' },
)

pendingAccountSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type PendingAccount = InferSchemaType<typeof pendingAccountSchema>
export const PendingAccountModel = model('PendingAccount', pendingAccountSchema)
