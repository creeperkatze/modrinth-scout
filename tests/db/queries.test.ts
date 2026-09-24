import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { queries } from '../../src/db/queries.js'
import type { RoleRule } from '../../src/db/schemas/guild.js'
import { GuildConfigModel } from '../../src/db/schemas/guild.js'
import { LinkModel } from '../../src/db/schemas/link.js'
import { PendingLinkModel } from '../../src/db/schemas/pendingLink.js'
import { TrackingModel } from '../../src/db/schemas/tracking.js'

let mongod: MongoMemoryServer

beforeAll(async () => {
	mongod = await MongoMemoryServer.create()
	await mongoose.connect(mongod.getUri())
	await Promise.all([TrackingModel.init(), LinkModel.init(), PendingLinkModel.init()])
}, 60_000)

afterEach(async () => {
	await Promise.all([
		TrackingModel.deleteMany({}),
		LinkModel.deleteMany({}),
		PendingLinkModel.deleteMany({}),
		GuildConfigModel.deleteMany({}),
	])
})

afterAll(async () => {
	await mongoose.disconnect()
	await mongod.stop()
})

const GUILD = 'guild-1'

const discovered = (targetId: string, sourceAuthorId: string) => ({
	guildId: GUILD,
	targetId,
	slug: `${targetId}-slug`,
	name: targetId,
	notifiedThrough: new Date('2024-01-01'),
	sourceAuthorId,
})

describe('addDiscoveredProject', () => {
	it('inserts a project sourced from an author and reports it as newly inserted', async () => {
		const inserted = await queries.addDiscoveredProject(discovered('proj-1', 'author-1'))
		expect(inserted).toBe(true)

		const doc = await TrackingModel.findOne({ guildId: GUILD, targetId: 'proj-1' }).lean()
		expect(doc?.sourceAuthorId).toBe('author-1')
		expect(doc?.kind).toBe('project')
	})

	it('stores no overrides so the entry inherits from its author', async () => {
		await queries.addDiscoveredProject(discovered('proj-1', 'author-1'))

		const doc = await TrackingModel.findOne({ guildId: GUILD, targetId: 'proj-1' }).lean()
		expect(doc?.overrides?.channelId).toBeUndefined()
		expect(doc?.overrides?.roleId).toBeUndefined()
		expect(doc?.overrides?.releaseTypes).toBeUndefined()
	})

	it('leaves an already-tracked project untouched and reports it as not newly inserted', async () => {
		await TrackingModel.create({
			guildId: GUILD,
			kind: 'project',
			targetId: 'proj-1',
			slug: 'manual-slug',
			name: 'Manually Tracked',
			notifiedThrough: new Date('2023-01-01'),
			sourceAuthorId: null,
		})

		const inserted = await queries.addDiscoveredProject(discovered('proj-1', 'author-1'))
		expect(inserted).toBe(false)

		const doc = await TrackingModel.findOne({ guildId: GUILD, targetId: 'proj-1' }).lean()
		expect(doc?.slug).toBe('manual-slug')
		expect(doc?.sourceAuthorId).toBeNull()
	})

	it('is atomic under concurrent inserts for the same project', async () => {
		const attempt = () => queries.addDiscoveredProject(discovered('proj-race', 'author-1'))

		const results = await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()])
		expect(results.filter(Boolean)).toHaveLength(1)

		const count = await TrackingModel.countDocuments({ guildId: GUILD, targetId: 'proj-race' })
		expect(count).toBe(1)
	})
})

describe('trackProjectManually', () => {
	it('creates a manually tracked project with only the overrides it was given', async () => {
		await queries.trackProjectManually({
			guildId: GUILD,
			targetId: 'proj-2',
			slug: 'slug-2',
			name: 'Project Two',
			notifiedThrough: new Date('2024-01-01'),
			overrides: { releaseTypes: ['release'] },
		})

		const doc = await TrackingModel.findOne({ guildId: GUILD, targetId: 'proj-2' }).lean()
		expect(doc?.sourceAuthorId).toBeNull()
		expect(doc?.overrides?.releaseTypes).toEqual(['release'])
		expect(doc?.overrides?.channelId).toBeUndefined()
	})

	it('detaches an author-tracked project from its author instead of duplicating it', async () => {
		await queries.addDiscoveredProject(discovered('proj-3', 'author-1'))

		const updated = await queries.trackProjectManually({
			guildId: GUILD,
			targetId: 'proj-3',
			slug: 'proj-3-slug',
			name: 'Project Three',
			notifiedThrough: new Date('2023-01-01'),
			overrides: { channelId: 'channel-1', roleId: 'role-1' },
		})

		expect(updated?.sourceAuthorId).toBeNull()
		expect(updated?.overrides?.channelId).toBe('channel-1')
		expect(updated?.overrides?.roleId).toBe('role-1')

		const count = await TrackingModel.countDocuments({ guildId: GUILD, targetId: 'proj-3' })
		expect(count).toBe(1)
	})

	it('keeps the existing delivery cursor when converting a discovered project', async () => {
		await queries.addDiscoveredProject(discovered('proj-5', 'author-1'))

		const updated = await queries.trackProjectManually({
			guildId: GUILD,
			targetId: 'proj-5',
			slug: 'proj-5-slug',
			name: 'Project Five',
			notifiedThrough: new Date('2020-01-01'),
			overrides: {},
		})

		expect(updated?.notifiedThrough).toEqual(new Date('2024-01-01'))
	})
})

describe('removeTrackedAuthor', () => {
	const addAuthor = (targetId: string) =>
		queries.addTrackedAuthor({
			guildId: GUILD,
			kind: 'user',
			targetId,
			slug: `${targetId}-slug`,
			name: targetId,
			knownProjectIds: [],
			overrides: {},
		})

	it('deletes the author and only the projects it sourced', async () => {
		await addAuthor('author-1')
		await queries.addDiscoveredProject(discovered('auto-1', 'author-1'))
		await queries.addDiscoveredProject(discovered('other-author-1', 'author-2'))
		await queries.trackProjectManually({
			guildId: GUILD,
			targetId: 'manual-1',
			slug: 'manual-1',
			name: 'Manual 1',
			notifiedThrough: new Date(),
			overrides: {},
		})

		await queries.removeTrackedAuthor(GUILD, 'author-1')

		expect(await queries.findTrackedEntry(GUILD, 'author-1')).toBeNull()

		const remaining = await TrackingModel.find({ guildId: GUILD }).select('targetId').lean()
		expect(remaining.map((e) => e.targetId).sort()).toEqual(['manual-1', 'other-author-1'])
	})

	it('leaves a project that was converted to manual tracking in place', async () => {
		await addAuthor('author-1')
		await queries.addDiscoveredProject(discovered('proj-4', 'author-1'))
		await queries.trackProjectManually({
			guildId: GUILD,
			targetId: 'proj-4',
			slug: 'proj-4-slug',
			name: 'Project Four',
			notifiedThrough: new Date(),
			overrides: {},
		})

		await queries.removeTrackedAuthor(GUILD, 'author-1')

		const doc = await TrackingModel.findOne({ guildId: GUILD, targetId: 'proj-4' }).lean()
		expect(doc).not.toBeNull()
		expect(doc?.sourceAuthorId).toBeNull()
	})
})

describe('tracked entry counts', () => {
	it('counts manual projects only, so author-discovered ones stay free', async () => {
		await queries.trackProjectManually({
			guildId: GUILD,
			targetId: 'manual-1',
			slug: 'manual-1',
			name: 'Manual 1',
			notifiedThrough: new Date(),
			overrides: {},
		})
		await queries.addDiscoveredProject(discovered('auto-1', 'author-1'))
		await queries.addDiscoveredProject(discovered('auto-2', 'author-1'))

		expect(await queries.countTrackedProjects(GUILD)).toBe(1)
		expect(await queries.countProjectsFromAuthor(GUILD, 'author-1')).toBe(2)
	})
})

describe('link states', () => {
	it('resolves a state to its Discord user exactly once', async () => {
		await queries.createPendingLink('state-1', 'discord-1')

		expect(await queries.consumePendingLink('state-1')).toBe('discord-1')
		expect(await queries.consumePendingLink('state-1')).toBeNull()
	})

	it('rejects unknown and expired states', async () => {
		await PendingLinkModel.create({
			state: 'expired',
			discordUserId: 'discord-1',
			expiresAt: new Date(Date.now() - 1000),
		})

		expect(await queries.consumePendingLink('expired')).toBeNull()
		expect(await queries.consumePendingLink('unknown')).toBeNull()
	})
})

describe('linked accounts', () => {
	it('links, relinks to a different Modrinth account, and unlinks', async () => {
		await queries.linkAccount('discord-1', 'mr-1', 'alice')
		await queries.linkAccount('discord-1', 'mr-2', 'bob')

		const linked = await queries.getLinkedAccount('discord-1')
		expect(linked).toMatchObject({ modrinthUserId: 'mr-2', modrinthUsername: 'bob' })
		expect(await LinkModel.countDocuments()).toBe(1)

		expect(await queries.unlinkAccount('discord-1')).toMatchObject({ modrinthUsername: 'bob' })
		expect(await queries.unlinkAccount('discord-1')).toBeNull()
		expect(await queries.getLinkedAccount('discord-1')).toBeNull()
	})

	it('moves a Modrinth account to whichever Discord user linked it last', async () => {
		expect(await queries.linkAccount('discord-1', 'mr-1', 'alice')).toEqual([])
		expect(await queries.linkAccount('discord-2', 'mr-1', 'alice')).toEqual(['discord-1'])

		expect(await queries.getLinkedAccount('discord-1')).toBeNull()
		expect(await queries.getLinkedAccount('discord-2')).toMatchObject({ modrinthUserId: 'mr-1' })
	})
})

describe('roles', () => {
	const rule = (roleId: string, conditions: Partial<RoleRule> = {}): RoleRule => ({
		roleId,
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

	it('replaces the rule when the same role is set again', async () => {
		await queries.setRole(GUILD, rule('role-1'))
		await queries.setRole(
			GUILD,
			rule('role-1', {
				project: { id: 'proj-1', slug: 'sodium', name: 'Sodium' },
				minDownloads: 1000,
			}),
		)
		await queries.setRole(GUILD, rule('role-2'))

		const config = await queries.getGuildConfig(GUILD)
		expect(config?.roles).toHaveLength(2)
		expect(config?.roles.find((r) => r.roleId === 'role-1')).toMatchObject({
			project: { id: 'proj-1' },
			minDownloads: 1000,
		})
	})

	it('removes a rule and lists only guilds that still have rules', async () => {
		await queries.setRole(GUILD, rule('role-1'))
		await queries.setRole('guild-2', rule('role-2'))

		expect(await queries.removeRole('guild-2', 'role-2')).toBe(true)
		expect(await queries.removeRole('guild-2', 'role-2')).toBe(false)

		const guilds = await queries.getGuildsWithRoles()
		expect(guilds.map((g) => g._id)).toEqual([GUILD])
	})
})
