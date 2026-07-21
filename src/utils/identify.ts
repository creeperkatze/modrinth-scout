import { createHash } from 'node:crypto'

import { modrinthClient } from './api/modrinth.js'

export const MAX_JAR_FILE_BYTES = 100 * 1024 * 1024 // 100 mb

export async function hashAttachment(url: string): Promise<string> {
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
	if (!response.body) throw new Error('Download returned an empty body')

	// Hashed as it streams so a large upload never sits in memory whole.
	const hasher = createHash('sha1')
	for await (const chunk of response.body) hasher.update(chunk)
	return hasher.digest('hex')
}

export async function identifyByHash(hash: string) {
	const match = await modrinthClient.labrinth.versions_v2.getVersionFromFileHash(hash, 'sha1')
	const [version, project] = await Promise.all([
		modrinthClient.labrinth.versions_v3.getVersion(match.id),
		modrinthClient.labrinth.projects_v3.get(match.project_id),
	])
	return { project, version }
}
