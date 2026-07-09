import { SlashCommandBuilder } from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
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
		),
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
		} catch {
			await interaction.editReply({ embeds: [error(`No project found for \`${slug}\`.`)] })
			return
		}

		await interaction.editReply(await buildProjectCard(project))
	},
}
