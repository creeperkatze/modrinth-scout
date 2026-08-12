import { AbstractFeature, type RequestContext } from '@modrinth/api-client'
import client from 'prom-client'

const PREFIX = 'modrinth_scout_'

export const register = new client.Registry()
client.collectDefaultMetrics({ register, prefix: PREFIX })

export const guildCount = new client.Gauge({
	name: `${PREFIX}discord_guild_count`,
	help: 'Number of guilds the bot is currently in',
	registers: [register],
})

export const donatorGuildCount = new client.Gauge({
	name: `${PREFIX}discord_supporter_guild_count`,
	help: 'Number of guilds with supporter perks active',
	registers: [register],
})

export const commandsTotal = new client.Counter({
	name: `${PREFIX}discord_commands_total`,
	help: 'Total number of slash commands executed',
	labelNames: ['command', 'status'] as const,
	registers: [register],
})

export const commandDurationSeconds = new client.Histogram({
	name: `${PREFIX}discord_command_duration_seconds`,
	help: 'Slash command execution duration in seconds',
	labelNames: ['command'] as const,
	buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [register],
})

export const trackingProjectTicksTotal = new client.Counter({
	name: `${PREFIX}tracking_project_ticks_total`,
	help: 'Total number of project tracking ticks run',
	labelNames: ['supporter', 'status'] as const,
	registers: [register],
})

export const trackingProjectDurationSeconds = new client.Histogram({
	name: `${PREFIX}tracking_project_duration_seconds`,
	help: 'Project tracking tick duration in seconds',
	labelNames: ['supporter'] as const,
	buckets: [0.5, 1, 2.5, 5, 10, 30, 60],
	registers: [register],
})

export const trackingProjectNotificationsTotal = new client.Counter({
	name: `${PREFIX}tracking_project_notifications_total`,
	help: 'Total number of version notifications sent to channels',
	registers: [register],
})

export const trackingAuthorTicksTotal = new client.Counter({
	name: `${PREFIX}tracking_author_ticks_total`,
	help: 'Total number of author tracking ticks run',
	labelNames: ['supporter', 'status'] as const,
	registers: [register],
})

export const trackingAuthorDurationSeconds = new client.Histogram({
	name: `${PREFIX}tracking_author_duration_seconds`,
	help: 'Author tracking tick duration in seconds',
	labelNames: ['supporter'] as const,
	buckets: [0.5, 1, 2.5, 5, 10, 30, 60],
	registers: [register],
})

export const trackingAuthorNotificationsTotal = new client.Counter({
	name: `${PREFIX}tracking_author_notifications_total`,
	help: 'Total number of new project notifications sent to channels',
	registers: [register],
})

export const trackingAuthorAutoTrackedTotal = new client.Counter({
	name: `${PREFIX}tracking_author_auto_tracked_total`,
	help: 'Total number of projects auto-tracked after being discovered from a tracked author',
	registers: [register],
})

export const aiSummaryRequestsTotal = new client.Counter({
	name: `${PREFIX}ai_summary_requests_total`,
	help: 'Total number of changelog summary requests to the AI provider',
	labelNames: ['status'] as const,
	registers: [register],
})

export const aiSummaryDurationSeconds = new client.Histogram({
	name: `${PREFIX}ai_summary_duration_seconds`,
	help: 'Changelog summary request duration in seconds',
	buckets: [0.25, 0.5, 1, 2, 5, 10],
	registers: [register],
})

const upstreamApiRequestsTotal = new client.Counter({
	name: `${PREFIX}upstream_api_requests_total`,
	help: 'Total Modrinth API requests',
	labelNames: ['endpoint', 'status'] as const,
	registers: [register],
})

const upstreamApiDurationSeconds = new client.Histogram({
	name: `${PREFIX}upstream_api_request_duration_seconds`,
	help: 'Modrinth API request duration in seconds',
	labelNames: ['endpoint'] as const,
	buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [register],
})

// Labrinth path segments followed by a dynamic id/slug, e.g. '/project/:id'
const DYNAMIC_SEGMENT_PARENTS = new Set([
	'project',
	'organization',
	'user',
	'version',
	'collection',
])

function normalizeEndpointPath(path: string): string {
	const [rawPath] = path.split('?')
	const segments = rawPath.split('/').filter(Boolean)
	for (let i = 1; i < segments.length; i++) {
		if (DYNAMIC_SEGMENT_PARENTS.has(segments[i - 1])) segments[i] = ':id'
	}
	return `/${segments.join('/')}`
}

// Records duration/status for every modrinthClient request; registered in utils/api.ts
export class MetricsFeature extends AbstractFeature {
	async execute<T>(next: () => Promise<T>, context: RequestContext): Promise<T> {
		const endpoint = `${context.options.method ?? 'GET'} ${normalizeEndpointPath(context.path)}`
		const stopTimer = upstreamApiDurationSeconds.startTimer({ endpoint })
		try {
			const result = await next()
			upstreamApiRequestsTotal.inc({ endpoint, status: 'success' })
			return result
		} catch (err) {
			upstreamApiRequestsTotal.inc({ endpoint, status: 'error' })
			throw err
		} finally {
			stopTimer()
		}
	}
}
