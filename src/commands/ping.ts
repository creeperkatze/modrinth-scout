import { SlashCommandBuilder } from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'

export const pingCommand: ChatInputCommand = {
	data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
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
