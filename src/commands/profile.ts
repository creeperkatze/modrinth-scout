import { ModrinthApiError } from '@modrinth/api-client'
import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import { queries } from '../db/queries.js'
import type { UserContextMenuCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { buildUserCard, error, info } from '../utils/embeds/index.js'

export const PROFILE_CONTEXT_MENU_NAME = 'View Modrinth profile'

export const profileContextMenu: UserContextMenuCommand = {
	data: new ContextMenuCommandBuilder()
		.setName(PROFILE_CONTEXT_MENU_NAME)
		.setType(ApplicationCommandType.User)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: PROFILE_CONTEXT_MENU_NAME,
		description: "Show a user's linked Modrinth profile",
		category: 'utility',
		cooldownSeconds: 5,
	},

	async execute(interaction) {
		const target = interaction.targetUser
		const linked = await queries.getLinkedAccount(target.id)
		if (!linked) {
			const message =
				target.id === interaction.user.id
					? "You don't have a linked Modrinth account. Use `/link setup` to link one."
					: `${target} hasn't linked a Modrinth account.`
			await interaction.reply({ embeds: [info(message)], flags: 'Ephemeral' })
			return
		}

		await interaction.deferReply({ flags: 'Ephemeral' })

		let user, projects
		try {
			;[user, projects] = await Promise.all([
				modrinthClient.labrinth.users_v3.get(linked.modrinthUserId),
				modrinthClient.labrinth.users_v3.getProjects(linked.modrinthUserId),
			])
		} catch (err) {
			const notFound = err instanceof ModrinthApiError && err.statusCode === 404
			const message = notFound
				? `The Modrinth account linked to ${target} no longer exists.`
				: err instanceof Error
					? err.message
					: String(err)
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		await interaction.editReply(buildUserCard(user, projects))
	},
}
