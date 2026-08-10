import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { queries } from '../../src/db/queries.js'
import { AuthorModel } from '../../src/db/schemas/author.js'
import { ProjectModel } from '../../src/db/schemas/project.js'

let mongod: MongoMemoryServer

beforeAll(async () => {
	mongod = await MongoMemoryServer.create()
	await mongoose.connect(mongod.getUri())
	await Promise.all([ProjectModel.init(), AuthorModel.init()])
}, 60_000)

afterEach(async () => {
	await Promise.all([ProjectModel.deleteMany({}), AuthorModel.deleteMany({})])
})

afterAll(async () => {
	await mongoose.disconnect()
	await mongod.stop()
})

const GUILD = 'guild-1'

describe('addTrackedProjectIfMissing', () => {
	it('inserts a new project sourced from an author and reports it as newly inserted', async () => {
		const inserted = await queries.addTrackedProjectIfMissing(
			GUILD,
			'proj-1',
			'proj-1-slug',
			'Project One',
			new Date('2024-01-01'),
			undefined,
			null,
			null,
			'author-1',
		)
		expect(inserted).toBe(true)

		const doc = await ProjectModel.findOne({ guildId: GUILD, projectId: 'proj-1' }).lean()
		expect(doc?.sourceAuthorId).toBe('author-1')
	})

	it('leaves an already-tracked project untouched and reports it as not newly inserted', async () => {
		await ProjectModel.create({
			guildId: GUILD,
			projectId: 'proj-1',
			slug: 'manual-slug',
			name: 'Manually Tracked',
			lastUpdated: new Date('2023-01-01'),
			sourceAuthorId: null,
		})

		const inserted = await queries.addTrackedProjectIfMissing(
			GUILD,
			'proj-1',
			'author-slug',
			'Author Name',
			new Date('2024-01-01'),
			undefined,
			null,
			null,
			'author-1',
		)
		expect(inserted).toBe(false)

		const doc = await ProjectModel.findOne({ guildId: GUILD, projectId: 'proj-1' }).lean()
		expect(doc?.slug).toBe('manual-slug')
		expect(doc?.sourceAuthorId).toBeNull()
	})

	it('is atomic under concurrent inserts for the same project', async () => {
		const attempt = () =>
			queries.addTrackedProjectIfMissing(
				GUILD,
				'proj-race',
				'slug',
				'Name',
				new Date(),
				undefined,
				null,
				null,
				'author-1',
			)

		const results = await Promise.all([attempt(), attempt(), attempt(), attempt(), attempt()])
		expect(results.filter(Boolean)).toHaveLength(1)

		const count = await ProjectModel.countDocuments({ guildId: GUILD, projectId: 'proj-race' })
		expect(count).toBe(1)
	})
})

describe('trackProjectManually', () => {
	it('creates a new manually tracked project when none exists', async () => {
		await queries.trackProjectManually(
			GUILD,
			'proj-2',
			'slug-2',
			'Project Two',
			new Date('2024-01-01'),
			['release'],
			null,
			null,
		)

		const doc = await ProjectModel.findOne({ guildId: GUILD, projectId: 'proj-2' }).lean()
		expect(doc?.sourceAuthorId).toBeNull()
		expect(doc?.releaseType).toEqual(['release'])
	})

	it('detaches an author-tracked project from its author instead of duplicating it', async () => {
		await ProjectModel.create({
			guildId: GUILD,
			projectId: 'proj-3',
			slug: 'auto-slug',
			name: 'Auto Tracked',
			lastUpdated: new Date('2023-01-01'),
			sourceAuthorId: 'author-1',
		})

		const updated = await queries.trackProjectManually(
			GUILD,
			'proj-3',
			'auto-slug',
			'Auto Tracked',
			new Date('2023-01-01'),
			['release', 'beta', 'alpha'],
			'channel-1',
			'role-1',
		)

		expect(updated?.sourceAuthorId).toBeNull()
		expect(updated?.channelId).toBe('channel-1')
		expect(updated?.roleId).toBe('role-1')

		const count = await ProjectModel.countDocuments({ guildId: GUILD, projectId: 'proj-3' })
		expect(count).toBe(1)
	})
})

describe('removeTrackedAuthor', () => {
	it('deletes the author and only the projects it sourced', async () => {
		await AuthorModel.create({
			guildId: GUILD,
			authorId: 'author-1',
			authorType: 'user',
			username: 'author-one',
			name: 'Author One',
		})
		await ProjectModel.create([
			{
				guildId: GUILD,
				projectId: 'auto-1',
				slug: 'auto-1',
				name: 'Auto 1',
				lastUpdated: new Date(),
				sourceAuthorId: 'author-1',
			},
			{
				guildId: GUILD,
				projectId: 'manual-1',
				slug: 'manual-1',
				name: 'Manual 1',
				lastUpdated: new Date(),
				sourceAuthorId: null,
			},
			{
				guildId: GUILD,
				projectId: 'other-author-1',
				slug: 'other-author-1',
				name: 'Other',
				lastUpdated: new Date(),
				sourceAuthorId: 'author-2',
			},
		])

		await queries.removeTrackedAuthor(GUILD, 'author-1')

		const author = await AuthorModel.findOne({ guildId: GUILD, authorId: 'author-1' })
		expect(author).toBeNull()

		const remaining = await ProjectModel.find({ guildId: GUILD }).select('projectId').lean()
		expect(remaining.map((p) => p.projectId).sort()).toEqual(['manual-1', 'other-author-1'])
	})

	it('leaves a project that was converted to manual tracking in place', async () => {
		await AuthorModel.create({
			guildId: GUILD,
			authorId: 'author-1',
			authorType: 'user',
			username: 'author-one',
			name: 'Author One',
		})
		await queries.addTrackedProjectIfMissing(
			GUILD,
			'proj-4',
			'proj-4-slug',
			'Project Four',
			new Date(),
			undefined,
			null,
			null,
			'author-1',
		)
		await queries.trackProjectManually(
			GUILD,
			'proj-4',
			'proj-4-slug',
			'Project Four',
			new Date(),
			['release', 'beta', 'alpha'],
			null,
			null,
		)

		await queries.removeTrackedAuthor(GUILD, 'author-1')

		const doc = await ProjectModel.findOne({ guildId: GUILD, projectId: 'proj-4' }).lean()
		expect(doc).not.toBeNull()
		expect(doc?.sourceAuthorId).toBeNull()
	})
})
