import { describe, expect, it } from 'vitest'

import { isSettingEnabled } from '../src/db/schemas/guild.js'

describe('isSettingEnabled', () => {
	it('falls back to the default when the setting was never set', () => {
		expect(isSettingEnabled(undefined, 'groupVersions')).toBe(true)
		expect(isSettingEnabled({}, 'autoEmbeds')).toBe(false)
		expect(isSettingEnabled({ groupVersions: null }, 'groupVersions')).toBe(true)
	})

	it('uses the stored value when set', () => {
		expect(isSettingEnabled({ groupVersions: false }, 'groupVersions')).toBe(false)
		expect(isSettingEnabled({ autoEmbeds: true }, 'autoEmbeds')).toBe(true)
	})
})
