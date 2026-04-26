import { AutocompleteInteraction } from 'discord.js'

import { modrinth, ProjectType } from '../api/modrinth.js'
import { TYPE_LABELS } from './embeds/index.js'

type Hit = { name: string; project_types?: string[]; author: string; downloads: number }

function resolveType(hit: Hit): string {
	const raw = (hit.project_types ?? [])[0] ?? 'project'
	return TYPE_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function formatHitLabels(hits: Hit[]): string[] {
	const types = hits.map(resolveType)
	return hits.map((h, i) =>
		`${h.name} · ${types[i]} · by ${h.author} · ${h.downloads.toLocaleString('en-US')} downloads`.slice(
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
		await interaction.respond(hits.map((h, i) => ({ name: labels[i], value: h.slug })))
	} catch {
		await interaction.respond([])
	}
}
