import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import type { ModrinthProject } from '../../api/modrinth.js'
import { formatTags } from '../loaders.js'
import { type CardPayload, TYPE_LABELS } from './types.js'

export function buildProjectCard(project: ModrinthProject): CardPayload {
	const type = project.project_types[0] ?? 'project'
	const url = `https://modrinth.com/${type}/${project.slug}`
	const gameVersions = project.game_versions ?? []
	const recentVersions = gameVersions.slice(-3).reverse()
	const extraVersions = gameVersions.length - recentVersions.length
	const versionsText =
		formatTags(recentVersions) + (extraVersions > 0 ? ` *(+${extraVersions} more)*` : '')
	const rawLoaders = project.loaders ?? []
	const loaders = rawLoaders.filter((l) => l !== 'minecraft' || rawLoaders.length === 1)

	const embed = new EmbedBuilder()
		.setTitle(project.name)
		.setDescription(project.summary)
		.addFields(
			{ name: 'Downloads', value: project.downloads.toLocaleString('en-US'), inline: true },
			{ name: 'Followers', value: project.followers.toLocaleString('en-US'), inline: true },
			{
				name: 'Type',
				value: TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
				inline: true,
			},
		)
		.setFooter({ text: 'Updated' })
		.setTimestamp(new Date(project.updated))

	if (loaders.length > 0)
		embed.addFields({ name: 'Loaders', value: formatTags(loaders), inline: true })
	if (recentVersions.length > 0)
		embed.addFields({ name: 'Game Versions', value: versionsText, inline: true })
	if (project.icon_url) embed.setThumbnail(project.icon_url)
	if (project.color) embed.setColor(project.color)

	const links = project.link_urls ?? {}
	const buttons = [
		new ButtonBuilder().setLabel('View project').setURL(url).setStyle(ButtonStyle.Link),
		links['source'] &&
			new ButtonBuilder()
				.setLabel('Source')
				.setEmoji('💻')
				.setURL(links['source'].url)
				.setStyle(ButtonStyle.Link),
		links['issues'] &&
			new ButtonBuilder()
				.setLabel('Issues')
				.setEmoji('🐛')
				.setURL(links['issues'].url)
				.setStyle(ButtonStyle.Link),
		links['wiki'] &&
			new ButtonBuilder()
				.setLabel('Wiki')
				.setEmoji('📖')
				.setURL(links['wiki'].url)
				.setStyle(ButtonStyle.Link),
		links['discord'] &&
			new ButtonBuilder()
				.setLabel('Discord')
				.setEmoji('💬')
				.setURL(links['discord'].url)
				.setStyle(ButtonStyle.Link),
	].filter(Boolean) as ButtonBuilder[]

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
	}
}
