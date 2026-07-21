import { createHash } from 'node:crypto'

import { ModrinthApiError } from '@modrinth/api-client'
import { SlashCommandBuilder } from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { buildVersionNotification, error } from '../utils/embeds/index.js'
import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('identify')

const MAX_FILE_BYTES = 100 * 1024 * 1024

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

		if (attachment.size > MAX_FILE_BYTES) {
			await interaction.reply({
				embeds: [error(`That file is too large. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`)],
				flags: 'Ephemeral',
			})
			return
		}

		await interaction.deferReply()

		let hash: string
		try {
			const response = await fetch(attachment.url)
			if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
			if (!response.body) throw new Error('Download returned an empty body')
			// Hashed as it streams so a large upload never sits in memory whole.
			const hasher = createHash('sha1')
			for await (const chunk of response.body) hasher.update(chunk)
			hash = hasher.digest('hex')
		} catch (err) {
			log.warn({ err, name: attachment.name }, 'Failed to download attachment')
			await interaction.editReply({ embeds: [error('Could not download that attachment.')] })
			return
		}

		try {
			// The v2 match already has project_id, so fetch v3 version and project in parallel.
			const match = await modrinthClient.labrinth.versions_v2.getVersionFromFileHash(hash, 'sha1')
			const [version, project] = await Promise.all([
				modrinthClient.labrinth.versions_v3.getVersion(match.id),
				modrinthClient.labrinth.projects_v3.get(match.project_id),
			])

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
