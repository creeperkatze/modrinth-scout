import { AutocompleteInteraction } from 'discord.js'

import { modrinth, type ModrinthSearchHit, ProjectType } from '../api/modrinth.js'
import { TYPE_LABELS } from './embeds/index.js'

export type AutocompleteHit = Pick<ModrinthSearchHit, 'title' | 'author' | 'downloads'> & {
	project_type?: ModrinthSearchHit['project_type'] | ProjectType
}

function resolveType(hit: AutocompleteHit): string {
	const raw = hit.project_type ?? 'project'
	return TYPE_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function formatHitLabels(hits: AutocompleteHit[]): string[] {
	const types = hits.map(resolveType)
	return hits.map((h, i) =>
		`${h.title} · ${types[i]} · by ${h.author} · ${h.downloads.toLocaleString('en-US')} downloads`.slice(
			0,
			100,
		),
	)
}

export async function respondWithProjectSearch(
	interaction: AutocompleteInteraction,
): Promise<void> {
	try {
		const type = (interaction.options.getString('type') ?? undefined) as ProjectType | undefined
		const { hits } = await modrinth.search(interaction.options.getFocused(), {
			limit: 10,
			type,
		})
		const labels = formatHitLabels(hits)
		await interaction.respond(
			hits.map((h: ModrinthSearchHit, i: number) => ({ name: labels[i], value: h.project_id })),
		)
	} catch {
		await interaction.respond([])
	}
}
