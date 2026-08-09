import type { Labrinth } from '@modrinth/api-client'
import { AutocompleteInteraction } from 'discord.js'

import { ProjectType } from '../config/modrinth.js'
import { queries } from '../db/queries.js'
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

export async function respondWithTrackedProjectSearch(
	interaction: AutocompleteInteraction,
): Promise<void> {
	const guildId = interaction.guildId
	if (!guildId) {
		await interaction.respond([])
		return
	}

	const focused = interaction.options.getFocused()
	const tracked = await queries.getTrackedProjects(guildId)
	const choices = tracked
		.filter((p) => p.slug.includes(focused) || p.name.toLowerCase().includes(focused.toLowerCase()))
		.slice(0, 25)
		.map((p) => ({ name: p.name, value: p.projectId }))

	await interaction.respond(choices)
}

export async function respondWithTrackedAuthorSearch(
	interaction: AutocompleteInteraction,
): Promise<void> {
	const guildId = interaction.guildId
	if (!guildId) {
		await interaction.respond([])
		return
	}

	const focused = interaction.options.getFocused().toLowerCase()
	const tracked = await queries.getTrackedAuthors(guildId)
	const choices = tracked
		.filter(
			(a) => a.username.toLowerCase().includes(focused) || a.name.toLowerCase().includes(focused),
		)
		.slice(0, 25)
		.map((a) => ({ name: `${a.name} (${a.authorType})`, value: a.authorId }))

	await interaction.respond(choices)
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
