/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
	await db
		.collection('guilds')
		.updateMany({ options: { $exists: true } }, { $rename: { options: 'settings' } })
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
	await db
		.collection('guilds')
		.updateMany({ settings: { $exists: true } }, { $rename: { settings: 'options' } })
}
