import type { Labrinth } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
import { buildProjectCard, error } from '../utils/embeds/index.js'

async function randomProject(): Promise<Labrinth.Projects.v3.Project | undefined> {
	const [project] = await modrinthClient.request<Labrinth.Projects.v3.Project[]>(
		'/projects_random',
		{ api: 'labrinth', version: 3, method: 'GET', params: { count: '1' } },
	)
	return project
}

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
		const project = await randomProject()

		if (!project) {
			await interaction.editReply({ embeds: [error('No random project found.')] })
			return
		}

		await interaction.editReply(await buildProjectCard(project))
	},
}
