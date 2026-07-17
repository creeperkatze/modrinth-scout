import { beforeEach, describe, expect, it } from 'vitest'

import { emojis } from '../src/utils/emojis.js'
import { formatPlainTags, formatTags } from '../src/utils/tags.js'

beforeEach(() => {
	delete emojis['fabric']
	delete emojis['quilt']
})

describe('formatTags', () => {
	it('returns empty string for an empty array', () => {
		expect(formatTags([])).toBe('')
	})

	it('formats a tag without emoji when none is synced', () => {
		expect(formatTags(['fabric'])).toBe('`Fabric`')
	})

	it('formats a tag with emoji when synced', () => {
		emojis['fabric'] = '<:fabric:123>'
		expect(formatTags(['fabric'])).toBe('<:fabric:123> `Fabric`')
	})

	it('capitalizes the first letter of the tag', () => {
		expect(formatTags(['forge'])).toContain('`Forge`')
		expect(formatTags(['neoforge'])).toContain('`Neoforge`')
	})

	it('is case-insensitive for emoji lookup', () => {
		emojis['fabric'] = '<:fabric:123>'
		expect(formatTags(['Fabric'])).toContain('<:fabric:123>')
	})

	it('joins multiple tags with spaces', () => {
		emojis['fabric'] = '<:fabric:123>'
		emojis['quilt'] = '<:quilt:456>'
		const result = formatTags(['fabric', 'quilt'])
		expect(result).toBe('<:fabric:123> `Fabric` <:quilt:456> `Quilt`')
	})
})

describe('formatPlainTags', () => {
	it('returns empty string for an empty array', () => {
		expect(formatPlainTags([])).toBe('')
	})

	it('formats a tag without backticks or emoji when none is synced', () => {
		expect(formatPlainTags(['fabric'])).toBe('Fabric')
	})

	it('formats a tag with emoji when synced', () => {
		emojis['fabric'] = '<:fabric:123>'
		expect(formatPlainTags(['fabric'])).toBe('<:fabric:123> Fabric')
	})

	it('capitalizes the first letter of the tag', () => {
		expect(formatPlainTags(['forge'])).toBe('Forge')
	})

	it('joins multiple tags with spaces', () => {
		emojis['fabric'] = '<:fabric:123>'
		emojis['quilt'] = '<:quilt:456>'
		const result = formatPlainTags(['fabric', 'quilt'])
		expect(result).toBe('<:fabric:123> Fabric <:quilt:456> Quilt')
	})
})
