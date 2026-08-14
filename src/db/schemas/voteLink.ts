import { InferSchemaType, model, Schema } from 'mongoose'

const voteLinkSchema = new Schema(
	{
		discordUserId: { type: String, required: true, unique: true },
		guildId: { type: String, required: true },
	},
	{ collection: 'voteLinks', timestamps: true },
)

voteLinkSchema.index({ guildId: 1 })

export type VoteLink = InferSchemaType<typeof voteLinkSchema>
export const VoteLinkModel = model('VoteLink', voteLinkSchema)
