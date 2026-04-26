const PROJECT_TYPE_SEGMENTS = new Set([
	'mod',
	'plugin',
	'modpack',
	'resourcepack',
	'shader',
	'datapack',
	'server',
])

export type ParsedModrinthUrl =
	| { type: 'project'; slug: string }
	| { type: 'user'; username: string }
	| { type: 'organization'; slug: string }
	| { type: 'collection'; id: string }

export function parseModrinthUrl(input: string): ParsedModrinthUrl | null {
	let url: URL
	try {
		url = new URL(input)
	} catch {
		return null
	}

	if (url.hostname !== 'modrinth.com') return null

	const parts = url.pathname.split('/').filter(Boolean)
	if (parts.length < 2) return null

	const [segment, slug] = parts

	if (PROJECT_TYPE_SEGMENTS.has(segment)) return { type: 'project', slug }
	if (segment === 'user') return { type: 'user', username: slug }
	if (segment === 'organization') return { type: 'organization', slug }
	if (segment === 'collection') return { type: 'collection', id: slug }

	return null
}
