import { describe, expect, it } from 'vitest'

import { buildSearchId, parseSearchId, SEARCH_LIMIT } from '../src/commands/search.js'

describe('SEARCH_LIMIT', () => {
	it('is a positive integer', () => {
		expect(SEARCH_LIMIT).toBeGreaterThan(0)
		expect(Number.isInteger(SEARCH_LIMIT)).toBe(true)
	})
})

describe('buildSearchId', () => {
	it('encodes basic state without type or index', () => {
		expect(buildSearchId('prev', 0, 'sodium')).toBe('search:prev:0:::sodium')
	})

	it('encodes type and index', () => {
		expect(buildSearchId('next', 5, 'sodium', 'mod', 'downloads')).toBe(
			'search:next:5:mod:downloads:sodium',
		)
	})

	it('encodes offset correctly', () => {
		expect(buildSearchId('next', 10, 'fabric api')).toBe('search:next:10:::fabric api')
	})
})

describe('parseSearchId', () => {
	it('decodes basic state', () => {
		expect(parseSearchId('search:prev:0:::sodium')).toEqual({
			action: 'prev',
			offset: 0,
			type: undefined,
			index: undefined,
			query: 'sodium',
		})
	})

	it('decodes type and index', () => {
		expect(parseSearchId('search:next:5:mod:downloads:sodium')).toEqual({
			action: 'next',
			offset: 5,
			type: 'mod',
			index: 'downloads',
			query: 'sodium',
		})
	})

	it('defaults offset to 0 for non-numeric input', () => {
		expect(parseSearchId('search:prev:NaN:::sodium').offset).toBe(0)
	})

	it('preserves colons inside the query', () => {
		const id = buildSearchId('next', 0, 'query:with:colons')
		expect(parseSearchId(id).query).toBe('query:with:colons')
	})

	it('round-trips all fields correctly', () => {
		const id = buildSearchId('jump', 15, 'fabric api', 'mod', 'relevance')
		expect(parseSearchId(id)).toEqual({
			action: 'jump',
			offset: 15,
			type: 'mod',
			index: 'relevance',
			query: 'fabric api',
		})
	})

	it('treats empty type and index strings as undefined', () => {
		const { type, index } = parseSearchId('search:prev:0:::sodium')
		expect(type).toBeUndefined()
		expect(index).toBeUndefined()
	})
})
