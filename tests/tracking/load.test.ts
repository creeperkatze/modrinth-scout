import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { ServerModel } from '../../src/db/schemas/server.js'
import { TrackingModel } from '../../src/db/schemas/tracking.js'
import { loadTrackingBatch } from '../../src/utils/tracking/load.js'

let mongod: MongoMemoryServer

beforeAll(async () => {
	mongod = await MongoMemoryServer.create()
	await mongoose.connect(mongod.getUri())
	await Promise.all([TrackingModel.init(), ServerModel.init()])
}, 60_000)

afterEach(async () => {
	await Promise.all([TrackingModel.deleteMany({}), ServerModel.deleteMany({})])
})

afterAll(async () => {
	await mongoose.disconnect()
	await mongod.stop()
})

const GUILD = 'guild-1'

const createServer = (overrides: Record<string, unknown> = {}) =>
	ServerModel.create({
		_id: GUILD,
		tracking: {
			channelId: 'guild-channel',
			roleId: 'guild-role',
			releaseTypes: ['release', 'beta', 'alpha'],
			paused: false,
			...overrides,
		},
	})

const createAuthor = (overrides: Record<string, unknown> = {}) =>
	TrackingModel.create({
		guildId: GUILD,
		kind: 'user',
		targetId: 'author-1',
		slug: 'author-one',
		name: 'Author One',
		knownProjectIds: [],
		notifiedThrough: new Date('2024-01-01'),
		overrides,
	})

const createProject = (targetId: string, doc: Record<string, unknown> = {}) =>
	TrackingModel.create({
		guildId: GUILD,
		kind: 'project',
		targetId,
		slug: targetId,
		name: targetId,
		notifiedThrough: new Date('2024-01-01'),
		overrides: {},
		...doc,
	})

describe('loadTrackingBatch', () => {
	it('splits targets by kind', async () => {
		await createServer()
		await createAuthor()
		await createProject('proj-1')

		const batch = await loadTrackingBatch()

		expect(batch.projects).toHaveLength(1)
		expect(batch.authors).toHaveLength(1)
		expect(batch.entryCount).toBe(2)
	})

	it('resolves a discovered project against its author, then the guild', async () => {
		await createServer()
		await createAuthor({ channelId: 'author-channel', releaseTypes: ['release'] })
		await createProject('proj-1', { sourceAuthorId: 'author-1' })

		const batch = await loadTrackingBatch()
		const settings = batch.projects[0].subscriptions[0].settings

		expect(settings.channelId).toBe('author-channel')
		expect(settings.releaseTypes).toEqual(['release'])
		expect(settings.roleId).toBe('guild-role')
	})

	it('lets a discovered project override its author', async () => {
		await createServer()
		await createAuthor({ channelId: 'author-channel' })
		await createProject('proj-1', {
			sourceAuthorId: 'author-1',
			overrides: { channelId: 'project-channel' },
		})

		const batch = await loadTrackingBatch()
		expect(batch.projects[0].subscriptions[0].settings.channelId).toBe('project-channel')
	})

	it('groups the same project across guilds into one target', async () => {
		await createServer()
		await ServerModel.create({ _id: 'guild-2', tracking: { channelId: 'other-channel' } })
		await createProject('proj-1')
		await TrackingModel.create({
			guildId: 'guild-2',
			kind: 'project',
			targetId: 'proj-1',
			slug: 'proj-1',
			name: 'proj-1',
			notifiedThrough: new Date('2024-01-01'),
			overrides: {},
		})

		const batch = await loadTrackingBatch()

		expect(batch.projects).toHaveLength(1)
		expect(batch.projects[0].subscriptions).toHaveLength(2)
	})

	it('drops entries with no channel anywhere in the chain', async () => {
		await createServer({ channelId: null })
		await createProject('proj-1')
		await createProject('proj-2', { overrides: { channelId: 'project-channel' } })

		const batch = await loadTrackingBatch()

		expect(batch.projects.map((t) => t.targetId)).toEqual(['proj-2'])
	})

	it('skips paused guilds entirely', async () => {
		await createServer({ paused: true })
		await createProject('proj-1')

		const batch = await loadTrackingBatch()
		expect(batch.entryCount).toBe(0)
	})

	it('filters by donator tier when perks are in use', async () => {
		await createServer()
		await createProject('proj-1')

		expect((await loadTrackingBatch(true)).entryCount).toBe(0)
		expect((await loadTrackingBatch(false)).entryCount).toBe(1)
	})
})
