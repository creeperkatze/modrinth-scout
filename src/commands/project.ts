import { SlashCommandBuilder } from 'discord.js'

import { modrinth, PROJECT_TYPES } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
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
		.addStringOption((o) =>
			o
				.setName('type')
				.setDescription('Filter by project type')
				.addChoices(PROJECT_TYPES.map((t) => ({ name: t.name, value: t.value }))),
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
			project = await modrinth.getProject(slug)
		} catch {
			await interaction.editReply({ embeds: [error(`No project found for \`${slug}\`.`)] })
			return
		}

		await interaction.editReply(buildProjectCard(project))
	},
}
