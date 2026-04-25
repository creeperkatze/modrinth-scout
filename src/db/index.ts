import mongoose from 'mongoose'

import { logger } from '../utils/logger.js'

const log = logger.child({ module: 'db' })

export async function connectDb() {
	mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'))
	mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'))
	mongoose.connection.on('error', (err) => log.error({ err }, 'MongoDB error'))

	const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/modrinth_scout'
	await mongoose.connect(uri)
	log.info('Connected to MongoDB')
}
