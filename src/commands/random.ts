import { SlashCommandBuilder } from 'discord.js'

import { modrinth, PROJECT_TYPES, ProjectType } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildProjectCard } from '../utils/embeds.js'

export const randomCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('random')
		.setDescription('Returns a random project from Modrinth')
		.addStringOption((o) =>
			o
				.setName('type')
				.setDescription('Filter by project type')
				.addChoices(PROJECT_TYPES.map((t) => ({ name: t.name, value: t.value }))),
		),
	meta: {
		name: 'random',
		description: 'Returns a random project from Modrinth',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()
		const type = interaction.options.getString('type') as ProjectType | undefined
		const project = await modrinth.randomProject(type)

		if (!project) {
			await interaction.editReply({ content: 'No random project found with that filter.' })
			return
		}

		await interaction.editReply(buildProjectCard(project))
	},
}
