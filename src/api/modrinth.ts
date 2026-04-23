const BASE_URL = 'https://api.modrinth.com/v2'
const USER_AGENT = `creeperkatze/modrinth-scout/${process.env.npm_package_version} (contact@creeperkatze.dev)`

export interface ModrinthProject {
	id: string
	slug: string
	title: string
	description: string
	project_type: string
	icon_url: string | null
	color: number | null
	downloads: number
	followers: number
	categories: string[]
	additional_categories: string[]
	game_versions: string[]
	loaders: string[]
	updated: string
	published: string
	source_url: string | null
	issues_url: string | null
	wiki_url: string | null
	discord_url: string | null
	client_side: 'required' | 'optional' | 'unsupported'
	server_side: 'required' | 'optional' | 'unsupported'
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

async function get<T>(path: string): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		headers: { 'User-Agent': USER_AGENT },
	})
	if (!res.ok) throw new Error(`Modrinth API error: ${res.status} ${res.statusText}`)
	return res.json() as Promise<T>
}

export interface ModrinthSearchHit {
	project_id: string
	slug: string
	title: string
	description: string
	project_type: string
	icon_url: string | null
	color: number | null
	downloads: number
	follows: number
	author: string
	categories: string[]
	latest_version: string
}

export interface ModrinthSearchResponse {
	hits: ModrinthSearchHit[]
	total_hits: number
}

export type ProjectType =
	| 'mod'
	| 'resourcepack'
	| 'datapack'
	| 'shader'
	| 'modpack'
	| 'plugin'
	| 'minecraft_java_server'
export type SearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'

export const modrinth = {
	randomProject: () =>
		get<ModrinthProject[]>('/projects_random?count=1').then(([project]) => project),

	search: (
		query: string,
		options?: { type?: ProjectType; index?: SearchIndex; limit?: number },
	) => {
		const params = new URLSearchParams({
			query,
			limit: String(options?.limit ?? 5),
			index: options?.index ?? 'relevance',
		})
		if (options?.type) params.set('facets', JSON.stringify([[`project_type:${options.type}`]]))
		return get<ModrinthSearchResponse>(`/search?${params}`)
	},

	getProject: (idOrSlug: string) => get<ModrinthProject>(`/project/${idOrSlug}`),

	getUser: (idOrUsername: string) => get<ModrinthUser>(`/user/${idOrUsername}`),

	getUserProjects: (idOrUsername: string) =>
		get<ModrinthProject[]>(`/user/${idOrUsername}/projects`),
}
