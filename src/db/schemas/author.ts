import { InferSchemaType, model, Schema } from 'mongoose'

const authorSchema = new Schema(
	{
		guildId: { type: String, required: true },
		authorId: { type: String, required: true },
		authorType: { type: String, enum: ['user', 'organization'] as const, required: true },
		username: { type: String, required: true },
		name: { type: String, required: true },
		knownProjectIds: { type: [String], default: [] },
		channelId: { type: String, default: null },
		roleId: { type: String, default: null },
	},
	{ collection: 'authors', timestamps: true },
)

authorSchema.index({ guildId: 1, authorId: 1 }, { unique: true })
authorSchema.index({ authorId: 1, guildId: 1 })
authorSchema.index({ guildId: 1, username: 1 })

export type TrackedAuthor = InferSchemaType<typeof authorSchema>
export type TrackedAuthorWithChannel = TrackedAuthor & {
	channelId: string
	roleId?: string | null
}
export const AuthorModel = model('Author', authorSchema)
