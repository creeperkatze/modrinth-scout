import { SlashCommandBuilder } from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api.js'
import { buildVersionNotification, error } from '../utils/embeds/index.js'
import { parseModrinthUrl } from '../utils/url.js'

export const versionCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('version')
		.setDescription('Look up a version of a Modrinth project')
		.addStringOption((o) =>
			o.setName('query').setDescription('Version ID or URL').setRequired(true),
		),
	meta: {
		name: 'version',
		description: 'Look up a version of a Modrinth project',
		category: 'utility',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		await interaction.deferReply()

		const raw = interaction.options.getString('query', true)
		const parsed = parseModrinthUrl(raw)

		if (parsed?.type === 'version') {
			const project = await modrinthClient.labrinth.projects_v3
				.get(parsed.projectSlug)
				.catch(() => null)

			if (project) {
				const versions = await modrinthClient.labrinth.versions_v3.getProjectVersions(project.id)
				const version = versions.find(
					(entry) => entry.id === parsed.reference || entry.version_number === parsed.reference,
				)

				if (version) {
					await interaction.editReply(await buildVersionNotification(project, version))
					return
				}
			}

			await interaction.editReply({
				embeds: [error(`No version found for \`${parsed.reference}\`.`)],
			})
			return
		}

		try {
			const version = await modrinthClient.labrinth.versions_v3.getVersion(raw)
			const project = await modrinthClient.labrinth.projects_v3.get(version.project_id)
			await interaction.editReply(await buildVersionNotification(project, version))
			return
		} catch {
			await interaction.editReply({
				embeds: [error(`No version found for \`${raw}\`.`)],
			})
		}
	},
}
