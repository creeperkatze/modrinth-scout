import type { Labrinth } from '@modrinth/api-client'
import { describe, expect, it } from 'vitest'

import {
	awaitingMoreUploads,
	groupVersions,
	MAX_SETTLE_MS,
	releaseNumber,
	SETTLE_MS,
	sharedReleaseNumber,
} from '../src/utils/versionGroups.js'

type Version = Labrinth.Versions.v3.Version

let nextId = 0
function version(
	versionNumber: string,
	gameVersions: string[],
	loaders: string[],
	overrides: Partial<Version> = {},
): Version {
	return {
		id: `v${nextId++}`,
		version_number: versionNumber,
		game_versions: gameVersions,
		loaders,
		author_id: 'author',
		changelog: 'Added a thing',
		version_type: 'release',
		date_published: '2026-11-09T19:18:00Z',
		...overrides,
	} as Version
}

describe('releaseNumber', () => {
	it.each([
		['1.1.0+26.2-fabric', ['26.2'], ['fabric', 'quilt'], '1.1.0'],
		['mc26.3-0.9.3-beta.5-neoforge', ['26.3'], ['neoforge'], '0.9.3-beta.5'],
		['3.0.10+mc26.3', ['26.3'], ['fabric'], '3.0.10'],
		['22.0.5+neoforge', ['26.3'], ['neoforge'], '22.0.5'],
		['26.3.159+fabric', ['26.3'], ['fabric'], '26.3.159'],
		['1.21.0+1.21-fabric', ['1.21'], ['fabric'], '1.21.0'],
		['2.0.0-legacy-fabric', ['1.8.9'], ['legacy-fabric'], '2.0.0'],
		['31.17.0.113', ['26.3'], ['neoforge'], '31.17.0.113'],
	])('%s -> %s', (number, gameVersions, loaders, expected) => {
		expect(releaseNumber(version(number, gameVersions, loaders))).toBe(expected)
	})

	it('falls back to the full number when nothing else is left', () => {
		expect(releaseNumber(version('1.21', ['1.21'], ['minecraft']))).toBe('1.21')
	})
})

describe('groupVersions', () => {
	it('groups builds of one release across loaders and game versions', () => {
		const versions = [
			version('1.1.0+26.2-fabric', ['26.2'], ['fabric', 'quilt']),
			version('1.1.0+1.21.11-neoforge', ['1.21.11'], ['neoforge']),
			version('1.1.0+26.3-fabric', ['26.3'], ['fabric', 'quilt']),
		]
		expect(groupVersions(versions)).toEqual([versions])
	})

	it('splits uploads for the same loader and game version', () => {
		const opts = { changelog: '' }
		const a = version('1.0.0+26.2-fabric', ['26.2'], ['fabric'], opts)
		const b = version('1.0.0+26.2-neoforge', ['26.2'], ['neoforge'], opts)
		const c = version('1.0.1+26.2-fabric', ['26.2'], ['fabric'], opts)
		expect(groupVersions([a, b, c])).toEqual([[a, b], [c]])
	})

	it('splits on any difference in changelog, release type or author', () => {
		const base = version('1.1.0+26.2-fabric', ['26.2'], ['fabric'])
		const others = [
			version('1.1.0+26.2-neoforge', ['26.2'], ['neoforge'], { changelog: 'Something else' }),
			version('1.1.0+26.3-neoforge', ['26.3'], ['neoforge'], { version_type: 'beta' }),
			version('1.1.0+26.4-neoforge', ['26.4'], ['neoforge'], { author_id: 'someone-else' }),
		]
		expect(groupVersions([base, ...others])).toEqual([[base], ...others.map((v) => [v])])
	})

	it('ignores whitespace differences in changelogs', () => {
		const a = version('1.1.0+26.2-fabric', ['26.2'], ['fabric'], { changelog: 'Line\n- item' })
		const b = version('1.1.0+26.2-neoforge', ['26.2'], ['neoforge'], {
			changelog: '  Line\r\n- item  ',
		})
		expect(groupVersions([a, b])).toEqual([[a, b]])
	})

	it('splits uploads outside one burst', () => {
		const a = version('1.1.0+26.2-fabric', ['26.2'], ['fabric'])
		const b = version('1.1.0+26.2-neoforge', ['26.2'], ['neoforge'], {
			date_published: '2026-11-09T20:18:00Z',
		})
		expect(groupVersions([a, b])).toEqual([[a], [b]])
	})
})

describe('sharedReleaseNumber', () => {
	it('returns the number all builds agree on', () => {
		expect(
			sharedReleaseNumber([
				version('mc26.3-0.9.3-beta.5-fabric', ['26.3'], ['fabric']),
				version('mc26.3-0.9.3-beta.5-neoforge', ['26.3'], ['neoforge']),
			]),
		).toBe('0.9.3-beta.5')
	})

	it('returns null when builds carry different numbers', () => {
		expect(
			sharedReleaseNumber([
				version('22.0.5+fabric', ['26.3'], ['fabric']),
				version('21.1.12+fabric', ['26.2'], ['fabric']),
			]),
		).toBeNull()
	})
})

describe('awaitingMoreUploads', () => {
	const now = Date.parse('2026-11-09T19:20:00Z')

	it('waits while the newest upload is fresh', () => {
		expect(awaitingMoreUploads([new Date(now - SETTLE_MS / 2)], now)).toBe(true)
	})

	it('stops waiting once uploads have settled', () => {
		expect(awaitingMoreUploads([new Date(now - SETTLE_MS)], now)).toBe(false)
	})

	it('stops waiting after the maximum delay even if uploads continue', () => {
		expect(awaitingMoreUploads([new Date(now - MAX_SETTLE_MS), new Date(now - 1000)], now)).toBe(
			false,
		)
	})

	it('does not wait when nothing is pending', () => {
		expect(awaitingMoreUploads([], now)).toBe(false)
	})
})
