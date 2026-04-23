import { SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildProjectCard } from '../utils/cards.js'

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
		await interaction.editReply(buildProjectCard(project))
	},
}
