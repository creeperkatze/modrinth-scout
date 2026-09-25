import { InferSchemaType, model, Schema } from 'mongoose'

const accountSchema = new Schema(
	{
		discordUserId: { type: String, required: true, unique: true },
		modrinthUserId: { type: String, required: true, unique: true },
		modrinthUsername: { type: String, required: true },
	},
	{ collection: 'accounts', timestamps: true },
)

export type Account = InferSchemaType<typeof accountSchema>
export const AccountModel = model('Account', accountSchema)
