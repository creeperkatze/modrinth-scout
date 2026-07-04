import type { Labrinth } from '@modrinth/api-client'

import { emojis } from '../emojis.js'
import { TYPE_LABELS } from './types.js'

export function topProjectsList(projects: Labrinth.Projects.v3.Project[]): string {
	return [...projects]
		.sort((a, b) => b.downloads - a.downloads)
		.slice(0, 5)
		.map(
			(p) =>
				`[${p.name}](https://modrinth.com/${p.project_types[0]}/${p.slug}) — ${p.downloads.toLocaleString('en-US')} downloads`,
		)
		.join('\n')
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
		.map(([type, count]) => {
			const emoji = emojis[type]
			const label = `${count} ${typeLabel(type)}${count === 1 ? '' : 's'}`
			return emoji ? `${emoji} ${label}` : label
		})
		.join(' · ')
}

export function combinedLoaders(projects: Labrinth.Projects.v3.Project[]): string[] {
	const set = new Set<string>()
	for (const p of projects) for (const l of p.loaders ?? []) set.add(l)
	const loaders = [...set]
	return loaders.filter((l) => l !== 'minecraft' || loaders.length === 1)
}
