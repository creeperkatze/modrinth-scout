import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import type { ModrinthProject } from '../../api/modrinth.js'
import type { CardPayload } from './types.js'

export function buildUpdateNotification(project: ModrinthProject): CardPayload {
	const type = project.project_types[0] ?? 'project'
	const url = `https://modrinth.com/${type}/${project.slug}`

	const embed = new EmbedBuilder()
		.setTitle(`${project.name} was updated`)
		.setDescription(project.summary)
		.setColor(project.color ?? 0x1bd96a)
		.setFooter({ text: 'Updated' })
		.setTimestamp(new Date(project.updated))

	if (project.icon_url) embed.setThumbnail(project.icon_url)

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setLabel('View on Modrinth').setURL(url).setStyle(ButtonStyle.Link),
			),
		],
	}
}
