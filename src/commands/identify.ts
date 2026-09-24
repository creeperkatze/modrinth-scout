import { ModrinthApiError } from '@modrinth/api-client'
import { ApplicationCommandType, ContextMenuCommandBuilder, SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand, MessageContextMenuCommand } from '../types/index.js'
import { jarAttachmentsOf, resolveJarCards } from '../utils/autoEmbeds.js'
import { buildVersionNotification, error, info } from '../utils/embeds/index.js'
import { hashAttachment, identifyByHash, MAX_JAR_FILE_BYTES } from '../utils/identify.js'
import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('identify')

export const identifyCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('identify')
		.setDescription('Identify a mod file by uploading it')
		.addAttachmentOption((o) =>
			o.setName('file').setDescription('The mod file to identify').setRequired(true),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'identify',
		description: 'Identify a mod file by uploading it',
		category: 'utility',
		cooldownSeconds: 10,
	},

	async execute(interaction) {
		const attachment = interaction.options.getAttachment('file', true)

		if (!attachment.name.toLowerCase().endsWith('.jar')) {
			await interaction.reply({
				embeds: [error('Attach a `.jar` mod file.')],
				flags: 'Ephemeral',
			})
			return
		}

		if (attachment.size > MAX_JAR_FILE_BYTES) {
			await interaction.reply({
				embeds: [
					error(`That file is too large. The limit is ${MAX_JAR_FILE_BYTES / 1024 / 1024} MB.`),
				],
				flags: 'Ephemeral',
			})
			return
		}

		await interaction.deferReply()

		let hash: string
		try {
			hash = await hashAttachment(attachment.url)
		} catch (err) {
			log.warn({ err, fileName: attachment.name }, 'Failed to download attachment')
			await interaction.editReply({ embeds: [error('Could not download that attachment.')] })
			return
		}

		try {
			const { project, version } = await identifyByHash(hash)

			log.info(
				{ userId: interaction.user.id, projectId: project.id, versionId: version.id },
				'File identified',
			)
			await interaction.editReply(await buildVersionNotification(project, version))
		} catch (err) {
			const notFound = err instanceof ModrinthApiError && err.statusCode === 404
			const message = notFound
				? `\`${attachment.name}\` was not found on Modrinth.`
				: err instanceof Error
					? err.message
					: String(err)
			await interaction.editReply({ embeds: [error(message)] })
		}
	},
}

export const identifyContextMenu: MessageContextMenuCommand = {
	type: ApplicationCommandType.Message,
	data: new ContextMenuCommandBuilder()
		.setName('Identify')
		.setType(ApplicationCommandType.Message)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'Identify',
		description: "Identify a message's mod files",
		category: 'utility',
		cooldownSeconds: 10,
	},

	async execute(interaction) {
		const attachments = jarAttachmentsOf(interaction.targetMessage)
		if (attachments.length === 0) {
			await interaction.reply({
				embeds: [info('That message has no `.jar` files.')],
				flags: 'Ephemeral',
			})
			return
		}

		await interaction.deferReply()

		const cards = await resolveJarCards(attachments)
		if (cards.length === 0) {
			const message =
				attachments.length === 1
					? `\`${attachments[0].name}\` was not found on Modrinth.`
					: 'None of those files were found on Modrinth.'
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		await interaction.editReply({
			embeds: cards.flatMap((card) => card.embeds),
			components: cards.flatMap((card) => card.components),
		})
	},
}
