import { InferSchemaType, model, Schema } from 'mongoose'

const projectSchema = new Schema(
	{
		guildId: { type: String, required: true },
		projectId: { type: String, required: true },
		slug: { type: String, required: true },
		name: { type: String, required: true },
		releaseType: { type: [String], default: ['release', 'beta', 'alpha'] },
		channelId: { type: String, default: null },
		roleId: { type: String, default: null },
		lastUpdated: { type: Date, required: true },
	},
	{ collection: 'projects', timestamps: true },
)

projectSchema.index({ guildId: 1, projectId: 1 }, { unique: true })
projectSchema.index({ projectId: 1, guildId: 1 })
projectSchema.index({ guildId: 1, slug: 1 })

export type Project = InferSchemaType<typeof projectSchema>
export type ProjectWithChannel = Project & {
	channelId: string
	roleId?: string | null
}
export const ProjectModel = model('Project', projectSchema)
