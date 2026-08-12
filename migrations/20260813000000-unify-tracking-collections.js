const RELEASE_TYPES = ['release', 'beta', 'alpha']

const buildOverrides = (channelId, roleId, releaseTypes) => {
	const overrides = {}
	if (channelId) overrides.channelId = channelId
	if (roleId) overrides.roleId = roleId
	if (
		Array.isArray(releaseTypes) &&
		releaseTypes.length > 0 &&
		releaseTypes.length < RELEASE_TYPES.length
	) {
		overrides.releaseTypes = releaseTypes
	}
	return overrides
}

const dropIfExists = async (db, name) => {
	const existing = await db.listCollections({ name }).toArray()
	if (existing.length > 0) await db.collection(name).drop()
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
	const servers = db.collection('servers')
	await servers.updateMany(
		{},
		{
			$rename: {
				trackingChannelId: 'tracking.channelId',
				trackingRoleId: 'tracking.roleId',
				trackingPaused: 'tracking.paused',
			},
		},
	)
	await servers.updateMany(
		{ 'tracking.channelId': { $exists: false } },
		{ $set: { 'tracking.channelId': null } },
	)
	await servers.updateMany(
		{ 'tracking.roleId': { $exists: false } },
		{ $set: { 'tracking.roleId': null } },
	)
	await servers.updateMany(
		{ 'tracking.paused': { $exists: false } },
		{ $set: { 'tracking.paused': false } },
	)
	await servers.updateMany(
		{ 'tracking.releaseTypes': { $exists: false } },
		{ $set: { 'tracking.releaseTypes': RELEASE_TYPES } },
	)

	const now = new Date()
	const authors = await db.collection('authors').find().toArray()
	const projects = await db.collection('projects').find().toArray()
	const entries = []

	for (const author of authors) {
		entries.push({
			guildId: author.guildId,
			kind: author.authorType,
			targetId: author.authorId,
			slug: author.username,
			name: author.name,
			sourceAuthorId: null,
			overrides: buildOverrides(author.channelId, author.roleId, null),
			notifiedThrough: author.updatedAt ?? author.createdAt ?? now,
			knownProjectIds: author.knownProjectIds ?? [],
			createdAt: author.createdAt ?? now,
			updatedAt: author.updatedAt ?? now,
		})
	}

	for (const project of projects) {
		// Discovered projects drop their copied channel/role and inherit from the author entry instead
		const discovered = Boolean(project.sourceAuthorId)
		entries.push({
			guildId: project.guildId,
			kind: 'project',
			targetId: project.projectId,
			slug: project.slug,
			name: project.name,
			sourceAuthorId: project.sourceAuthorId ?? null,
			overrides: discovered
				? {}
				: buildOverrides(project.channelId, project.roleId, project.releaseType),
			notifiedThrough: project.lastUpdated ?? now,
			createdAt: project.createdAt ?? now,
			updatedAt: project.updatedAt ?? now,
		})
	}

	if (entries.length > 0) await db.collection('tracking').insertMany(entries)

	await db
		.collection('tracking')
		.createIndex({ guildId: 1, targetId: 1, kind: 1 }, { unique: true })
	await db.collection('tracking').createIndex({ kind: 1, targetId: 1 })
	await db.collection('tracking').createIndex({ guildId: 1, kind: 1, sourceAuthorId: 1 })

	await dropIfExists(db, 'projects')
	await dropIfExists(db, 'authors')
}

/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const down = async (db) => {
	const now = new Date()
	const entries = await db.collection('tracking').find().toArray()
	const projects = []
	const authors = []

	for (const entry of entries) {
		const overrides = entry.overrides ?? {}
		if (entry.kind === 'project') {
			projects.push({
				guildId: entry.guildId,
				projectId: entry.targetId,
				slug: entry.slug,
				name: entry.name,
				releaseType: overrides.releaseTypes ?? RELEASE_TYPES,
				channelId: overrides.channelId ?? null,
				roleId: overrides.roleId ?? null,
				lastUpdated: entry.notifiedThrough ?? now,
				sourceAuthorId: entry.sourceAuthorId ?? null,
				createdAt: entry.createdAt ?? now,
				updatedAt: entry.updatedAt ?? now,
			})
		} else {
			authors.push({
				guildId: entry.guildId,
				authorId: entry.targetId,
				authorType: entry.kind,
				username: entry.slug,
				name: entry.name,
				knownProjectIds: entry.knownProjectIds ?? [],
				channelId: overrides.channelId ?? null,
				roleId: overrides.roleId ?? null,
				createdAt: entry.createdAt ?? now,
				updatedAt: entry.updatedAt ?? now,
			})
		}
	}

	if (projects.length > 0) await db.collection('projects').insertMany(projects)
	if (authors.length > 0) await db.collection('authors').insertMany(authors)
	await dropIfExists(db, 'tracking')

	const servers = db.collection('servers')
	await servers.updateMany(
		{},
		{
			$rename: {
				'tracking.channelId': 'trackingChannelId',
				'tracking.roleId': 'trackingRoleId',
				'tracking.paused': 'trackingPaused',
			},
		},
	)
	await servers.updateMany({}, { $unset: { tracking: '' } })
}
