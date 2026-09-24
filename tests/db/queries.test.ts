import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { queries } from '../../src/db/queries.js'
import { LinkedAccountModel } from '../../src/db/schemas/linkedAccount.js'
import { LinkStateModel } from '../../src/db/schemas/linkState.js'
import { TrackingModel } from '../../src/db/schemas/tracking.js'

let mongod: MongoMemoryServer

beforeAll(async () => {
	mongod = await MongoMemoryServer.create()
	await mongoose.connect(mongod.getUri())
	await Promise.all([TrackingModel.init(), LinkedAccountModel.init(), LinkStateModel.init()])
}, 60_000)

afterEach(async () => {
	await Promise.all([
		TrackingModel.deleteMany({}),
		LinkedAccountModel.deleteMany({}),
		LinkStateModel.deleteMany({}),
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
		await queries.createLinkState('state-1', 'discord-1')

		expect(await queries.consumeLinkState('state-1')).toBe('discord-1')
		expect(await queries.consumeLinkState('state-1')).toBeNull()
	})

	it('rejects unknown and expired states', async () => {
		await LinkStateModel.create({
			state: 'expired',
			discordUserId: 'discord-1',
			expiresAt: new Date(Date.now() - 1000),
		})

		expect(await queries.consumeLinkState('expired')).toBeNull()
		expect(await queries.consumeLinkState('unknown')).toBeNull()
	})
})

describe('linked accounts', () => {
	it('links, relinks to a different Modrinth account, and unlinks', async () => {
		await queries.linkAccount('discord-1', 'mr-1', 'alice')
		await queries.linkAccount('discord-1', 'mr-2', 'bob')

		const linked = await queries.getLinkedAccount('discord-1')
		expect(linked).toMatchObject({ modrinthUserId: 'mr-2', modrinthUsername: 'bob' })
		expect(await LinkedAccountModel.countDocuments()).toBe(1)

		expect(await queries.unlinkAccount('discord-1')).toMatchObject({ modrinthUsername: 'bob' })
		expect(await queries.unlinkAccount('discord-1')).toBeNull()
		expect(await queries.getLinkedAccount('discord-1')).toBeNull()
	})

	it('moves a Modrinth account to whichever Discord user linked it last', async () => {
		await queries.linkAccount('discord-1', 'mr-1', 'alice')
		await queries.linkAccount('discord-2', 'mr-1', 'alice')

		expect(await queries.getLinkedAccount('discord-1')).toBeNull()
		expect(await queries.getLinkedAccount('discord-2')).toMatchObject({ modrinthUserId: 'mr-1' })
	})
})
