import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { connectDb } from '../../src/db/index.js'

let mongod: MongoMemoryServer
let originalUri: string | undefined

beforeEach(() => {
	originalUri = process.env.MONGODB_URI
}, 60_000)

afterEach(async () => {
	await mongoose.disconnect()
	await mongod.stop()
	process.env.MONGODB_URI = originalUri
})

describe('connectDb', () => {
	it('applies pending migrations before connecting Mongoose', async () => {
		mongod = await MongoMemoryServer.create()
		process.env.MONGODB_URI = `${mongod.getUri()}modrinth_scout_test`

		await connectDb()

		expect(mongoose.connection.readyState).toBe(1)

		const changelog = await mongoose.connection.db!.collection('changelog').find().toArray()
		expect(changelog.map((entry) => entry.fileName)).toContain(
			'20260812220000-rename-supporter-to-donator.js',
		)
	})

	it('is idempotent: a second connectDb() does not re-apply already-run migrations', async () => {
		mongod = await MongoMemoryServer.create()
		process.env.MONGODB_URI = `${mongod.getUri()}modrinth_scout_test`

		await connectDb()
		await mongoose.disconnect()
		await connectDb()

		expect(mongoose.connection.readyState).toBe(1)

		const changelog = await mongoose.connection.db!.collection('changelog').find().toArray()
		const applications = changelog.filter(
			(entry) => entry.fileName === '20260812220000-rename-supporter-to-donator.js',
		)
		expect(applications).toHaveLength(1)
	})
})
