import { config, database, up } from 'migrate-mongo'
import mongoose from 'mongoose'

import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('db')

async function runMigrations(uri: string) {
	config.set({
		mongodb: { url: uri },
		migrationsDir: 'migrations',
		changelogCollectionName: 'changelog',
		migrationFileExtension: '.js',
		useFileHash: false,
	})

	const { db, client } = await database.connect()
	try {
		const migrated = await up(db, client)
		for (const fileName of migrated) log.info({ fileName }, 'Applied database migration')
	} finally {
		await client.close()
	}
}

export async function connectDb() {
	mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'))
	mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'))
	mongoose.connection.on('error', (err) => log.error({ err }, 'MongoDB error'))

	const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/modrinth_scout'

	await runMigrations(uri)

	const startedAt = Date.now()
	log.info('Connecting to MongoDB')
	await mongoose.connect(uri)
	log.info({ durationMs: Date.now() - startedAt }, 'Connected to MongoDB')
}
