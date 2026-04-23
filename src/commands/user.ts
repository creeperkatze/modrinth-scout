import { SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildUserCard } from '../utils/embeds.js'

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

		await interaction.editReply(buildUserCard(user, projects))
	},
}
