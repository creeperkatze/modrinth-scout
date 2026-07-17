import type { Labrinth } from '@modrinth/api-client'
import { beforeEach, describe, expect, it } from 'vitest'

import {
	combinedLoaders,
	projectTypeBreakdown,
	topProjectsList,
	totalFollowers,
	typeLabel,
} from '../src/utils/embeds/helpers.js'
import { emojis } from '../src/utils/emojis.js'

const project = (
	name: string,
	slug: string,
	downloads: number,
	project_types: Labrinth.Projects.v3.ProjectType[] = ['mod'],
	followers = 0,
	loaders: string[] = [],
): Labrinth.Projects.v3.Project => ({
	id: slug,
	slug,
	name,
	summary: '',
	description: '',
	project_types,
	games: [],
	team_id: 'team',
	status: 'approved',
	license: { id: 'MIT', name: 'MIT License' },
	downloads,
	followers,
	loaders,
	categories: [],
	additional_categories: [],
	mrpack_loaders: [],
	versions: [],
	gallery: [],
	thread_id: 'thread',
	monetization_status: 'monetized',
	side_types_migration_review_status: 'reviewed',
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

	it('limits output to 10 projects', () => {
		const projects = Array.from({ length: 15 }, (_, i) => project(`P${i}`, `p${i}`, i * 100))
		expect(topProjectsList(projects).split('\n')).toHaveLength(10)
	})

	it('includes a markdown link with the correct URL', () => {
		const result = topProjectsList([project('Sodium', 'sodium', 1)])
		expect(result).toContain('[Sodium](https://modrinth.com/mod/sodium)')
	})

	it('uses the project type in the URL', () => {
		const result = topProjectsList([project('Shader Pack', 'shader-pack', 1, ['shader'])])
		expect(result).toContain('https://modrinth.com/shader/shader-pack')
	})

	it('formats download count using compact notation', () => {
		const result = topProjectsList([project('Sodium', 'sodium', 1_234_567)])
		expect(result).toContain('1.2M')
	})

	it('does not mutate the input array', () => {
		const projects = [project('B', 'b', 10), project('A', 'a', 100)]
		topProjectsList(projects)
		expect(projects[0].name).toBe('B')
	})
})

describe('typeLabel', () => {
	it('uses the special-cased label when one exists', () => {
		expect(typeLabel('minecraft_java_server')).toBe('Server')
	})

	it('capitalizes an unmapped type', () => {
		expect(typeLabel('mod')).toBe('Mod')
	})
})

describe('totalFollowers', () => {
	it('sums followers across projects', () => {
		const projects = [project('A', 'a', 0, ['mod'], 10), project('B', 'b', 0, ['mod'], 25)]
		expect(totalFollowers(projects)).toBe(35)
	})

	it('returns 0 for an empty array', () => {
		expect(totalFollowers([])).toBe(0)
	})
})

describe('projectTypeBreakdown', () => {
	beforeEach(() => {
		delete emojis['mod']
		delete emojis['shader']
	})

	it('counts projects per type and pluralizes correctly', () => {
		const projects = [
			project('A', 'a', 0, ['mod']),
			project('B', 'b', 0, ['mod']),
			project('C', 'c', 0, ['shader']),
		]
		expect(projectTypeBreakdown(projects)).toBe('2 Mods · 1 Shader')
	})

	it('sorts by count descending', () => {
		const projects = [
			project('A', 'a', 0, ['shader']),
			project('B', 'b', 0, ['mod']),
			project('C', 'c', 0, ['mod']),
		]
		expect(projectTypeBreakdown(projects)).toBe('2 Mods · 1 Shader')
	})

	it('prefixes with the emoji when synced', () => {
		emojis['mod'] = '<:mod:1>'
		expect(projectTypeBreakdown([project('A', 'a', 0, ['mod'])])).toBe('<:mod:1> 1 Mod')
	})

	it('returns an empty string for an empty array', () => {
		expect(projectTypeBreakdown([])).toBe('')
	})
})

describe('combinedLoaders', () => {
	it('deduplicates loaders across projects', () => {
		const projects = [
			project('A', 'a', 0, ['mod'], 0, ['fabric', 'quilt']),
			project('B', 'b', 0, ['mod'], 0, ['fabric']),
		]
		expect(combinedLoaders(projects)).toEqual(['fabric', 'quilt'])
	})

	it('filters out "minecraft" when other loaders are present', () => {
		const projects = [project('A', 'a', 0, ['mod'], 0, ['minecraft', 'fabric'])]
		expect(combinedLoaders(projects)).toEqual(['fabric'])
	})

	it('keeps "minecraft" when it is the only loader', () => {
		const projects = [project('A', 'a', 0, ['mod'], 0, ['minecraft'])]
		expect(combinedLoaders(projects)).toEqual(['minecraft'])
	})

	it('returns an empty array when no projects have loaders', () => {
		expect(combinedLoaders([project('A', 'a', 0)])).toEqual([])
	})
})
