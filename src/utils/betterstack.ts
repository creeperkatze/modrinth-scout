import { usesBetterStack } from '../config/betterstack.js'
import { createModuleLogger } from './logger.js'

const log = createModuleLogger('betterstack')

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

interface HeartbeatAvailabilityResponse {
	data: {
		attributes: {
			availability: number
		}
	}
}

let cached: { value: number; expiresAt: number } | null = null

export async function getUptime(): Promise<number | null> {
	if (!usesBetterStack) return null
	if (cached && cached.expiresAt > Date.now()) return cached.value

	try {
		const res = await fetch(
			`https://uptime.betterstack.com/api/v2/heartbeats/${process.env.BETTERSTACK_MONITOR_ID}/availability`,
			{ headers: { Authorization: `Bearer ${process.env.BETTERSTACK_API_TOKEN}` } },
		)
		if (!res.ok)
			throw new Error(`BetterStack heartbeat availability request failed with status ${res.status}`)

		const body = (await res.json()) as HeartbeatAvailabilityResponse
		const availability = body.data.attributes.availability
		cached = { value: availability, expiresAt: Date.now() + CACHE_TTL_MS }
		return availability
	} catch (err) {
		log.warn({ err }, 'Failed to fetch BetterStack uptime')
		return cached?.value ?? null
	}
}
