import type { Labrinth } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { PROJECT_TYPES, ProjectType } from '../config/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
import { buildProjectCard, error } from '../utils/embeds/index.js'

async function randomProject(
	type?: ProjectType,
): Promise<Labrinth.Projects.v3.Project | undefined> {
	const params: Record<string, string> = { count: '1', t: String(Date.now()) }
	if (type) params.facets = JSON.stringify([[`project_types:${type}`]])

	const [project] = await modrinthClient.request<Labrinth.Projects.v3.Project[]>(
		'/projects_random',
		{ api: 'labrinth', version: 3, method: 'GET', params },
	)
	return project
}

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
		const project = await randomProject(type)

		if (!project) {
			await interaction.editReply({ embeds: [error('No random project found with that filter.')] })
			return
		}

		await interaction.editReply(buildProjectCard(project))
	},
}
