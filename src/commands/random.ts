import type { Labrinth } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import { PROJECT_TYPES, ProjectType } from '../config/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { buildProjectCard, error } from '../utils/embeds/index.js'

async function randomProject(
	type: ProjectType | undefined,
): Promise<Labrinth.Projects.v3.Project | undefined> {
	// Cloudflare caches per URL, so bust the cache to get a fresh project
	const params: Record<string, string> = { count: '1', _: Date.now().toString() }
	if (type) params.project_type = type

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
				// The endpoint returns nothing for servers
				.addChoices(
					PROJECT_TYPES.filter((t) => t.value !== 'minecraft_java_server').map((t) => ({
						name: t.name,
						value: t.value,
					})),
				),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'random',
		description: 'Returns a random project from Modrinth',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()
		const type = (interaction.options.getString('type') ?? undefined) as ProjectType | undefined
		const project = await randomProject(type)

		if (!project) {
			await interaction.editReply({ embeds: [error('No random project found.')] })
			return
		}

		await interaction.editReply(await buildProjectCard(project))
	},
}
