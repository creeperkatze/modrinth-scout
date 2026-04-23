import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'

import { modrinth, ProjectType, SearchIndex } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'

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

		const { hits, total_hits } = await modrinth.search(query, { type, index })

		if (hits.length === 0) {
			await interaction.editReply({ content: `No results found for **${query}**.` })
			return
		}

		const description = hits
			.map((hit, i) => {
				const url = `https://modrinth.com/${hit.project_type}/${hit.slug}`
				const desc =
					hit.description.length > 80 ? hit.description.slice(0, 79) + '…' : hit.description
				return `**${i + 1}. [${hit.title}](${url})**\n${desc}\n> \`${hit.project_type}\` • ${hit.downloads.toLocaleString('en-US')} downloads`
			})
			.join('\n\n')

		const embed = new EmbedBuilder()
			.setTitle(`Results for "${query}"`)
			.setURL(`https://modrinth.com/mods?q=${encodeURIComponent(query)}${type ? `&t=${type}` : ''}`)
			.setDescription(description)
			.setColor(0x1bd96a)
			.setFooter({ text: `${total_hits.toLocaleString('en-US')} total results • Modrinth` })

		await interaction.editReply({ embeds: [embed] })
	},
}
