import { describe, expect, it } from 'vitest'

import { isOptionEnabled } from '../src/db/schemas/guild.js'

describe('isOptionEnabled', () => {
	it('falls back to the default when the option was never set', () => {
		expect(isOptionEnabled(undefined, 'groupVersions')).toBe(true)
		expect(isOptionEnabled({}, 'autoEmbeds')).toBe(false)
		expect(isOptionEnabled({ groupVersions: null }, 'groupVersions')).toBe(true)
	})

	it('uses the stored value when set', () => {
		expect(isOptionEnabled({ groupVersions: false }, 'groupVersions')).toBe(false)
		expect(isOptionEnabled({ autoEmbeds: true }, 'autoEmbeds')).toBe(true)
	})
})
