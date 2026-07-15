import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { emojiRefs } from '../emojis.js'
import { formatDiscordDate } from '../time.js'
import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

export function buildUserCard(
	user: Labrinth.Users.v3.User,
	projects: Labrinth.Projects.v3.Project[],
): CardPayload {
	const profileUrl = `https://modrinth.com/user/${user.username}`
	const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
	const topProjects = topProjectsList(projects)

	const embed = new EmbedBuilder()
		.setTitle(user.username)
		.setColor(0x1bd96a)
		.addFields(
			{ name: 'Projects', value: String(projects.length), inline: true },
			{ name: 'Downloads', value: totalDownloads.toLocaleString('en-US'), inline: true },
			{ name: 'Member since', value: formatDiscordDate(user.created, 'D'), inline: true },
		)

	if (user.bio) embed.setDescription(user.bio)
	if (user.avatar_url) embed.setThumbnail(user.avatar_url)
	if (topProjects) embed.addFields({ name: 'Top Projects', value: topProjects })

	const viewProfileButton = new ButtonBuilder()
		.setLabel('View Profile')
		.setURL(profileUrl)
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) viewProfileButton.setEmoji(emojiRefs['modrinth'])

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(viewProfileButton)],
	}
}
