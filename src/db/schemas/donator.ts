import { InferSchemaType, model, Schema } from 'mongoose'

const donatorSchema = new Schema(
	{
		email: { type: String, required: true },
		transactionId: { type: String, required: true, unique: true },
		discordUserId: { type: String, default: null },
		usedByGuildId: { type: String, default: null },
		showPublicly: { type: Boolean, default: true },
	},
	{ collection: 'donators', timestamps: true },
)

donatorSchema.index({ discordUserId: 1, usedByGuildId: 1 })
donatorSchema.index({ showPublicly: 1, usedByGuildId: 1, createdAt: 1 })

export type Donator = InferSchemaType<typeof donatorSchema>
export const DonatorModel = model('Donator', donatorSchema)
