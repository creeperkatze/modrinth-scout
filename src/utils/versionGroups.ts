import type { Labrinth } from '@modrinth/api-client'

type Version = Labrinth.Versions.v3.Version

const BURST_WINDOW_MS = 15 * 60 * 1000

export const SETTLE_MS = 2 * 60 * 1000
export const MAX_SETTLE_MS = 10 * 60 * 1000

function normalizeChangelog(changelog: string | null | undefined): string {
	return (changelog ?? '').trim().replace(/\s+/g, ' ')
}

function targets(version: Version): string[] {
	return version.loaders.flatMap((loader) => version.game_versions.map((gv) => `${loader}@${gv}`))
}

function sameRelease(a: Version, b: Version): boolean {
	return (
		a.author_id === b.author_id &&
		a.version_type === b.version_type &&
		normalizeChangelog(a.changelog) === normalizeChangelog(b.changelog)
	)
}

// Expects versions oldest first
export function groupVersions(versions: Version[]): Version[][] {
	const groups: { versions: Version[]; targets: Set<string>; start: number }[] = []

	for (const version of versions) {
		const published = new Date(version.date_published).getTime()
		const own = targets(version)
		const group = groups.find(
			(candidate) =>
				sameRelease(candidate.versions[0], version) &&
				published - candidate.start <= BURST_WINDOW_MS &&
				// Two uploads for the same loader and game version are always separate releases
				!own.some((target) => candidate.targets.has(target)),
		)

		if (group) {
			group.versions.push(version)
			for (const target of own) group.targets.add(target)
		} else {
			groups.push({ versions: [version], targets: new Set(own), start: published })
		}
	}

	return groups.map((group) => group.versions)
}

// The version number without the tokens naming its own loaders and game versions
export function releaseNumber(version: Version): string {
	const ignored = new Set(
		[
			...version.loaders.flatMap((loader) => [loader, ...loader.split(/[-_]/)]),
			...version.game_versions.flatMap((gv) => [gv, `mc${gv}`]),
		].map((token) => token.toLowerCase()),
	)

	const parts = version.version_number.split(/([+\-_\s]+)/)
	let number = ''
	for (let i = 0; i < parts.length; i += 2) {
		const token = parts[i]
		if (!token || ignored.has(token.toLowerCase())) continue
		number += (number ? parts[i - 1] : '') + token
	}
	return number || version.version_number
}

export function sharedReleaseNumber(versions: Version[]): string | null {
	const number = releaseNumber(versions[0])
	return versions.every((version) => releaseNumber(version) === number) ? number : null
}

// True while builds of the same release are probably still being uploaded
export function awaitingMoreUploads(publishedDates: Date[], now = Date.now()): boolean {
	if (publishedDates.length === 0) return false
	const times = publishedDates.map((date) => date.getTime())
	return now - Math.max(...times) < SETTLE_MS && now - Math.min(...times) < MAX_SETTLE_MS
}
