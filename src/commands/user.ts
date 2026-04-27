import { SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildUserCard, error } from '../utils/embeds/index.js'
import { parseModrinthUrl } from '../utils/url.js'

export const userCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Look up a Modrinth user')
		.addStringOption((o) =>
			o.setName('query').setDescription('Username, ID, or URL').setRequired(true),
		),
	meta: {
		name: 'user',
		description: 'Look up a Modrinth user',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const raw = interaction.options.getString('query', true)
		const parsed = parseModrinthUrl(raw)
		const username = parsed?.type === 'user' ? parsed.username : raw

		let user, projects
		try {
			;[user, projects] = await Promise.all([
				modrinth.getUser(username),
				modrinth.getUserProjects(username),
			])
		} catch {
			await interaction.editReply({ embeds: [error(`No user found for \`${username}\`.`)] })
			return
		}

		await interaction.editReply(buildUserCard(user, projects))
	},
}
