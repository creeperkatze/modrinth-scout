import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { MessageContextMenuCommand } from '../types/index.js'
import { resolveLinkCards } from '../utils/autoEmbeds.js'
import { error, info } from '../utils/embeds/index.js'

export const lookupContextMenu: MessageContextMenuCommand = {
	type: ApplicationCommandType.Message,
	data: new ContextMenuCommandBuilder()
		.setName('Lookup')
		.setType(ApplicationCommandType.Message)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'Lookup',
		description: "Show cards for a message's Modrinth links",
		category: 'utility',
		cooldownSeconds: 10,
	},

	async execute(interaction) {
		const { content } = interaction.targetMessage
		if (!content.includes('modrinth.com')) {
			await interaction.reply({
				embeds: [info('That message has no Modrinth links.')],
				flags: 'Ephemeral',
			})
			return
		}

		await interaction.deferReply()

		const cards = await resolveLinkCards(content)
		if (cards.length === 0) {
			await interaction.editReply({
				embeds: [error("Couldn't find anything on Modrinth for those links.")],
			})
			return
		}

		await interaction.editReply({
			embeds: cards.flatMap((card) => card.embeds),
			components: cards.flatMap((card) => card.components),
		})
	},
}
