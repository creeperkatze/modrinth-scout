import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'

export const pingCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!')
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'ping',
		description: 'Replies with Pong!',
		category: 'general',
		cooldownSeconds: 2,
	},
	async execute(interaction) {
		await interaction.reply('Pong!')
	},
}
