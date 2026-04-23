import { SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildProjectCard } from '../utils/cards.js'

export const projectCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('project')
		.setDescription('Look up a Modrinth project')
		.addStringOption((o) =>
			o.setName('slug').setDescription('Project slug or ID').setRequired(true),
		),
	meta: {
		name: 'project',
		description: 'Look up a Modrinth project',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const slug = interaction.options.getString('slug', true)

		let project
		try {
			project = await modrinth.getProject(slug)
		} catch {
			await interaction.editReply({ content: `No project found for \`${slug}\`.` })
			return
		}

		await interaction.editReply(buildProjectCard(project))
	},
}
