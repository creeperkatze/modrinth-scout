import client from 'prom-client'

export const register = new client.Registry()
client.collectDefaultMetrics({ register })

export const guildCount = new client.Gauge({
	name: 'discord_guild_count',
	help: 'Number of guilds the bot is currently in',
	registers: [register],
})

export const commandsTotal = new client.Counter({
	name: 'discord_commands_total',
	help: 'Total number of slash commands executed',
	labelNames: ['command', 'status'] as const,
	registers: [register],
})

export const commandDurationSeconds = new client.Histogram({
	name: 'discord_command_duration_seconds',
	help: 'Slash command execution duration in seconds',
	labelNames: ['command'] as const,
	buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [register],
})

export const pollTicksTotal = new client.Counter({
	name: 'poller_ticks_total',
	help: 'Total number of poll ticks run',
	labelNames: ['supporter', 'status'] as const,
	registers: [register],
})

export const pollDurationSeconds = new client.Histogram({
	name: 'poller_tick_duration_seconds',
	help: 'Poll tick duration in seconds',
	labelNames: ['supporter'] as const,
	buckets: [0.5, 1, 2.5, 5, 10, 30, 60],
	registers: [register],
})

export const pollNotificationsTotal = new client.Counter({
	name: 'poller_notifications_total',
	help: 'Total number of version notifications sent to channels',
	registers: [register],
})

export const modrinthApiRequestsTotal = new client.Counter({
	name: 'modrinth_api_requests_total',
	help: 'Total Modrinth API requests made by the poller',
	labelNames: ['endpoint', 'status'] as const,
	registers: [register],
})

export const modrinthApiDurationSeconds = new client.Histogram({
	name: 'modrinth_api_request_duration_seconds',
	help: 'Modrinth API request duration in seconds, as observed by the poller',
	labelNames: ['endpoint'] as const,
	buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [register],
})

export async function timeApiCall<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
	const stopTimer = modrinthApiDurationSeconds.startTimer({ endpoint })
	try {
		const result = await fn()
		modrinthApiRequestsTotal.inc({ endpoint, status: 'success' })
		return result
	} catch (err) {
		modrinthApiRequestsTotal.inc({ endpoint, status: 'error' })
		throw err
	} finally {
		stopTimer()
	}
}
