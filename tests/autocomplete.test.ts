import { describe, expect, it } from 'vitest'

import { formatHitLabels } from '../src/utils/autocomplete.js'

type Hit = { name: string; project_types?: string[]; author: string; downloads: number }

const hit = (overrides: Partial<Hit> = {}): Hit => ({
	name: 'Sodium',
	project_types: ['mod'],
	author: 'JellySquid3',
	downloads: 1_234_567,
	...overrides,
})

describe('formatHitLabels', () => {
	it('formats label with name, type, author, and downloads', () => {
		expect(formatHitLabels([hit()])[0]).toBe('Sodium · Mod · by JellySquid3 · 1,234,567 downloads')
	})

	it('maps minecraft_java_server to Server', () => {
		expect(formatHitLabels([hit({ project_types: ['minecraft_java_server'] })])[0]).toContain(
			'· Server ·',
		)
	})

	it('capitalizes unknown project types', () => {
		expect(formatHitLabels([hit({ project_types: ['shader'] })])[0]).toContain('· Shader ·')
	})

	it('falls back to Project when project_types is missing', () => {
		expect(formatHitLabels([hit({ project_types: undefined })])[0]).toContain('· Project ·')
	})

	it('truncates label to 100 characters', () => {
		const long = hit({ name: 'A'.repeat(100) })
		expect(formatHitLabels([long])[0].length).toBeLessThanOrEqual(100)
	})

	it('returns one label per hit', () => {
		const hits = [hit({ name: 'Sodium' }), hit({ name: 'Iris' })]
		const labels = formatHitLabels(hits)
		expect(labels).toHaveLength(2)
		expect(labels[0]).toContain('Sodium')
		expect(labels[1]).toContain('Iris')
	})

	it('returns empty array for empty input', () => {
		expect(formatHitLabels([])).toEqual([])
	})
})
