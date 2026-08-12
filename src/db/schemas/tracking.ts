import { InferSchemaType, model, Schema } from 'mongoose'

export const RELEASE_TYPES = ['release', 'beta', 'alpha'] as const
export type ReleaseType = (typeof RELEASE_TYPES)[number]

export const TRACKING_KINDS = ['project', 'user', 'organization'] as const
export type TrackingKind = (typeof TRACKING_KINDS)[number]

export const AUTHOR_KINDS = ['user', 'organization'] as const
export type AuthorKind = (typeof AUTHOR_KINDS)[number]

export function isAuthorKind(kind: TrackingKind): kind is AuthorKind {
	return kind !== 'project'
}

// A missing key inherits from the next layer up, an explicit null roleId means never ping.
export type TrackingOverrides = Partial<{
	channelId: string | null
	roleId: string | null
	releaseTypes: string[] | null
}>

const overridesSchema = new Schema(
	{
		channelId: { type: String, default: undefined },
		roleId: { type: String, default: undefined },
		releaseTypes: { type: [String], default: undefined },
	},
	{ _id: false },
)

const trackingSchema = new Schema(
	{
		guildId: { type: String, required: true },
		kind: { type: String, enum: TRACKING_KINDS, required: true },
		targetId: { type: String, required: true },
		slug: { type: String, required: true },
		name: { type: String, required: true },
		sourceAuthorId: { type: String, default: null },
		overrides: { type: overridesSchema, default: () => ({}) },
		notifiedThrough: { type: Date, required: true },
		knownProjectIds: { type: [String], default: undefined },
	},
	{ collection: 'tracking', timestamps: true },
)

trackingSchema.index({ guildId: 1, targetId: 1, kind: 1 }, { unique: true })
trackingSchema.index({ kind: 1, targetId: 1 })
trackingSchema.index({ guildId: 1, kind: 1, sourceAuthorId: 1 })

export type TrackingEntry = InferSchemaType<typeof trackingSchema>
export const TrackingModel = model('Tracking', trackingSchema)
