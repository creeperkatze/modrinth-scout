import { InferSchemaType, model, Schema } from 'mongoose'

const voteSchema = new Schema(
	{
		userId: { type: String, required: true, unique: true },
		guildId: { type: String, required: true },
	},
	{ collection: 'votes', timestamps: true },
)

voteSchema.index({ guildId: 1 })

export type Vote = InferSchemaType<typeof voteSchema>
export const VoteModel = model('Vote', voteSchema)
