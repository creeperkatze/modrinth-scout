import type { Labrinth } from '@modrinth/api-client'
import { AutocompleteInteraction } from 'discord.js'

import { ProjectType } from '../config/modrinth.js'
import { modrinthClient } from './api.js'
import { typeLabel } from './embeds/index.js'

export type AutocompleteHit = Pick<
	Labrinth.Projects.v2.SearchResultHit,
	'title' | 'author' | 'downloads' | 'follows'
> & {
	project_type?: Labrinth.Projects.v2.SearchResultHit['project_type'] | ProjectType
}

function resolveType(hit: AutocompleteHit): string {
	return typeLabel(hit.project_type ?? 'project')
}

function formatCount(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
	if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`
	return `${count}`
}

export function formatHitLabels(hits: AutocompleteHit[]): string[] {
	const types = hits.map(resolveType)
	return hits.map((h, i) => {
		const isServer = (h.project_type ?? undefined) === 'minecraft_java_server'
		const downloads = isServer ? '' : ` · ↓ ${formatCount(h.downloads)}`
		return `${h.title} · ▢ ${types[i]} · Ꙫ ${h.author}${downloads} · ♡ ${formatCount(h.follows)}`.slice(
			0,
			100,
		)
	})
}

export async function respondWithProjectSearch(
	interaction: AutocompleteInteraction,
): Promise<void> {
	try {
		const type = (interaction.options.getString('type') ?? undefined) as ProjectType | undefined
		const { hits } = await modrinthClient.labrinth.projects_v2.search({
			query: interaction.options.getFocused(),
			limit: 10,
			index: 'relevance',
			facets: type ? [[`project_type:${type}`]] : undefined,
		})
		const labels = formatHitLabels(hits)
		await interaction.respond(
			hits.map((h: Labrinth.Projects.v2.SearchResultHit, i: number) => ({
				name: labels[i],
				value: h.project_id,
			})),
		)
	} catch {
		await interaction.respond([])
	}
}
