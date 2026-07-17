import { describe, expect, it } from 'vitest'

import { type AutocompleteHit, formatHitLabels } from '../src/utils/autocomplete.js'

const hit = (overrides: Partial<AutocompleteHit> = {}): AutocompleteHit => ({
	title: 'Sodium',
	project_type: 'mod',
	author: 'JellySquid3',
	downloads: 1_234_567,
	follows: 8_901,
	...overrides,
})

describe('formatHitLabels', () => {
	it('maps minecraft_java_server to Server', () => {
		expect(formatHitLabels([hit({ project_type: 'minecraft_java_server' })])[0]).toContain(
			'· Server ·',
		)
	})

	it('capitalizes unknown project types', () => {
		expect(formatHitLabels([hit({ project_type: 'shader' })])[0]).toContain('· Shader ·')
	})

	it('falls back to Project when project_type is missing', () => {
		expect(formatHitLabels([hit({ project_type: undefined })])[0]).toContain('· Project ·')
	})

	it('truncates label to 100 characters', () => {
		const long = hit({ title: 'A'.repeat(100) })
		expect(formatHitLabels([long])[0].length).toBeLessThanOrEqual(100)
	})

	it('returns one label per hit', () => {
		const hits = [hit({ title: 'Sodium' }), hit({ title: 'Iris' })]
		const labels = formatHitLabels(hits)
		expect(labels).toHaveLength(2)
		expect(labels[0]).toContain('Sodium')
		expect(labels[1]).toContain('Iris')
	})

	it('returns empty array for empty input', () => {
		expect(formatHitLabels([])).toEqual([])
	})
})
