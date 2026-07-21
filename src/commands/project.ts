import { ModrinthApiError } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { respondWithProjectSearch } from '../utils/autocomplete.js'
import { buildProjectCard, error } from '../utils/embeds/index.js'
import { parseModrinthUrl } from '../utils/url.js'

export const projectCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('project')
		.setDescription('Look up a Modrinth project')
		.addStringOption((o) =>
			o
				.setName('query')
				.setDescription('Project name, slug, ID, or URL')
				.setRequired(true)
				.setAutocomplete(true),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'project',
		description: 'Look up a Modrinth project',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async autocomplete(interaction) {
		await respondWithProjectSearch(interaction)
	},

	async execute(interaction) {
		await interaction.deferReply()

		const raw = interaction.options.getString('query', true)
		const parsed = parseModrinthUrl(raw)
		const slug = parsed?.type === 'project' ? parsed.slug : raw

		let project
		try {
			project = await modrinthClient.labrinth.projects_v3.get(slug)
		} catch (err) {
			const notFound = err instanceof ModrinthApiError && err.statusCode === 404
			const message = notFound
				? `No project found for \`${slug}\`.`
				: err instanceof Error
					? err.message
					: String(err)
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		await interaction.editReply(await buildProjectCard(project))
	},
}
