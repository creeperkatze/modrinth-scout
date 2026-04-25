import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'

export const statisticsCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('statistics')
		.setDescription('Show Modrinth and bot statistics'),
	meta: {
		name: 'statistics',
		description: 'Show Modrinth and bot statistics',
		category: 'general',
		cooldownSeconds: 10,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const [modrinthStats, trackedTotal] = await Promise.all([
			modrinth.getStatistics(),
			queries.countAllTrackedProjects(),
			queries.countConfiguredServers(),
		])

		const servers = interaction.client.guilds.cache.size

		const lines = [
			'### Bot',
			`**Servers** · ${servers.toLocaleString()}`,
			`**Tracked projects** · ${trackedTotal.toLocaleString()}`,
			'### Modrinth',
			`**Projects** · ${modrinthStats.projects.toLocaleString()}`,
			`**Versions** · ${modrinthStats.versions.toLocaleString()}`,
			`**Authors** · ${modrinthStats.authors.toLocaleString()}`,
			`**Files** · ${modrinthStats.files.toLocaleString()}`,
		]

		const embed = new EmbedBuilder()
			.setAuthor({
				name: interaction.client.user.username,
				iconURL: interaction.client.user.displayAvatarURL(),
			})
			.setDescription(lines.join('\n'))
			.setColor(0x1bd96a)

		await interaction.editReply({ embeds: [embed] })
	},
}
