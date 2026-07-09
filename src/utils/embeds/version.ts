import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { modrinthClient } from '../api.js'
import { emojiRefs, emojis } from '../emojis.js'
import { formatTags } from '../loaders.js'
import { createModuleLogger } from '../logger.js'
import { toDate } from '../time.js'
import type { CardPayload } from './types.js'

const log = createModuleLogger('embeds:version')

async function getAuthorAvatarUrl(authorId: string): Promise<string | undefined> {
	try {
		const author = await modrinthClient.labrinth.users_v3.get(authorId)
		return author.avatar_url ?? undefined
	} catch (err) {
		log.warn({ err, authorId }, 'Failed to fetch version author avatar')
		return undefined
	}
}

export async function buildVersionNotification(
	project: Labrinth.Projects.v3.Project,
	version: Labrinth.Versions.v3.Version,
	versionLabel = 'View Version',
): Promise<CardPayload> {
	const type = project.project_types[0] ?? 'project'
	const projectUrl = `https://modrinth.com/${type}/${project.slug}`
	const versionUrl = `${projectUrl}/version/${version.id}`
	const primaryFile =
		version.files.find((file: { primary: boolean }) => file.primary) ?? version.files[0]

	const loaders = version.loaders.filter(
		(l: string) => l !== 'minecraft' || version.loaders.length === 1,
	)

	const MAX_CHANGELOG_LENGTH = 1024
	let changelog = version.changelog?.trim() ?? null
	if (changelog && changelog.length > MAX_CHANGELOG_LENGTH)
		changelog = changelog.slice(0, MAX_CHANGELOG_LENGTH) + '\n...'

	const typeLabel = version.version_type.charAt(0).toUpperCase() + version.version_type.slice(1)
	const typeValue = `${emojis[version.version_type] ?? ''} ${typeLabel}`.trim()
	const authorAvatarUrl = await getAuthorAvatarUrl(version.author_id)

	const embed = new EmbedBuilder()
		.setTitle(`${project.name} ${version.version_number}`)
		.setColor(project.color ?? 0x1bd96a)
		.setFooter({ text: 'Released', iconURL: authorAvatarUrl })
		.setTimestamp(toDate(version.date_published))

	if (changelog) embed.setDescription(changelog)
	if (project.icon_url) embed.setThumbnail(project.icon_url)

	if (version.game_versions.length > 0)
		embed.addFields({
			name: 'Game versions',
			value: version.game_versions.join(', '),
			inline: true,
		})
	if (loaders.length > 0)
		embed.addFields({ name: 'Loaders', value: formatTags(loaders), inline: true })
	embed.addFields({ name: 'Type', value: typeValue, inline: true })

	const viewVersionButton = new ButtonBuilder()
		.setLabel(versionLabel)
		.setURL(versionUrl)
		.setStyle(ButtonStyle.Link)
	const viewProjectButton = new ButtonBuilder()
		.setLabel('View Project')
		.setURL(projectUrl)
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) {
		viewVersionButton.setEmoji(emojiRefs['modrinth'])
		viewProjectButton.setEmoji(emojiRefs['modrinth'])
	}

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents([
				viewVersionButton,
				viewProjectButton,
				...(primaryFile
					? [
							new ButtonBuilder()
								.setLabel('Download')
								.setEmoji('⬇️')
								.setURL(primaryFile.url)
								.setStyle(ButtonStyle.Link),
						]
					: []),
			]),
		],
	}
}
