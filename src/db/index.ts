import mongoose from 'mongoose'

import { logger } from '../utils/logger.js'

const log = logger.child({ module: 'db' })

export async function connectDb() {
	const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/modrinth_scout'
	await mongoose.connect(uri)
	log.info('Connected to MongoDB')
}
