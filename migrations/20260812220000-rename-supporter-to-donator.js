/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
	const supporters = await db.listCollections({ name: 'supporters' }).toArray()
	if (supporters.length > 0) {
		await db.collection('supporters').rename('donators')
	}
	await db.collection('servers').updateMany({}, { $rename: { isSupporter: 'isDonator' } })
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
	const donators = await db.listCollections({ name: 'donators' }).toArray()
	if (donators.length > 0) {
		await db.collection('donators').rename('supporters')
	}
	await db.collection('servers').updateMany({}, { $rename: { isDonator: 'isSupporter' } })
}
