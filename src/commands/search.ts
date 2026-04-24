import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
} from 'discord.js'

import { modrinth, ProjectType, SearchIndex } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { TYPE_LABELS } from '../utils/embeds.js'

const PROJECT_TYPES: { name: string; value: ProjectType }[] = [
	{ name: 'Mod', value: 'mod' },
	{ name: 'Resourcepack', value: 'resourcepack' },
	{ name: 'Datapack', value: 'datapack' },
	{ name: 'Shader', value: 'shader' },
	{ name: 'Modpack', value: 'modpack' },
	{ name: 'Plugin', value: 'plugin' },
	{ name: 'Server', value: 'minecraft_java_server' },
]
const SORT_OPTIONS: { name: string; value: SearchIndex }[] = [
	{ name: 'Relevance', value: 'relevance' },
	{ name: 'Downloads', value: 'downloads' },
	{ name: 'Follows', value: 'follows' },
	{ name: 'Newest', value: 'newest' },
	{ name: 'Recently Updated', value: 'updated' },
]

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
	const { hits, total_hits } = await modrinth.search(query, {
		type,
		index,
		limit: SEARCH_LIMIT,
		offset,
	})

	if (hits.length === 0) return null

	const totalPages = Math.ceil(total_hits / SEARCH_LIMIT)
	const currentPage = Math.floor(offset / SEARCH_LIMIT) + 1

	const header = `🔎 Results for "${query}", ${total_hits.toLocaleString('en-US')} total results`

	const resultEmbeds = hits.map((hit) => {
		const rawType = (hit.project_types ?? [])[0] ?? 'project'
		const hitType = TYPE_LABELS[rawType] ?? rawType.charAt(0).toUpperCase() + rawType.slice(1)
		const desc = hit.summary.length > 80 ? hit.summary.slice(0, 79) + '…' : hit.summary
		return new EmbedBuilder()
			.setAuthor({ name: hit.name, iconURL: hit.icon_url ?? undefined })
			.setDescription(
				`${desc}\n\`${hitType}\` • ${hit.downloads.toLocaleString('en-US')} downloads`,
			)
			.setColor(hit.color ?? 0x1bd96a)
	})

	const menu = new StringSelectMenuBuilder()
		.setCustomId('search_result')
		.setPlaceholder(`View a project... (Page ${currentPage} / ${totalPages})`)
		.addOptions(
			hits.map((hit) => ({
				label: hit.name.slice(0, 100),
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
			await interaction.editReply({ content: `No results found for **${query}**.` })
			return
		}

		await interaction.editReply(payload)
	},
}
