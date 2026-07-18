import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { emojiRefs } from '../utils/emojis.js'

export const voteCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Vote for the bot on top.gg')
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'vote',
		description: 'Vote for the bot on top.gg',
		category: 'general',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		const topggUrl = `https://top.gg/bot/${interaction.client.user.id}/vote`

		const embed = new EmbedBuilder()
			.setTitle('Vote for Modrinth Scout')
			.setDescription(
				'Enjoying the bot? Vote for it on top.gg to help more people discover it. You can vote once every 12 hours.',
			)
			.setColor(0xff3366)

		const button = new ButtonBuilder()
			.setLabel('Vote on top.gg')
			.setURL(topggUrl)
			.setStyle(ButtonStyle.Link)
		if (emojiRefs['topgg']) button.setEmoji(emojiRefs['topgg'])

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

		await interaction.reply({ embeds: [embed], components: [row] })
	},
}
