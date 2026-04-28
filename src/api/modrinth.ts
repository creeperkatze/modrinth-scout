import { createRequire } from 'node:module'

import { createModuleLogger } from '../utils/logger.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const log = createModuleLogger('api')

const BASE_URL = 'https://api.modrinth.com/v3'
const USER_AGENT = `creeperkatze/modrinth-scout/${version} (contact@creeperkatze.dev)`

export interface ModrinthProjectLink {
	platform: string
	donation: boolean
	url: string
}

export interface ModrinthProject {
	id: string
	slug: string
	name: string
	summary: string
	project_types: string[]
	icon_url: string | null
	color: number | null
	downloads: number
	followers: number
	categories: string[]
	additional_categories?: string[]
	game_versions?: string[]
	loaders?: string[]
	updated: string
	published: string
	link_urls: Record<string, ModrinthProjectLink>
}

export interface ModrinthUser {
	id: string
	username: string
	name: string | null
	bio: string | null
	avatar_url: string | null
	created: string
	role: string
}

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

async function get<T>(path: string, ttl = CACHE_TTL): Promise<T> {
	if (ttl > 0) {
		const entry = cache.get(path)
		if (entry && Date.now() < entry.expires) {
			log.debug({ path, ttlMs: ttl }, 'Cache hit')
			return entry.data as T
		}
	}

	const startedAt = Date.now()
	log.debug({ path, ttlMs: ttl }, 'Fetching from API')
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { 'User-Agent': USER_AGENT },
	})
	if (!res.ok) {
		log.warn(
			{
				path,
				status: res.status,
				statusText: res.statusText,
				durationMs: Date.now() - startedAt,
			},
			'Modrinth API error',
		)
		throw new Error(`Modrinth API error: ${res.status} ${res.statusText}`)
	}
	const data = (await res.json()) as T
	log.debug({ path, durationMs: Date.now() - startedAt }, 'API response received')

	if (ttl > 0) cache.set(path, { data, expires: Date.now() + ttl })
	return data
}

export interface ModrinthSearchHit {
	project_id: string
	slug: string
	name: string
	summary: string
	project_types?: string[]
	icon_url: string | null
	color: number | null
	downloads: number
	follows: number
	author: string
	categories: string[]
}

export interface ModrinthSearchResponse {
	hits: ModrinthSearchHit[]
	total_hits: number
}

export interface ModrinthOrganization {
	id: string
	slug: string
	name: string
	description: string
	icon_url: string | null
	color: number | null
}

export interface ModrinthCollection {
	id: string
	user: string
	name: string
	description: string | null
	icon_url: string | null
	color: number | null
	status: string
	created: string
	updated: string
	projects: string[]
}

export interface ModrinthVersion {
	id: string
	project_id: string
	author_id: string
	name: string
	version_number: string
	changelog: string | null
	date_published: string
	downloads: number
	version_type: 'release' | 'beta' | 'alpha'
	status: string
	game_versions: string[]
	loaders: string[]
	files: {
		url: string
		filename: string
		primary: boolean
		size: number
	}[]
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
		const params = new URLSearchParams({
			count: '1',
			t: String(Date.now()),
		})
		if (type) params.set('facets', JSON.stringify([[`project_types:${type}`]]))
		return get<ModrinthProject[]>(`/projects_random?${params}`, 0).then(([project]) => project)
	},

	search: (
		query: string,
		options?: { type?: ProjectType; index?: SearchIndex; limit?: number; offset?: number },
	) => {
		const params = new URLSearchParams({
			query,
			limit: String(options?.limit ?? 5),
			index: options?.index ?? 'relevance',
			offset: String(options?.offset ?? 0),
		})
		if (options?.type) params.set('facets', JSON.stringify([[`project_types:${options.type}`]]))
		return get<ModrinthSearchResponse>(`/search?${params}`)
	},

	getProject: (idOrSlug: string) => get<ModrinthProject>(`/project/${idOrSlug}`),

	getUser: (idOrUsername: string) => get<ModrinthUser>(`/user/${idOrUsername}`),

	getUserProjects: (idOrUsername: string) =>
		get<ModrinthProject[]>(`/user/${idOrUsername}/projects`),

	getOrganization: (idOrSlug: string) => get<ModrinthOrganization>(`/organization/${idOrSlug}`),

	getOrganizationProjects: (idOrSlug: string) =>
		get<ModrinthProject[]>(`/organization/${idOrSlug}/projects`),

	getCollection: (id: string) => get<ModrinthCollection>(`/collection/${id}`),

	getProjects: (ids: string[], ttl = CACHE_TTL) =>
		ids.length === 0
			? Promise.resolve([] as ModrinthProject[])
			: get<ModrinthProject[]>(`/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`, ttl),

	getProjectVersions: (idOrSlug: string) =>
		get<ModrinthVersion[]>(`/project/${idOrSlug}/version`, 0),

	getVersion: (id: string) => get<ModrinthVersion>(`/version/${id}`, 0),

	getStatistics: () => get<ModrinthStatistics>('/statistics'),
}
