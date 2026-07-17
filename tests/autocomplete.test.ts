import { describe, expect, it } from 'vitest'

import { type AutocompleteHit, formatHitLabels } from '../src/utils/autocomplete.js'

const hit = (overrides: Partial<AutocompleteHit> = {}): AutocompleteHit => ({
	title: 'Sodium',
	author: 'jellysquid3',
	downloads: 1234,
	follows: 56,
	project_type: 'mod',
	...overrides,
})

describe('formatHitLabels', () => {
	it('includes title, type, author, downloads, and follows', () => {
		const [label] = formatHitLabels([hit()])
		expect(label).toBe('Sodium · ▢ Mod · Ꙫ jellysquid3 · ↓ 1.2K · ♡ 56')
	})

	it('defaults to "Project" when project_type is missing', () => {
		const [label] = formatHitLabels([hit({ project_type: undefined })])
		expect(label).toContain('▢ Project')
	})

	it('formats download counts in the millions', () => {
		const [label] = formatHitLabels([hit({ downloads: 2_500_000 })])
		expect(label).toContain('↓ 2.5M')
	})

	it('formats counts under 1000 without a suffix', () => {
		const [label] = formatHitLabels([hit({ downloads: 42, follows: 3 })])
		expect(label).toContain('↓ 42')
		expect(label).toContain('♡ 3')
	})

	it('truncates labels to 100 characters', () => {
		const [label] = formatHitLabels([hit({ title: 'A'.repeat(200) })])
		expect(label.length).toBeLessThanOrEqual(100)
	})

	it('preserves order and count across multiple hits', () => {
		const labels = formatHitLabels([hit({ title: 'A' }), hit({ title: 'B' })])
		expect(labels).toHaveLength(2)
		expect(labels[0]).toContain('A')
		expect(labels[1]).toContain('B')
	})
})
