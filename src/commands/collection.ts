import { ModrinthApiError } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { buildCollectionCard, error } from '../utils/embeds/index.js'
import { parseModrinthUrl } from '../utils/url.js'

export const collectionCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('collection')
		.setDescription('Look up a Modrinth collection')
		.addStringOption((o) =>
			o.setName('query').setDescription('Collection ID or URL').setRequired(true),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'collection',
		description: 'Look up a Modrinth collection',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const raw = interaction.options.getString('query', true)
		const parsed = parseModrinthUrl(raw)
		const id = parsed?.type === 'collection' ? parsed.id : raw

		let collection, projects
		try {
			collection = await modrinthClient.labrinth.collections.get(id)
			projects =
				collection.projects.length > 0
					? await modrinthClient.labrinth.projects_v3.getMultiple(collection.projects)
					: []
		} catch (err) {
			const notFound = err instanceof ModrinthApiError && err.statusCode === 404
			const message = notFound
				? `No collection found for \`${id}\`.`
				: err instanceof Error
					? err.message
					: String(err)
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		await interaction.editReply(await buildCollectionCard(collection, projects))
	},
}
