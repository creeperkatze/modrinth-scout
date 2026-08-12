import type { TrackingOverrides } from '../../db/schemas/tracking.js'
import { RELEASE_TYPES } from '../../db/schemas/tracking.js'

export type TrackingSettings = {
	channelId: string | null
	roleId: string | null
	releaseTypes: string[]
}

const FALLBACK: TrackingSettings = {
	channelId: null,
	roleId: null,
	releaseTypes: [...RELEASE_TYPES],
}

function pick<K extends keyof TrackingOverrides>(
	layers: (TrackingOverrides | null | undefined)[],
	key: K,
): TrackingOverrides[K] {
	for (const layer of layers) {
		const value = layer?.[key]
		if (value !== undefined) return value
	}
	return undefined
}

// Walks the chain nearest-first, each key taking the value from the first layer that defines it
export function resolveTrackingSettings(
	...layers: (TrackingOverrides | null | undefined)[]
): TrackingSettings {
	const releaseTypes = pick(layers, 'releaseTypes')
	return {
		channelId: pick(layers, 'channelId') ?? FALLBACK.channelId,
		roleId: pick(layers, 'roleId') ?? FALLBACK.roleId,
		releaseTypes:
			releaseTypes && releaseTypes.length > 0 ? releaseTypes : [...FALLBACK.releaseTypes],
	}
}

export function formatReleaseTypeLabel(releaseTypes: string[]): string {
	if (releaseTypes.length >= RELEASE_TYPES.length) return 'all releases'
	if (releaseTypes.length === 1) return `${releaseTypes[0]} releases`
	const [last, ...restReversed] = [...releaseTypes].reverse()
	const rest = restReversed.reverse()
	return `${rest.join(' and ')} and ${last} releases`
}
