import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import type { ModrinthCollection, ModrinthProject } from '../../api/modrinth.js'
import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

export function buildCollectionCard(
	collection: ModrinthCollection,
	projects: ModrinthProject[],
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
		.setTimestamp(new Date(collection.updated))

	if (collection.description) embed.setDescription(collection.description)
	if (collection.icon_url) embed.setThumbnail(collection.icon_url)
	if (topProjects) embed.addFields({ name: 'Top Projects', value: topProjects })

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('View Collection')
					.setURL(collectionUrl)
					.setStyle(ButtonStyle.Link),
			),
		],
	}
}
