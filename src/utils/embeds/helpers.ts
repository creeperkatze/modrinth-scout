import type { Labrinth } from '@modrinth/api-client'

import { emojis, withEmoji } from '../emojis.js'
import { TYPE_LABELS } from './types.js'

const MAX_FIELD_LENGTH = 1024

export function topProjectsList(projects: Labrinth.Projects.v3.Project[]): string {
	const lines = [...projects]
		.sort((a, b) => b.downloads - a.downloads)
		.slice(0, 10)
		.map((p) => {
			const type = p.project_types[0] ?? 'project'
			const url = `https://modrinth.com/${type}/${p.slug}`
			const downloads = p.downloads.toLocaleString('en-US', {
				notation: 'compact',
				maximumFractionDigits: 1,
			})
			const followers = p.followers.toLocaleString('en-US', {
				notation: 'compact',
				maximumFractionDigits: 1,
			})
			const rawLoaders = p.loaders ?? []
			const loaders = rawLoaders.filter((l) => l !== 'minecraft' || rawLoaders.length === 1)
			const loaderEmojis = loaders
				.map((l) => emojis[l])
				.filter(Boolean)
				.join(' ')
			const suffix = loaderEmojis ? ` · ${loaderEmojis}` : ''
			return `${withEmoji(type, `[${p.name}](${url})`)} · ${withEmoji('downloads', downloads)} · ${withEmoji('follows', followers)}${suffix}`
		})

	const shown: string[] = []
	let length = 0
	for (const line of lines) {
		const nextLength = length === 0 ? line.length : length + 1 + line.length
		if (nextLength > MAX_FIELD_LENGTH) break
		shown.push(line)
		length = nextLength
	}

	let note = `*(+${lines.length - shown.length} more)*`
	while (
		shown.length > 0 &&
		lines.length - shown.length > 0 &&
		length + 1 + note.length > MAX_FIELD_LENGTH
	) {
		length -= shown.pop()!.length + 1
		note = `*(+${lines.length - shown.length} more)*`
	}
	if (lines.length - shown.length > 0 && length + 1 + note.length <= MAX_FIELD_LENGTH)
		shown.push(note)

	return shown.join('\n')
}

export function typeLabel(type: string): string {
	return TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

export function totalFollowers(projects: Labrinth.Projects.v3.Project[]): number {
	return projects.reduce((sum, p) => sum + p.followers, 0)
}

export function projectTypeBreakdown(projects: Labrinth.Projects.v3.Project[]): string {
	const counts = new Map<string, number>()
	for (const p of projects) {
		const type = p.project_types[0] ?? 'project'
		counts.set(type, (counts.get(type) ?? 0) + 1)
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([type, count]) => withEmoji(type, `${count} ${typeLabel(type)}${count === 1 ? '' : 's'}`))
		.join(' · ')
}

export function combinedLoaders(projects: Labrinth.Projects.v3.Project[]): string[] {
	const set = new Set<string>()
	for (const p of projects) for (const l of p.loaders ?? []) set.add(l)
	const loaders = [...set]
	return loaders.filter((l) => l !== 'minecraft' || loaders.length === 1)
}
