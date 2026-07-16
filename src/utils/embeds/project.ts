import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { modrinthClient } from '../api.js'
import { emojiRefs, emojis } from '../emojis.js'
import { createModuleLogger } from '../logger.js'
import { formatPlainTags, formatTags } from '../tags.js'
import { formatDiscordDate } from '../time.js'
import { typeLabel } from './helpers.js'
import type { CardPayload } from './types.js'

const log = createModuleLogger('embeds:project')

function urlMatchesHost(url: string, host: string): boolean {
	try {
		const { hostname } = new URL(url)
		return hostname === host || hostname.endsWith(`.${host}`)
	} catch {
		return false
	}
}

const SOURCE_HOST_EMOJIS: Record<string, string> = {
	'github.com': 'github',
	'gitlab.com': 'gitlab',
	'codeberg.org': 'codeberg',
	'bitbucket.org': 'bitbucket',
	'git.sr.ht': 'sourcehut',
}

const WIKI_HOST_EMOJIS: Record<string, string> = {
	'github.com': 'github',
	'github.io': 'github',
	'gitlab.com': 'gitlab',
	'codeberg.org': 'codeberg',
	'wiki.gg': 'wikigg',
	'fandom.com': 'fandom',
	'gitbook.io': 'gitbook',
	'readthedocs.io': 'readthedocs',
	'curseforge.com': 'curseforge',
	'miraheze.org': 'miraheze',
}

const ISSUES_HOST_EMOJIS: Record<string, string> = {
	'github.com': 'github',
	'gitlab.com': 'gitlab',
	'codeberg.org': 'codeberg',
	'bitbucket.org': 'bitbucket',
	'todo.sr.ht': 'sourcehut',
	'curseforge.com': 'curseforge',
}

function hostEmoji(
	url: string,
	table: Record<string, string>,
): { id: string; name: string } | undefined {
	const emojiKey = Object.entries(table).find(([host]) => urlMatchesHost(url, host))?.[1]
	return emojiKey ? emojiRefs[emojiKey] : undefined
}

async function getOwner(
	teamId: string,
	organizationId: string | undefined,
): Promise<{ name: string; avatarUrl: string | undefined } | undefined> {
	try {
		if (organizationId) {
			const organization = await modrinthClient.labrinth.organizations_v3.get(organizationId)
			return { name: organization.name, avatarUrl: organization.icon_url ?? undefined }
		}

		const [members] = await modrinthClient.labrinth.teams_v3.getMultiple([teamId])
		const owner = members?.find((m) => m.is_owner)?.user
		if (!owner) return undefined
		return { name: owner.username, avatarUrl: owner.avatar_url ?? undefined }
	} catch (err) {
		log.warn({ err, teamId, organizationId }, 'Failed to fetch project owner')
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
	const owner = await getOwner(project.team_id, project.organization)

	const embed = new EmbedBuilder()
		.setTitle(project.name)
		.setDescription(project.summary)
		.addFields(
			{ name: 'Downloads', value: project.downloads.toLocaleString('en-US'), inline: true },
			{ name: 'Followers', value: project.followers.toLocaleString('en-US'), inline: true },
			{ name: 'Type', value: typeValue, inline: true },
			{ name: 'Released', value: formatDiscordDate(project.published), inline: true },
			{ name: 'Updated', value: formatDiscordDate(project.updated), inline: true },
		)
		.setFooter({ text: owner?.name ?? 'Unknown', iconURL: owner?.avatarUrl })

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

	const sourceButton =
		links['source'] &&
		new ButtonBuilder().setLabel('Source').setURL(links['source'].url).setStyle(ButtonStyle.Link)
	if (sourceButton) {
		const emojiRef = hostEmoji(links['source']!.url, SOURCE_HOST_EMOJIS)
		sourceButton.setEmoji(emojiRef ?? '💻')
	}

	const wikiButton =
		links['wiki'] &&
		new ButtonBuilder().setLabel('Wiki').setURL(links['wiki'].url).setStyle(ButtonStyle.Link)
	if (wikiButton) {
		const emojiRef = hostEmoji(links['wiki']!.url, WIKI_HOST_EMOJIS)
		wikiButton.setEmoji(emojiRef ?? '📖')
	}

	const issuesButton =
		links['issues'] &&
		new ButtonBuilder().setLabel('Issues').setURL(links['issues'].url).setStyle(ButtonStyle.Link)
	if (issuesButton) {
		const emojiRef = hostEmoji(links['issues']!.url, ISSUES_HOST_EMOJIS)
		issuesButton.setEmoji(emojiRef ?? '🐛')
	}

	const buttons = [viewProjectButton, sourceButton, issuesButton, wikiButton, discordButton].filter(
		Boolean,
	) as ButtonBuilder[]

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
	}
}
