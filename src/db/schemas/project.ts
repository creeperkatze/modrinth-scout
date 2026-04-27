import { InferSchemaType, model, Schema } from 'mongoose'

const projectSchema = new Schema(
	{
		guildId: { type: String, required: true },
		projectId: { type: String, required: true },
		slug: { type: String, required: true },
		name: { type: String, required: true },
		lastUpdated: { type: String, required: true },
		addedBy: { type: String, required: true },
		versionType: { type: [String], default: ['release', 'beta', 'alpha'] },
		channelId: { type: String, default: null },
		roleId: { type: String, default: null },
	},
	{ collection: 'projects', timestamps: true },
)

projectSchema.index({ guildId: 1, projectId: 1 }, { unique: true })

export type Project = InferSchemaType<typeof projectSchema>
export type ProjectWithChannel = Project & {
	channelId: string
	roleId?: string | null
}
export const ProjectModel = model('Project', projectSchema)
