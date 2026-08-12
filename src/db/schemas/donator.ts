import { InferSchemaType, model, Schema } from 'mongoose'

const supporterSchema = new Schema(
	{
		email: { type: String, required: true },
		transactionId: { type: String, required: true, unique: true },
		discordUserId: { type: String, default: null },
		usedByGuildId: { type: String, default: null },
		showPublicly: { type: Boolean, default: true },
	},
	{ collection: 'supporters', timestamps: true },
)

supporterSchema.index({ discordUserId: 1, usedByGuildId: 1 })
supporterSchema.index({ showPublicly: 1, usedByGuildId: 1, createdAt: 1 })

export type Supporter = InferSchemaType<typeof supporterSchema>
export const SupporterModel = model('Supporter', supporterSchema)
