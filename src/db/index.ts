import mongoose from 'mongoose'

import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('db')

export async function connectDb() {
	mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'))
	mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'))
	mongoose.connection.on('error', (err) => log.error({ err }, 'MongoDB error'))

	const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/modrinth_scout'
	const startedAt = Date.now()
	log.info('Connecting to MongoDB')
	await mongoose.connect(uri)
	log.info({ durationMs: Date.now() - startedAt }, 'Connected to MongoDB')
}
