import { InferSchemaType, model, Schema } from 'mongoose'

const supporterSchema = new Schema(
	{
		discordUserId: { type: String, default: null },
		email: { type: String, required: true },
		transactionId: { type: String, required: true, unique: true },
		usedByGuildId: { type: String, default: null },
		showPublicly: { type: Boolean, default: true },
	},
	{ collection: 'supporters', timestamps: true },
)

export type Supporter = InferSchemaType<typeof supporterSchema>
export const SupporterModel = model('Supporter', supporterSchema)
