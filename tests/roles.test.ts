import type { GuildMember } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoleRule } from '../src/db/schemas/guild.js'

const getMembers = vi.fn()
const getOrganization = vi.fn()
const getUser = vi.fn()
const getUserProjects = vi.fn()

vi.mock('../src/utils/api/modrinth.js', () => ({
	modrinthClient: {
		labrinth: {
			projects_v3: { getMembers: (id: string) => getMembers(id) },
			organizations_v3: { get: (id: string) => getOrganization(id) },
			users_v3: {
				get: (id: string) => getUser(id),
				getProjects: (id: string) => getUserProjects(id),
			},
		},
	},
}))

const { describeRule, syncMemberRoles } = await import('../src/utils/roles.js')

const ROLE = 'role-1'

const member = (overrides: { held?: string[]; uneditable?: boolean } = {}) => {
	const held = new Set(overrides.held ?? [])
	return {
		guild: {
			id: 'guild-1',
			roles: { cache: new Map([[ROLE, { id: ROLE, editable: !overrides.uneditable }]]) },
		},
		roles: {
			cache: { has: (id: string) => held.has(id) },
			add: vi.fn(async (role: { id: string }) => held.add(role.id)),
			remove: vi.fn(async (role: { id: string }) => held.delete(role.id)),
		},
	} as unknown as GuildMember
}

const rule = (conditions: Partial<RoleRule> = {}): RoleRule => ({
	roleId: ROLE,
	project: null,
	organization: null,
	minDownloads: null,
	minProjects: null,
	minFollowers: null,
	projectType: null,
	badge: null,
	minAccountAgeDays: null,
	...conditions,
})

const teamMember = (userId: string, accepted = true) => ({ user: { id: userId }, accepted })

const project = (downloads: number, followers: number, type = 'mod') => ({
	downloads,
	followers,
	project_types: [type],
})

const sodium = { id: 'p1', slug: 'sodium', name: 'Sodium' }

// Whether the member ends up with the role after one sync
async function grants(r: RoleRule, modrinthUserId: string | null = 'mr-1') {
	const { added } = await syncMemberRoles(member(), [r], modrinthUserId)
	return added.includes(ROLE)
}

beforeEach(() => {
	getMembers.mockReset()
	getOrganization.mockReset()
	getUser.mockReset()
	getUserProjects.mockReset()
})

describe('syncMemberRoles', () => {
	it('grants a rule without conditions to any linked account, without API calls', async () => {
		expect(await grants(rule())).toBe(true)
		expect(getUser).not.toHaveBeenCalled()
		expect(getUserProjects).not.toHaveBeenCalled()
	})

	it('requires accepted team membership', async () => {
		getMembers.mockResolvedValue([teamMember('mr-1'), teamMember('mr-2', false)])

		expect(await grants(rule({ project: sodium }), 'mr-1')).toBe(true)
		expect(await grants(rule({ project: sodium }), 'mr-2')).toBe(false)
	})

	it('checks organization membership', async () => {
		getOrganization.mockResolvedValue({ members: [teamMember('mr-1')] })
		const org = { id: 'o1', slug: 'caffeine', name: 'CaffeineMC' }

		expect(await grants(rule({ organization: org }))).toBe(true)
	})

	it('sums downloads and followers across projects and counts them', async () => {
		getUserProjects.mockResolvedValue([project(600, 40), project(500, 20, 'shader')])

		expect(await grants(rule({ minDownloads: 1100, minFollowers: 60, minProjects: 2 }))).toBe(true)
		expect(await grants(rule({ minDownloads: 1101 }))).toBe(false)
		expect(await grants(rule({ minFollowers: 61 }))).toBe(false)
		expect(await grants(rule({ minProjects: 3 }))).toBe(false)
	})

	it('requires at least one project of the given type', async () => {
		getUserProjects.mockResolvedValue([project(1, 1, 'mod')])

		expect(await grants(rule({ projectType: 'mod' }))).toBe(true)
		expect(await grants(rule({ projectType: 'shader' }))).toBe(false)
	})

	it('checks badges and account age', async () => {
		const created = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
		getUser.mockResolvedValue({ role: 'developer', badges: 1, created }) // bit 0 = Modrinth+

		expect(await grants(rule({ badge: 'badge-plus', minAccountAgeDays: 10 }))).toBe(true)
		expect(await grants(rule({ badge: 'badge-alpha' }))).toBe(false)
		expect(await grants(rule({ minAccountAgeDays: 11 }))).toBe(false)
	})

	it('requires every set condition to hold', async () => {
		getMembers.mockResolvedValue([teamMember('mr-1')])
		getUserProjects.mockResolvedValue([project(10, 0)])

		expect(await grants(rule({ project: sodium, minDownloads: 5 }))).toBe(true)
		expect(await grants(rule({ project: sodium, minDownloads: 50 }))).toBe(false)
	})

	it('removes the role when the account is unlinked', async () => {
		const result = await syncMemberRoles(member({ held: [ROLE] }), [rule()], null)

		expect(result).toEqual({ added: [], removed: [ROLE] })
	})

	it('leaves the role alone when a lookup fails', async () => {
		getUserProjects.mockRejectedValue(new Error('Modrinth is down'))

		const result = await syncMemberRoles(
			member({ held: [ROLE] }),
			[rule({ minProjects: 1 })],
			'mr-1',
		)

		expect(result).toEqual({ added: [], removed: [] })
	})

	it('skips roles the bot cannot manage', async () => {
		const result = await syncMemberRoles(member({ uneditable: true }), [rule()], 'mr-1')

		expect(result).toEqual({ added: [], removed: [] })
	})

	it('fetches each lookup once per shared cache', async () => {
		getMembers.mockResolvedValue([teamMember('mr-1')])
		getUserProjects.mockResolvedValue([project(10, 0)])
		const cache = new Map()
		const r = rule({ project: sodium, minDownloads: 1 })

		await syncMemberRoles(member(), [r], 'mr-1', cache)
		await syncMemberRoles(member(), [r], 'mr-1', cache)

		expect(getMembers).toHaveBeenCalledTimes(1)
		expect(getUserProjects).toHaveBeenCalledTimes(1)
	})
})

describe('describeRule', () => {
	it('falls back to any linked account when no conditions are set', () => {
		expect(describeRule(rule())).toEqual(['Any linked Modrinth account'])
	})

	it('lists one line per condition', () => {
		const lines = describeRule(rule({ project: sodium, minDownloads: 10000 }))

		expect(lines).toEqual([
			'Team member of **[Sodium](https://modrinth.com/project/sodium)**',
			'At least 10,000 downloads',
		])
	})
})
