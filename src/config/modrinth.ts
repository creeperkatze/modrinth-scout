export type ProjectType =
	'mod' | 'resourcepack' | 'datapack' | 'shader' | 'modpack' | 'plugin' | 'minecraft_java_server'

export const PROJECT_TYPES: { name: string; value: ProjectType }[] = [
	{ name: 'Mod', value: 'mod' },
	{ name: 'Resourcepack', value: 'resourcepack' },
	{ name: 'Datapack', value: 'datapack' },
	{ name: 'Shader', value: 'shader' },
	{ name: 'Modpack', value: 'modpack' },
	{ name: 'Plugin', value: 'plugin' },
	{ name: 'Server', value: 'minecraft_java_server' },
]

export type SearchIndex = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'

export const SORT_OPTIONS: { name: string; value: SearchIndex }[] = [
	{ name: 'Relevance', value: 'relevance' },
	{ name: 'Downloads', value: 'downloads' },
	{ name: 'Follows', value: 'follows' },
	{ name: 'Newest', value: 'newest' },
	{ name: 'Recently Updated', value: 'updated' },
]
