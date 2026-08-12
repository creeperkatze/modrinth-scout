import { describe, expect, it } from 'vitest'

import {
	formatReleaseTypeLabel,
	resolveTrackingSettings,
} from '../../src/utils/tracking/settings.js'

const guildDefaults = {
	channelId: 'guild-channel',
	roleId: 'guild-role',
	releaseTypes: ['release', 'beta', 'alpha'],
}

describe('resolveTrackingSettings', () => {
	it('falls back to the guild defaults when nothing overrides them', () => {
		expect(resolveTrackingSettings({}, undefined, guildDefaults)).toEqual(guildDefaults)
	})

	it('resolves each key independently down the chain', () => {
		const settings = resolveTrackingSettings(
			{ channelId: 'project-channel' },
			{ roleId: 'author-role', releaseTypes: ['release'] },
			guildDefaults,
		)

		expect(settings).toEqual({
			channelId: 'project-channel',
			roleId: 'author-role',
			releaseTypes: ['release'],
		})
	})

	it('lets an author override reach the projects it discovered', () => {
		const settings = resolveTrackingSettings(
			{},
			{ channelId: 'author-channel', releaseTypes: ['release'] },
			guildDefaults,
		)

		expect(settings.channelId).toBe('author-channel')
		expect(settings.releaseTypes).toEqual(['release'])
		expect(settings.roleId).toBe('guild-role')
	})

	it('treats an explicit null role as never ping, not as inherit', () => {
		expect(resolveTrackingSettings({ roleId: null }, undefined, guildDefaults).roleId).toBeNull()
		expect(resolveTrackingSettings({}, { roleId: null }, guildDefaults).roleId).toBeNull()
	})

	it('reports no channel when neither the entry nor the guild has one', () => {
		const settings = resolveTrackingSettings({}, undefined, { ...guildDefaults, channelId: null })
		expect(settings.channelId).toBeNull()
	})

	it('ignores an empty release type list rather than muting every version', () => {
		const settings = resolveTrackingSettings({ releaseTypes: [] }, undefined, guildDefaults)
		expect(settings.releaseTypes).toEqual(['release', 'beta', 'alpha'])
	})
})

describe('formatReleaseTypeLabel', () => {
	it('names the full set', () => {
		expect(formatReleaseTypeLabel(['release', 'beta', 'alpha'])).toBe('all releases')
	})

	it('names a single type', () => {
		expect(formatReleaseTypeLabel(['beta'])).toBe('beta releases')
	})

	it('joins a partial set', () => {
		expect(formatReleaseTypeLabel(['release', 'beta'])).toBe('release and beta releases')
	})
})
