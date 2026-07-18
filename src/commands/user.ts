import { type Labrinth, ModrinthApiError } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
import { buildUserCard, error } from '../utils/embeds/index.js'
import { parseModrinthUrl } from '../utils/url.js'

export const userCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('user')
		.setDescription('Look up a Modrinth user')
		.addStringOption((o) =>
			o.setName('query').setDescription('Username, ID, or URL').setRequired(true),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'user',
		description: 'Look up a Modrinth user',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const raw = interaction.options.getString('query', true)
		const parsed = parseModrinthUrl(raw)
		const username = parsed?.type === 'user' ? parsed.username : raw

		let user, projects
		try {
			;[user, projects] = await Promise.all([
				modrinthClient.labrinth.users_v3.get(username),
				modrinthClient.request<Labrinth.Projects.v3.Project[]>(`/user/${username}/projects`, {
					api: 'labrinth',
					version: 3,
					method: 'GET',
				}),
			])
		} catch (err) {
			const notFound = err instanceof ModrinthApiError && err.statusCode === 404
			const message = notFound
				? `No user found for \`${username}\`.`
				: err instanceof Error
					? err.message
					: String(err)
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		await interaction.editReply(buildUserCard(user, projects))
	},
}
