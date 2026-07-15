import type { Labrinth } from '@modrinth/api-client'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
} from 'discord.js'

import { PROJECT_TYPES, ProjectType, SearchIndex, SORT_OPTIONS } from '../config/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
import { error, TYPE_LABELS } from '../utils/embeds/index.js'
import { emojis, LOADERS } from '../utils/emojis.js'
import { formatPlainTags } from '../utils/loaders.js'

export const SEARCH_LIMIT = 5

export function buildSearchId(
	action: string,
	offset: number,
	query: string,
	type?: string,
	index?: string,
): string {
	return `search:${action}:${offset}:${type ?? ''}:${index ?? ''}:${query}`
}

export function parseSearchId(customId: string) {
	const [, action, offsetStr, type, index, ...queryParts] = customId.split(':')
	return {
		action,
		offset: parseInt(offsetStr) || 0,
		type: (type || undefined) as ProjectType | undefined,
		index: (index || undefined) as SearchIndex | undefined,
		query: queryParts.join(':'),
	}
}

export async function buildSearchPayload(
	query: string,
	type: ProjectType | undefined,
	index: SearchIndex | undefined,
	offset: number,
) {
	const { hits, total_hits } = await modrinthClient.labrinth.projects_v2.search({
		query,
		limit: SEARCH_LIMIT,
		index: index ?? 'relevance',
		offset,
		facets: type ? [[`project_type:${type}`]] : undefined,
	})

	if (hits.length === 0) return null

	const totalPages = Math.ceil(total_hits / SEARCH_LIMIT)
	const currentPage = Math.floor(offset / SEARCH_LIMIT) + 1

	const header = `🔎 Results for "${query}", ${total_hits.toLocaleString('en-US')} total results`

	const resultEmbeds = hits.map((hit: Labrinth.Projects.v2.SearchResultHit) => {
		const rawType = hit.project_type ?? 'project'
		const hitType = TYPE_LABELS[rawType] ?? rawType.charAt(0).toUpperCase() + rawType.slice(1)
		const url = `https://modrinth.com/${rawType}/${hit.slug}`
		const desc =
			hit.description.length > 120 ? hit.description.slice(0, 119) + '...' : hit.description
		const downloads = hit.downloads.toLocaleString('en-US', {
			notation: 'compact',
			maximumFractionDigits: 1,
		})
		const follows = hit.follows.toLocaleString('en-US', {
			notation: 'compact',
			maximumFractionDigits: 1,
		})
		const loaderTags = hit.categories.filter((c) => LOADERS.has(c.toLowerCase()))
		const categoryTags = hit.categories.filter((c) => !loaderTags.includes(c))
		const typeValue = `${emojis[rawType] ?? ''} ${hitType}`.trim()
		const tags = [typeValue, formatPlainTags(loaderTags), formatPlainTags(categoryTags)]
			.filter(Boolean)
			.join(' · ')
		return new EmbedBuilder()
			.setAuthor({ name: hit.title, iconURL: hit.icon_url || undefined, url })
			.setDescription(
				`by **${hit.author}**\n\n${desc}\n${emojis['downloads']} ${downloads} · ${emojis['follows']} ${follows} · ${tags}`,
			)
			.setColor(hit.color ?? 0x1bd96a)
	})

	const menu = new StringSelectMenuBuilder()
		.setCustomId('search_result')
		.setPlaceholder(`View a project... (Page ${currentPage} / ${totalPages})`)
		.addOptions(
			hits.map((hit: Labrinth.Projects.v2.SearchResultHit) => ({
				label: hit.title.slice(0, 100),
				value: `project:${hit.slug}`,
			})),
		)

	const prevButton = new ButtonBuilder()
		.setCustomId(buildSearchId('prev', Math.max(0, offset - SEARCH_LIMIT), query, type, index))
		.setLabel('◀ Prev')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(offset === 0)

	const nextButton = new ButtonBuilder()
		.setCustomId(buildSearchId('next', offset + SEARCH_LIMIT, query, type, index))
		.setLabel('Next ▶')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(currentPage >= totalPages)

	const jumpButton = new ButtonBuilder()
		.setCustomId(buildSearchId('jump', offset, query, type, index))
		.setLabel('Jump to page')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(totalPages <= 1)

	return {
		content: header,
		embeds: resultEmbeds,
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
			new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton, jumpButton),
		],
	}
}

export const searchCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription('Search for projects on Modrinth')
		.addStringOption((o) => o.setName('query').setDescription('Search query').setRequired(true))
		.addStringOption((o) =>
			o
				.setName('type')
				.setDescription('Filter by project type')
				.addChoices(PROJECT_TYPES.map((t) => ({ name: t.name, value: t.value }))),
		)
		.addStringOption((o) =>
			o.setName('sort').setDescription('Sort order').addChoices(SORT_OPTIONS),
		),
	meta: {
		name: 'search',
		description: 'Search for projects on Modrinth',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const query = interaction.options.getString('query', true)
		const type = (interaction.options.getString('type') ?? undefined) as ProjectType | undefined
		const index = (interaction.options.getString('sort') ?? undefined) as SearchIndex | undefined

		const payload = await buildSearchPayload(query, type, index, 0)

		if (!payload) {
			await interaction.editReply({ embeds: [error(`No results found for **${query}**.`)] })
			return
		}

		await interaction.editReply(payload)
	},
}
