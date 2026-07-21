import { ModrinthApiError } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { buildVersionNotification, error } from '../utils/embeds/index.js'
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
			log.warn({ err, name: attachment.name }, 'Failed to download attachment')
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
