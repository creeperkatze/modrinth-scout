import { SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildOrganizationCard } from '../utils/embeds/index.js'

export const organizationCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('organization')
		.setDescription('Look up a Modrinth organization')
		.addStringOption((o) =>
			o.setName('slug').setDescription('Organization slug or ID').setRequired(true),
		),
	meta: {
		name: 'organization',
		description: 'Look up a Modrinth organization',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const slug = interaction.options.getString('slug', true)

		let org, projects
		try {
			;[org, projects] = await Promise.all([
				modrinth.getOrganization(slug),
				modrinth.getOrganizationProjects(slug),
			])
		} catch {
			await interaction.editReply({ content: `No organization found for \`${slug}\`.` })
			return
		}

		await interaction.editReply(buildOrganizationCard(org, projects))
	},
}
