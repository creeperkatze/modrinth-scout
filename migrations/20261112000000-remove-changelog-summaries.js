/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
	await db
		.collection('guilds')
		.updateMany(
			{ 'options.changelogSummaries': { $exists: true } },
			{ $unset: { 'options.changelogSummaries': '' } },
		)
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async () => {}
