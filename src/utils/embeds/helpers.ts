import type { ModrinthProject } from '../../api/modrinth.js'

export function topProjectsList(projects: ModrinthProject[]): string {
	return [...projects]
		.sort((a, b) => b.downloads - a.downloads)
		.slice(0, 5)
		.map(
			(p) =>
				`[${p.name}](https://modrinth.com/${p.project_types[0]}/${p.slug}) — ${p.downloads.toLocaleString('en-US')} downloads`,
		)
		.join('\n')
}
