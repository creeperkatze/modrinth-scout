import { describe, expect, it } from 'vitest'

import type { ModrinthProject } from '../src/api/modrinth.js'
import { topProjectsList } from '../src/utils/embeds/helpers.js'

const project = (
	name: string,
	slug: string,
	downloads: number,
	project_types = ['mod'],
): ModrinthProject => ({
	id: slug,
	slug,
	name,
	summary: '',
	project_types,
	icon_url: null,
	color: null,
	downloads,
	followers: 0,
	categories: [],
	updated: '2024-01-01T00:00:00Z',
	published: '2024-01-01T00:00:00Z',
	link_urls: {},
})

describe('topProjectsList', () => {
	it('sorts projects by downloads descending', () => {
		const result = topProjectsList([project('Beta', 'beta', 100), project('Alpha', 'alpha', 999)])
		const lines = result.split('\n')
		expect(lines[0]).toContain('Alpha')
		expect(lines[1]).toContain('Beta')
	})

	it('limits output to 5 projects', () => {
		const projects = Array.from({ length: 10 }, (_, i) => project(`P${i}`, `p${i}`, i * 100))
		expect(topProjectsList(projects).split('\n')).toHaveLength(5)
	})

	it('includes a markdown link with the correct URL', () => {
		const result = topProjectsList([project('Sodium', 'sodium', 1)])
		expect(result).toContain('[Sodium](https://modrinth.com/mod/sodium)')
	})

	it('uses the project type in the URL', () => {
		const result = topProjectsList([project('Shader Pack', 'shader-pack', 1, ['shader'])])
		expect(result).toContain('https://modrinth.com/shader/shader-pack')
	})

	it('formats download count with en-US locale separators', () => {
		const result = topProjectsList([project('Sodium', 'sodium', 1_234_567)])
		expect(result).toContain('1,234,567 downloads')
	})

	it('does not mutate the input array', () => {
		const projects = [project('B', 'b', 10), project('A', 'a', 100)]
		topProjectsList(projects)
		expect(projects[0].name).toBe('B')
	})
})
