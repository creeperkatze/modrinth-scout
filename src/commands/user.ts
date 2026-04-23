import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'

export const userCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Look up a Modrinth user')
		.addStringOption((o) =>
			o.setName('username').setDescription('Modrinth username or ID').setRequired(true),
		),
	meta: {
		name: 'user',
		description: 'Look up a Modrinth user',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const username = interaction.options.getString('username', true)

		let user, projects
		try {
			;[user, projects] = await Promise.all([
				modrinth.getUser(username),
				modrinth.getUserProjects(username),
			])
		} catch {
			await interaction.editReply({ content: `No user found for \`${username}\`.` })
			return
		}

		const profileUrl = `https://modrinth.com/user/${user.username}`
		const joinedTimestamp = Math.floor(new Date(user.created).getTime() / 1000)
		const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)

		const topProjects = [...projects]
			.sort((a, b) => b.downloads - a.downloads)
			.slice(0, 5)
			.map(
				(p) =>
					`[${p.title}](https://modrinth.com/${p.project_type}/${p.slug}) — ${p.downloads.toLocaleString('en-US')} downloads`,
			)
			.join('\n')

		const embed = new EmbedBuilder()
			.setTitle(user.username)
			.setURL(profileUrl)
			.setColor(0x1bd96a)
			.addFields(
				{ name: 'Projects', value: String(projects.length), inline: true },
				{ name: 'Downloads', value: totalDownloads.toLocaleString('en-US'), inline: true },
				{ name: 'Member since', value: `<t:${joinedTimestamp}:D>`, inline: true },
			)

		if (user.bio) embed.setDescription(user.bio)
		if (user.avatar_url) embed.setThumbnail(user.avatar_url)
		if (topProjects) embed.addFields({ name: 'Top Projects', value: topProjects })

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setLabel('View Profile').setURL(profileUrl).setStyle(ButtonStyle.Link),
		)

		await interaction.editReply({ embeds: [embed], components: [row] })
	},
}
