import { describe, expect, it } from 'vitest'

import { formatTags, LOADER_EMOJIS } from '../src/utils/loaders.js'

describe('formatTags', () => {
	it('returns empty string for an empty array', () => {
		expect(formatTags([])).toBe('')
	})

	it('formats a known loader with its emoji', () => {
		expect(formatTags(['fabric'])).toBe(`${LOADER_EMOJIS['fabric']} \`Fabric\``)
	})

	it('formats an unknown loader without an emoji', () => {
		expect(formatTags(['unknown'])).toBe('`Unknown`')
	})

	it('capitalizes the first letter of the tag', () => {
		expect(formatTags(['forge'])).toContain('`Forge`')
		expect(formatTags(['neoforge'])).toContain('`Neoforge`')
	})

	it('is case-insensitive for emoji lookup', () => {
		expect(formatTags(['Fabric'])).toContain(LOADER_EMOJIS['fabric'])
	})

	it('joins multiple tags with spaces', () => {
		const result = formatTags(['fabric', 'quilt'])
		expect(result).toContain(`${LOADER_EMOJIS['fabric']} \`Fabric\``)
		expect(result).toContain(`${LOADER_EMOJIS['quilt']} \`Quilt\``)
	})
})

describe('LOADER_EMOJIS', () => {
	it('contains entries for common loaders', () => {
		expect(LOADER_EMOJIS['fabric']).toBeDefined()
		expect(LOADER_EMOJIS['forge']).toBeDefined()
		expect(LOADER_EMOJIS['neoforge']).toBeDefined()
		expect(LOADER_EMOJIS['quilt']).toBeDefined()
	})
})
