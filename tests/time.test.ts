import { describe, expect, it } from 'vitest'

import { formatDiscordDate, toDate, toUnixTimestamp } from '../src/utils/time.js'

describe('toDate', () => {
	it('passes through a Date instance', () => {
		const date = new Date('2024-01-01T00:00:00Z')
		expect(toDate(date)).toEqual(date)
	})

	it('parses an ISO string', () => {
		expect(toDate('2024-01-01T00:00:00Z')).toEqual(new Date('2024-01-01T00:00:00Z'))
	})
})

describe('toUnixTimestamp', () => {
	it('converts an ISO string to seconds since epoch', () => {
		expect(toUnixTimestamp('2024-01-01T00:00:00Z')).toBe(1704067200)
	})

	it('truncates sub-second precision', () => {
		expect(toUnixTimestamp('2024-01-01T00:00:00.999Z')).toBe(1704067200)
	})
})

describe('formatDiscordDate', () => {
	it('defaults to the "f" style', () => {
		expect(formatDiscordDate('2024-01-01T00:00:00Z')).toBe('<t:1704067200:f>')
	})

	it('accepts a custom style', () => {
		expect(formatDiscordDate('2024-01-01T00:00:00Z', 'R')).toBe('<t:1704067200:R>')
	})
})
