import { SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildCollectionCard } from '../utils/embeds/index.js'

export const collectionCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('collection')
		.setDescription('Look up a Modrinth collection')
		.addStringOption((o) => o.setName('id').setDescription('Collection ID').setRequired(true)),
	meta: {
		name: 'collection',
		description: 'Look up a Modrinth collection',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const id = interaction.options.getString('id', true)

		let collection, projects
		try {
			collection = await modrinth.getCollection(id)
			projects = await modrinth.getProjects(collection.projects)
		} catch {
			await interaction.editReply({ content: `No collection found for \`${id}\`.` })
			return
		}

		await interaction.editReply(buildCollectionCard(collection, projects))
	},
}
