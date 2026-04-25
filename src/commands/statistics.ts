import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'

import { queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'

export const statisticsCommand: ChatInputCommand = {
	data: new SlashCommandBuilder().setName('statistics').setDescription('Show bot statistics'),
	meta: {
		name: 'statistics',
		description: 'Show bot statistics',
		category: 'general',
		cooldownSeconds: 10,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const [servers, trackedTotal] = await Promise.all([
			interaction.client.guilds.cache.size,
			queries.countAllTrackedProjects(),
		])

		const embed = new EmbedBuilder()
			.setAuthor({
				name: interaction.client.user.username,
				iconURL: interaction.client.user.displayAvatarURL(),
			})
			.setColor(0x1bd96a)
			.addFields(
				{ name: 'Servers', value: servers.toLocaleString() },
				{
					name: 'Tracked projects',
					value: `${trackedTotal.toLocaleString()}`,
				},
			)

		await interaction.editReply({ embeds: [embed] })
	},
}
