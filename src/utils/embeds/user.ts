import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import type { ModrinthProject, ModrinthUser } from '../../api/modrinth.js'
import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

export function buildUserCard(user: ModrinthUser, projects: ModrinthProject[]): CardPayload {
	const profileUrl = `https://modrinth.com/user/${user.username}`
	const joinedTimestamp = Math.floor(new Date(user.created).getTime() / 1000)
	const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
	const topProjects = topProjectsList(projects)

	const embed = new EmbedBuilder()
		.setTitle(user.username)
		.setColor(0x1bd96a)
		.addFields(
			{ name: 'Projects', value: String(projects.length), inline: true },
			{ name: 'Downloads', value: totalDownloads.toLocaleString('en-US'), inline: true },
			{ name: 'Member since', value: `<t:${joinedTimestamp}:D>`, inline: true },
		)

	if (user.bio) embed.setDescription(user.bio)
	if (user.avatar_url) embed.setThumbnail(user.avatar_url)
	if (topProjects) embed.addFields({ name: 'Top Projects', value: topProjects })

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setLabel('View Profile').setURL(profileUrl).setStyle(ButtonStyle.Link),
			),
		],
	}
}
