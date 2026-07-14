import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { emojiRefs } from '../emojis.js'
import { toDate } from '../time.js'
import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

export function buildCollectionCard(
	collection: Labrinth.Collections.Collection,
	projects: Labrinth.Projects.v3.Project[],
): CardPayload {
	const collectionUrl = `https://modrinth.com/collection/${collection.id}`
	const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
	const topProjects = topProjectsList(projects)

	const embed = new EmbedBuilder()
		.setTitle(collection.name)
		.setColor(collection.color ?? 0x1bd96a)
		.addFields(
			{ name: 'Projects', value: String(collection.projects.length), inline: true },
			{ name: 'Downloads', value: totalDownloads.toLocaleString('en-US'), inline: true },
		)
		.setFooter({ text: 'Updated' })
		.setTimestamp(toDate(collection.updated))

	if (collection.description) embed.setDescription(collection.description)
	if (collection.icon_url) embed.setThumbnail(collection.icon_url)
	if (topProjects) embed.addFields({ name: 'Top Projects', value: topProjects })

	const viewCollectionButton = new ButtonBuilder()
		.setLabel('View Collection')
		.setURL(collectionUrl)
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) viewCollectionButton.setEmoji(emojiRefs['modrinth'])

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(viewCollectionButton)],
	}
}
