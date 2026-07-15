import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { modrinthClient } from '../api.js'
import { emojiRefs } from '../emojis.js'
import { createModuleLogger } from '../logger.js'
import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

const log = createModuleLogger('embeds:collection')

async function getOwner(
	userId: string,
): Promise<{ name: string; avatarUrl: string | undefined } | undefined> {
	try {
		const user = await modrinthClient.labrinth.users_v3.get(userId)
		return { name: user.username, avatarUrl: user.avatar_url ?? undefined }
	} catch (err) {
		log.warn({ err, userId }, 'Failed to fetch collection owner')
		return undefined
	}
}

export async function buildCollectionCard(
	collection: Labrinth.Collections.Collection,
	projects: Labrinth.Projects.v3.Project[],
): Promise<CardPayload> {
	const collectionUrl = `https://modrinth.com/collection/${collection.id}`
	const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
	const topProjects = topProjectsList(projects)
	const owner = await getOwner(collection.user)

	const embed = new EmbedBuilder()
		.setTitle(collection.name)
		.setColor(collection.color ?? 0x1bd96a)
		.addFields(
			{ name: 'Projects', value: String(collection.projects.length), inline: true },
			{ name: 'Downloads', value: totalDownloads.toLocaleString('en-US'), inline: true },
		)
		.setFooter({ text: owner?.name ?? 'Unknown', iconURL: owner?.avatarUrl })

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
