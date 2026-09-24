import { InferSchemaType, model, Schema } from 'mongoose'

const linkSchema = new Schema(
	{
		discordUserId: { type: String, required: true, unique: true },
		modrinthUserId: { type: String, required: true, unique: true },
		modrinthUsername: { type: String, required: true },
	},
	{ collection: 'links', timestamps: true },
)

export type Link = InferSchemaType<typeof linkSchema>
export const LinkModel = model('Link', linkSchema)
