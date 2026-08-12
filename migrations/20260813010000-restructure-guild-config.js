const OPTIONS = {
	autoEmbedsEnabled: 'options.autoEmbeds',
	jarIdentifyEnabled: 'options.jarIdentify',
	changelogSummariesEnabled: 'options.changelogSummaries',
}

const LEGACY_FIELDS = ['linkEmbedsEnabled', 'projectSummariesEnabled', 'versionSummariesEnabled']

const renameCollection = async (db, from, to) => {
	const existing = await db.listCollections({ name: from }).toArray()
	if (existing.length > 0) await db.collection(from).rename(to)
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
	await renameCollection(db, 'servers', 'guilds')

	const guilds = db.collection('guilds')
	await guilds.updateMany({}, { $rename: OPTIONS })

	for (const path of Object.values(OPTIONS)) {
		await guilds.updateMany({ [path]: { $exists: false } }, { $set: { [path]: false } })
	}

	await guilds.updateMany({}, { $unset: Object.fromEntries(LEGACY_FIELDS.map((f) => [f, ''])) })
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
	const guilds = db.collection('guilds')
	const reversed = Object.fromEntries(Object.entries(OPTIONS).map(([flat, path]) => [path, flat]))

	await guilds.updateMany({}, { $rename: reversed })
	await guilds.updateMany({}, { $unset: { options: '' } })

	await renameCollection(db, 'guilds', 'servers')
}
