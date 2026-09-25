const COLLECTIONS = {
	links: 'accounts',
	pending_links: 'pending_accounts',
}

const renameCollection = async (db, from, to) => {
	const existing = await db.listCollections({ name: from }).toArray()
	if (existing.length > 0) await db.collection(from).rename(to)
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
	for (const [from, to] of Object.entries(COLLECTIONS)) await renameCollection(db, from, to)
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
	for (const [from, to] of Object.entries(COLLECTIONS)) await renameCollection(db, to, from)
}
