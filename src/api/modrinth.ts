import { createRequire } from 'node:module'

import { GenericModrinthClient } from '@modrinth/api-client'

import { createModuleLogger } from '../utils/logger.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const log = createModuleLogger('api')

const USER_AGENT = `creeperkatze/modrinth-scout/${version} (contact@creeperkatze.dev)`

const client = new GenericModrinthClient({
	userAgent: USER_AGENT,
})

export type ModrinthProject = Awaited<ReturnType<typeof client.labrinth.projects_v3.get>>
export type ModrinthProjectLink = ModrinthProject['link_urls'][string]
export type ModrinthUser = Awaited<ReturnType<typeof client.labrinth.users_v2.get>>
export type ModrinthOrganization = Awaited<ReturnType<typeof client.labrinth.organizations_v3.get>>
export type ModrinthCollection = Awaited<ReturnType<typeof client.labrinth.collections.get>>
export type ModrinthVersion = Awaited<ReturnType<typeof client.labrinth.versions_v3.getVersion>>
export type ModrinthSearchResponse = Awaited<ReturnType<typeof client.labrinth.projects_v2.search>>
export type ModrinthSearchHit = ModrinthSearchResponse['hits'][number]

const CACHE_TTL = 10 * 60 * 1000

const cache = new Map<string, { data: unknown; expires: number }>()

setInterval(
	() => {
		const now = Date.now()
		for (const [key, entry] of cache) {
			if (now > entry.expires) cache.delete(key)
		}
	},
	10 * 60 * 1000,
).unref()

async function get<T>(path: string, ttl = CACHE_TTL, params?: Record<string, unknown>): Promise<T> {
	const cacheKey = params ? `${path}?${JSON.stringify(params)}` : path

	if (ttl > 0) {
		const entry = cache.get(cacheKey)
		if (entry && Date.now() < entry.expires) {
			log.debug({ path, params, ttlMs: ttl }, 'Cache hit')
			return entry.data as T
		}
	}

	const startedAt = Date.now()
	log.debug({ path, params, ttlMs: ttl }, 'Fetching from API')
	try {
		const data = await client.request<T>(path, {
			api: 'labrinth',
			version: 3,
			method: 'GET',
			params,
		})
		log.debug({ path, durationMs: Date.now() - startedAt }, 'API response received')

		if (ttl > 0) cache.set(cacheKey, { data, expires: Date.now() + ttl })
		return data
	} catch (error) {
		log.warn(
			{
				path,
				params,
				error,
				durationMs: Date.now() - startedAt,
			},
			'Modrinth API error',
		)
		throw error
	}
}

export interface ModrinthStatistics {
	projects: number
	versions: number
	files: number
	authors: number
}

export type ProjectType =
	| 'mod'
	| 'resourcepack'
	| 'datapack'
	| 'shader'
	| 'modpack'
	| 'plugin'
	| 'minecraft_java_server'

export const PROJECT_TYPES: { name: string; value: ProjectType }[] = [
	{ name: 'Mod', value: 'mod' },
	{ name: 'Resourcepack', value: 'resourcepack' },
	{ name: 'Datapack', value: 'datapack' },
	{ name: 'Shader', value: 'shader' },
	{ name: 'Modpack', value: 'modpack' },
	{ name: 'Plugin', value: 'plugin' },
	{ name: 'Server', value: 'minecraft_java_server' },
]

export const SORT_OPTIONS: { name: string; value: SearchIndex }[] = [
	{ name: 'Relevance', value: 'relevance' },
	{ name: 'Downloads', value: 'downloads' },
	{ name: 'Follows', value: 'follows' },
	{ name: 'Newest', value: 'newest' },
	{ name: 'Recently Updated', value: 'updated' },
]

export type SearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'

export const modrinth = {
	randomProject: (type?: ProjectType) => {
		const params: Record<string, string> = {
			count: '1',
			t: String(Date.now()),
		}
		if (type) params.facets = JSON.stringify([[`project_types:${type}`]])
		return get<ModrinthProject[]>('/projects_random', 0, params).then(([project]) => project)
	},

	search: (
		query: string,
		options?: { type?: ProjectType; index?: SearchIndex; limit?: number; offset?: number },
	) => {
		const params: Parameters<typeof client.labrinth.projects_v2.search>[0] = {
			query,
			limit: options?.limit ?? 5,
			index: options?.index ?? 'relevance',
			offset: options?.offset ?? 0,
		}
		if (options?.type) params.facets = [[`project_type:${options.type}`]]
		return client.labrinth.projects_v2.search(params)
	},

	getProject: (idOrSlug: string) =>
		client.labrinth.projects_v3.get(idOrSlug) as Promise<ModrinthProject>,

	getUser: (idOrUsername: string) =>
		client.labrinth.users_v2.get(idOrUsername) as Promise<ModrinthUser>,

	getUserProjects: (idOrUsername: string) =>
		get<ModrinthProject[]>(`/user/${idOrUsername}/projects`),

	getOrganization: (idOrSlug: string) =>
		client.labrinth.organizations_v3.get(idOrSlug) as Promise<ModrinthOrganization>,

	getOrganizationProjects: (idOrSlug: string) =>
		client.labrinth.organizations_v3.getProjects(idOrSlug) as Promise<ModrinthProject[]>,

	getCollection: (id: string) => client.labrinth.collections.get(id) as Promise<ModrinthCollection>,

	getProjects: (ids: string[], ttl = CACHE_TTL) =>
		ids.length === 0
			? Promise.resolve([] as ModrinthProject[])
			: get<ModrinthProject[]>('/projects', ttl, { ids: JSON.stringify(ids) }),

	getProjectVersions: (idOrSlug: string) =>
		client.labrinth.versions_v3.getProjectVersions(idOrSlug) as Promise<ModrinthVersion[]>,

	getVersion: (id: string) =>
		client.labrinth.versions_v3.getVersion(id) as Promise<ModrinthVersion>,

	getStatistics: () => get<ModrinthStatistics>('/statistics'),
}
