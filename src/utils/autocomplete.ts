import type { Labrinth } from '@modrinth/api-client'
import { AutocompleteInteraction } from 'discord.js'

import { ProjectType } from '../config/modrinth.js'
import { modrinthClient } from './api/modrinth.js'
import { BADGE_LABELS, resolveBadges, typeLabel } from './embeds/index.js'

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

function formatUserLabel(username: string, details?: Labrinth.Users.v2.User): string {
	if (!details) return username
	const badges = resolveBadges(details).map((key) => BADGE_LABELS[key])
	const parts = [
		username,
		`⚑ ${new Date(details.created).getFullYear()}`,
		badges.length > 0 ? `★ ${badges.join(', ')}` : undefined,
	].filter(Boolean)
	return parts.join(' · ').slice(0, 100)
}

export async function respondWithUserSearch(interaction: AutocompleteInteraction): Promise<void> {
	try {
		const query = interaction.options.getFocused()
		const users = query ? await modrinthClient.labrinth.users_v3.search(query) : []
		if (users.length === 0) {
			await interaction.respond([])
			return
		}

		let detailsById = new Map<string, Labrinth.Users.v2.User>()
		try {
			const details = await modrinthClient.labrinth.users_v2.getMultiple(users.map((u) => u.id))
			detailsById = new Map(details.map((d) => [d.id, d]))
		} catch {
			// Enrichment is best-effort; fall back to bare usernames below.
		}

		await interaction.respond(
			users.map((u) => ({
				name: formatUserLabel(u.username, detailsById.get(u.id)),
				value: u.username,
			})),
		)
	} catch {
		await interaction.respond([])
	}
}
