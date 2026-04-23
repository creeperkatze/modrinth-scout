import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'

export const randomCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('random')
		.setDescription('Returns a random project from Modrinth'),
	meta: {
		name: 'random',
		description: 'Returns a random project from Modrinth',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const project = await modrinth.randomProject()

		const allCategories = [...project.categories, ...project.additional_categories]
		const latestVersion = project.game_versions.at(-1)

		const embed = new EmbedBuilder()
			.setTitle(project.title)
			.setURL(`https://modrinth.com/${project.project_type}/${project.slug}`)
			.setDescription(project.description)
			.addFields(
				{
					name: 'Type',
					value: project.project_type.charAt(0).toUpperCase() + project.project_type.slice(1),
					inline: true,
				},
				{ name: 'Downloads', value: project.downloads.toLocaleString('en-US'), inline: true },
				{ name: 'Followers', value: project.followers.toLocaleString('en-US'), inline: true },
			)
			.setFooter({ text: 'Modrinth' })
			.setTimestamp()

		if (allCategories.length > 0) {
			embed.addFields({
				name: 'Categories',
				value: allCategories.join(', '),
				inline: true,
			})
		}

		if (latestVersion) {
			embed.addFields({ name: 'Latest Version', value: latestVersion, inline: true })
		}

		if (project.icon_url) embed.setThumbnail(project.icon_url)
		if (project.color) embed.setColor(project.color)

		await interaction.editReply({ embeds: [embed] })
	},
}
