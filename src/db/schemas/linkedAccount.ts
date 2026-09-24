import { InferSchemaType, model, Schema } from 'mongoose'

const linkedAccountSchema = new Schema(
	{
		discordUserId: { type: String, required: true, unique: true },
		modrinthUserId: { type: String, required: true, unique: true },
		modrinthUsername: { type: String, required: true },
	},
	{ collection: 'linked_accounts', timestamps: true },
)

export type LinkedAccount = InferSchemaType<typeof linkedAccountSchema>
export const LinkedAccountModel = model('LinkedAccount', linkedAccountSchema)
