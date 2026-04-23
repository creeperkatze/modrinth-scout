import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'

export const projectCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('project')
		.setDescription('Look up a Modrinth project')
		.addStringOption((o) =>
			o.setName('slug').setDescription('Project slug or ID').setRequired(true),
		),
	meta: {
		name: 'project',
		description: 'Look up a Modrinth project',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const slug = interaction.options.getString('slug', true)

		let project
		try {
			project = await modrinth.getProject(slug)
		} catch {
			await interaction.editReply({ content: `No project found for \`${slug}\`.` })
			return
		}

		const url = `https://modrinth.com/${project.project_type}/${project.slug}`

		const recentVersions = project.game_versions.slice(-3).reverse()
		const extraVersions = project.game_versions.length - recentVersions.length
		const versionsText =
			recentVersions.join(', ') + (extraVersions > 0 ? ` *(+${extraVersions} more)*` : '')

		const loaders = project.loaders.filter((l) => l !== 'minecraft' || project.loaders.length === 1)

		const embed = new EmbedBuilder()
			.setTitle(project.title)
			.setURL(url)
			.setDescription(project.description)
			.addFields(
				{ name: 'Downloads', value: project.downloads.toLocaleString('en-US'), inline: true },
				{ name: 'Followers', value: project.followers.toLocaleString('en-US'), inline: true },
				{
					name: 'Type',
					value: project.project_type.charAt(0).toUpperCase() + project.project_type.slice(1),
					inline: true,
				},
			)
			.setFooter({ text: 'Updated' })
			.setTimestamp(new Date(project.updated))

		if (loaders.length > 0) {
			embed.addFields({ name: 'Loaders', value: loaders.join(', '), inline: true })
		}

		if (recentVersions.length > 0) {
			embed.addFields({ name: 'Game Versions', value: versionsText, inline: true })
		}

		if (project.icon_url) embed.setThumbnail(project.icon_url)
		if (project.color) embed.setColor(project.color)

		const buttons = [
			new ButtonBuilder().setLabel('View project').setURL(url).setStyle(ButtonStyle.Link),
			project.source_url &&
				new ButtonBuilder()
					.setLabel('Source')
					.setEmoji('💻')
					.setURL(project.source_url)
					.setStyle(ButtonStyle.Link),
			project.issues_url &&
				new ButtonBuilder()
					.setLabel('Issues')
					.setEmoji('🐛')
					.setURL(project.issues_url)
					.setStyle(ButtonStyle.Link),
			project.wiki_url &&
				new ButtonBuilder()
					.setLabel('Wiki')
					.setEmoji('📖')
					.setURL(project.wiki_url)
					.setStyle(ButtonStyle.Link),
			project.discord_url &&
				new ButtonBuilder()
					.setLabel('Discord')
					.setEmoji('💬')
					.setURL(project.discord_url)
					.setStyle(ButtonStyle.Link),
		].filter(Boolean) as ButtonBuilder[]

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)

		await interaction.editReply({ embeds: [embed], components: [row] })
	},
}
