import { describe, expect, it } from 'vitest'

import { parseModrinthUrl } from '../src/utils/url.js'

describe('parseModrinthUrl', () => {
	it('parses a project URL', () => {
		expect(parseModrinthUrl('https://modrinth.com/mod/sodium')).toEqual({
			type: 'project',
			slug: 'sodium',
		})
	})

	it('parses project URLs for every project type segment', () => {
		const types = ['mod', 'plugin', 'modpack', 'resourcepack', 'shader', 'datapack', 'server']
		for (const type of types) {
			expect(parseModrinthUrl(`https://modrinth.com/${type}/example`)).toEqual({
				type: 'project',
				slug: 'example',
			})
		}
	})

	it('parses a version URL referencing a version number', () => {
		expect(parseModrinthUrl('https://modrinth.com/mod/sodium/version/mc1.20.1-0.5.8')).toEqual({
			type: 'version',
			projectSlug: 'sodium',
			reference: 'mc1.20.1-0.5.8',
		})
	})

	it('decodes URI-encoded version references', () => {
		expect(parseModrinthUrl('https://modrinth.com/mod/sodium/version/1.0%20beta')).toEqual({
			type: 'version',
			projectSlug: 'sodium',
			reference: '1.0 beta',
		})
	})

	it('parses a user URL', () => {
		expect(parseModrinthUrl('https://modrinth.com/user/jellysquid3')).toEqual({
			type: 'user',
			username: 'jellysquid3',
		})
	})

	it('parses an organization URL', () => {
		expect(parseModrinthUrl('https://modrinth.com/organization/fabric')).toEqual({
			type: 'organization',
			slug: 'fabric',
		})
	})

	it('parses a collection URL', () => {
		expect(parseModrinthUrl('https://modrinth.com/collection/abc123')).toEqual({
			type: 'collection',
			id: 'abc123',
		})
	})

	it('ignores trailing path segments on a project URL', () => {
		expect(parseModrinthUrl('https://modrinth.com/mod/sodium/gallery')).toEqual({
			type: 'project',
			slug: 'sodium',
		})
	})

	it('returns null for a non-modrinth hostname', () => {
		expect(parseModrinthUrl('https://example.com/mod/sodium')).toBeNull()
	})

	it('returns null for an unparseable URL', () => {
		expect(parseModrinthUrl('not a url')).toBeNull()
	})

	it('returns null for the bare modrinth.com root', () => {
		expect(parseModrinthUrl('https://modrinth.com/')).toBeNull()
	})

	it('returns null for an unrecognized top-level segment', () => {
		expect(parseModrinthUrl('https://modrinth.com/settings/profile')).toBeNull()
	})

	it('returns null for a version URL missing the version reference', () => {
		expect(parseModrinthUrl('https://modrinth.com/mod/sodium/version')).toEqual({
			type: 'project',
			slug: 'sodium',
		})
	})
})
