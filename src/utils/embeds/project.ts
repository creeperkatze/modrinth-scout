import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { modrinthClient } from '../api.js'
import { emojiRefs, emojis } from '../emojis.js'
import { formatPlainTags, formatTags } from '../loaders.js'
import { createModuleLogger } from '../logger.js'
import { formatDiscordDate, toDate } from '../time.js'
import { typeLabel } from './helpers.js'
import type { CardPayload } from './types.js'

const log = createModuleLogger('embeds:project')

async function getOwnerAvatarUrl(teamId: string): Promise<string | undefined> {
	try {
		const [members] = await modrinthClient.labrinth.teams_v3.getMultiple([teamId])
		return members?.find((m) => m.is_owner)?.user.avatar_url ?? undefined
	} catch (err) {
		log.warn({ err, teamId }, 'Failed to fetch team owner avatar')
		return undefined
	}
}

export async function buildProjectCard(
	project: Labrinth.Projects.v3.Project,
): Promise<CardPayload> {
	const type = project.project_types[0] ?? 'project'
	const url = `https://modrinth.com/${type}/${project.slug}`
	const gameVersions = (project.game_versions as string[] | undefined) ?? []
	const recentVersions = gameVersions.slice(-8).reverse()
	const extraVersions = gameVersions.length - recentVersions.length
	const versionsText =
		formatTags(recentVersions) + (extraVersions > 0 ? ` *(+${extraVersions} more)*` : '')
	const rawLoaders = project.loaders ?? []
	const loaders = rawLoaders.filter((l: string) => l !== 'minecraft' || rawLoaders.length === 1)
	const typeValue = `${emojis[type] ?? ''} ${typeLabel(type)}`.trim()
	const categories = [...(project.categories ?? []), ...(project.additional_categories ?? [])]
	const ownerAvatarUrl = await getOwnerAvatarUrl(project.team_id)

	const embed = new EmbedBuilder()
		.setTitle(project.name)
		.setDescription(project.summary)
		.addFields(
			{ name: 'Downloads', value: project.downloads.toLocaleString('en-US'), inline: true },
			{ name: 'Followers', value: project.followers.toLocaleString('en-US'), inline: true },
			{ name: 'Type', value: typeValue, inline: true },
			{ name: 'Release', value: formatDiscordDate(project.published), inline: true },
			{ name: 'Updated', value: formatDiscordDate(project.updated), inline: true },
		)
		.setFooter({ text: 'Updated', iconURL: ownerAvatarUrl })
		.setTimestamp(toDate(project.updated))

	if (loaders.length > 0)
		embed.addFields({ name: 'Loaders', value: formatPlainTags(loaders), inline: true })
	if (recentVersions.length > 0)
		embed.addFields({ name: 'Game Versions', value: versionsText, inline: true })
	if (categories.length > 0)
		embed.addFields({ name: 'Categories', value: formatPlainTags(categories), inline: false })
	if (project.icon_url) embed.setThumbnail(project.icon_url)
	if (project.color) embed.setColor(project.color)

	const links = project.link_urls ?? {}
	const viewProjectButton = new ButtonBuilder()
		.setLabel('View project')
		.setURL(url)
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) viewProjectButton.setEmoji(emojiRefs['modrinth'])

	const discordButton =
		links['discord'] &&
		new ButtonBuilder().setLabel('Discord').setURL(links['discord'].url).setStyle(ButtonStyle.Link)
	if (discordButton && emojiRefs['discord']) discordButton.setEmoji(emojiRefs['discord'])

	const buttons = [
		viewProjectButton,
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
		discordButton,
	].filter(Boolean) as ButtonBuilder[]

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
	}
}
