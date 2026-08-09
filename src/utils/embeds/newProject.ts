import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { emojiRefs, emojis } from '../emojis.js'
import { formatDiscordDate } from '../time.js'
import { typeLabel } from './helpers.js'
import type { CardPayload } from './types.js'

export function buildNewProjectNotification(
	project: Labrinth.Projects.v3.Project,
	author: { name: string; avatarUrl?: string },
): CardPayload {
	const type = project.project_types[0] ?? 'project'
	const url = `https://modrinth.com/${type}/${project.slug}`
	const typeValue = `${emojis[type] ?? ''} ${typeLabel(type)}`.trim()

	const embed = new EmbedBuilder()
		.setAuthor({ name: `New project by ${author.name}`, iconURL: author.avatarUrl })
		.setTitle(project.name)
		.setColor(project.color ?? 0x1bd96a)
		.addFields(
			{ name: 'Type', value: typeValue, inline: true },
			{ name: 'Published', value: formatDiscordDate(project.published), inline: true },
		)

	if (project.summary) embed.setDescription(project.summary)
	if (project.icon_url) embed.setThumbnail(project.icon_url)

	const viewProjectButton = new ButtonBuilder()
		.setLabel('View Project')
		.setURL(url)
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) viewProjectButton.setEmoji(emojiRefs['modrinth'])

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(viewProjectButton)],
	}
}
