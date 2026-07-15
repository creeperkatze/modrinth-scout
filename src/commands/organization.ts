import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
import { buildOrganizationCard, error } from '../utils/embeds/index.js'
import { parseModrinthUrl } from '../utils/url.js'

export const organizationCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('organization')
		.setDescription('Look up a Modrinth organization')
		.addStringOption((o) =>
			o.setName('query').setDescription('Organization slug, ID, or URL').setRequired(true),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'organization',
		description: 'Look up a Modrinth organization',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const raw = interaction.options.getString('query', true)
		const parsed = parseModrinthUrl(raw)
		const slug = parsed?.type === 'organization' ? parsed.slug : raw

		let org, projects
		try {
			;[org, projects] = await Promise.all([
				modrinthClient.labrinth.organizations_v3.get(slug),
				modrinthClient.labrinth.organizations_v3.getProjects(slug),
			])
		} catch {
			await interaction.editReply({ embeds: [error(`No organization found for \`${slug}\`.`)] })
			return
		}

		await interaction.editReply(buildOrganizationCard(org, projects))
	},
}
