import type { Labrinth } from '@modrinth/api-client'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from 'discord.js'

import { modrinthClient } from '../api/modrinth.js'
import { emojiRefs, emojis, withEmoji } from '../emojis.js'
import { createModuleLogger } from '../logger.js'
import { formatPlainTags, formatTagsLimited } from '../tags.js'
import { formatDiscordDate } from '../time.js'
import { releaseNumber, sharedReleaseNumber } from '../versionGroups.js'
import type { CardPayload } from './types.js'

const log = createModuleLogger('embeds:version')

type Project = Labrinth.Projects.v3.Project
type Version = Labrinth.Versions.v3.Version

const MAX_CHANGELOG_LENGTH = 1024
const MAX_FIELD_LENGTH = 1024

async function getAuthor(
	authorId: string,
	organizationId: string | undefined,
): Promise<{ name: string; avatarUrl: string | undefined } | undefined> {
	try {
		if (organizationId) {
			const organization = await modrinthClient.labrinth.organizations_v3.get(organizationId)
			return { name: organization.name, avatarUrl: organization.icon_url ?? undefined }
		}

		const author = await modrinthClient.labrinth.users_v3.get(authorId)
		return { name: author.username, avatarUrl: author.avatar_url ?? undefined }
	} catch (err) {
		log.warn({ err, authorId, organizationId }, 'Failed to fetch version author')
		return undefined
	}
}

function projectUrlOf(project: Project): string {
	return `https://modrinth.com/${project.project_types[0] ?? 'project'}/${project.slug}`
}

function displayLoaders(version: Version): string[] {
	return version.loaders.filter((l) => l !== 'minecraft' || version.loaders.length === 1)
}

function typeValueOf(version: Version): string {
	const label = version.version_type.charAt(0).toUpperCase() + version.version_type.slice(1)
	return withEmoji(version.version_type, label)
}

async function baseEmbed(project: Project, version: Version, title: string): Promise<EmbedBuilder> {
	let changelog = version.changelog?.trim() ?? null
	if (changelog && changelog.length > MAX_CHANGELOG_LENGTH)
		changelog = changelog.slice(0, MAX_CHANGELOG_LENGTH) + '\n...'

	const author = await getAuthor(version.author_id, project.organization)

	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(project.color ?? 0x1bd96a)
		.setFooter({ text: author?.name ?? 'Unknown', iconURL: author?.avatarUrl })

	if (changelog) embed.setDescription(changelog)
	if (project.icon_url) embed.setThumbnail(project.icon_url)

	return embed
}

function linkButton(label: string, url: string, emoji?: string): ButtonBuilder {
	const button = new ButtonBuilder().setLabel(label).setURL(url).setStyle(ButtonStyle.Link)
	if (emoji && emojiRefs[emoji]) button.setEmoji(emojiRefs[emoji])
	return button
}

export async function buildVersionNotification(
	project: Project,
	version: Version,
	versionLabel = 'View Version',
): Promise<CardPayload> {
	const projectUrl = projectUrlOf(project)
	const versionUrl = `${projectUrl}/version/${version.id}`
	const primaryFile = version.files.find((file) => file.primary) ?? version.files[0]
	const loaders = displayLoaders(version)

	const embed = await baseEmbed(project, version, `${project.name} ${version.version_number}`)

	if (version.game_versions.length > 0)
		embed.addFields({
			name: 'Game versions',
			value: formatTagsLimited(version.game_versions),
			inline: true,
		})
	if (loaders.length > 0)
		embed.addFields({ name: 'Loaders', value: formatPlainTags(loaders), inline: true })
	embed.addFields({ name: 'Type', value: typeValueOf(version), inline: true })
	embed.addFields({
		name: 'Released',
		value: formatDiscordDate(version.date_published),
		inline: true,
	})

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents([
				linkButton(versionLabel, versionUrl, 'modrinth'),
				linkButton('View Project', projectUrl, 'modrinth'),
				...(primaryFile ? [linkButton('Download', primaryFile.url, 'download')] : []),
			]),
		],
	}
}

function compareGameVersions(a: string, b: string): number {
	return a.localeCompare(b, undefined, { numeric: true })
}

function gameVersionLabel(version: Version): string {
	const sorted = [...version.game_versions].sort(compareGameVersions)
	if (sorted.length === 0) return version.version_number
	if (sorted.length === 1) return sorted[0]
	return `${sorted[0]} - ${sorted[sorted.length - 1]}`
}

function loaderLabel(loaders: string[]): string {
	return loaders
		.filter((l) => l !== 'minecraft')
		.map((l) => emojis[l] ?? `\`${l.charAt(0).toUpperCase() + l.slice(1)}\``)
		.join(' ')
}

function buildLines(versions: Version[]): { loaders: string[]; builds: Version[] }[] {
	const byLoaders = new Map<string, { loaders: string[]; builds: Version[] }>()
	for (const version of versions) {
		const loaders = displayLoaders(version)
		const key = [...loaders].sort().join(',')
		const line = byLoaders.get(key) ?? { loaders, builds: [] }
		line.builds.push(version)
		byLoaders.set(key, line)
	}
	for (const line of byLoaders.values())
		line.builds.sort((a, b) => compareGameVersions(gameVersionLabel(b), gameVersionLabel(a)))
	return [...byLoaders.values()]
}

function buildLabel(version: Version, withNumbers: boolean): string {
	const gameVersions = gameVersionLabel(version)
	return withNumbers ? `${gameVersions} (${releaseNumber(version)})` : gameVersions
}

function formatBuilds(
	versions: Version[],
	versionUrl: (v: Version) => string,
	withNumbers: boolean,
): string {
	const lines = buildLines(versions)

	const render = (linked: boolean) =>
		lines
			.map(({ loaders, builds }) => {
				const entries = builds
					.map((v) => {
						const label = buildLabel(v, withNumbers)
						return linked ? `[${label}](${versionUrl(v)})` : label
					})
					.join(' · ')
				return [loaderLabel(loaders), entries].filter(Boolean).join(' ')
			})
			.join('\n')

	const linked = render(true)
	if (linked.length <= MAX_FIELD_LENGTH) return linked
	const plain = render(false)
	if (plain.length <= MAX_FIELD_LENGTH) return plain
	return plain.slice(0, MAX_FIELD_LENGTH - 4) + ' ...'
}

export async function buildVersionGroupNotification(
	project: Project,
	versions: Version[],
): Promise<CardPayload> {
	if (versions.length === 1) return buildVersionNotification(project, versions[0])

	const projectUrl = projectUrlOf(project)
	const newest = versions[versions.length - 1]

	const number = sharedReleaseNumber(versions)
	const title = number ? `${project.name} ${number}` : project.name

	const embed = (await baseEmbed(project, newest, title))
		.setURL(projectUrl)
		.setTimestamp(new Date(newest.date_published))
		.addFields({
			name: 'Versions',
			value: formatBuilds(versions, (v) => `${projectUrl}/version/${v.id}`, !number),
		})
	if (newest.version_type !== 'release')
		embed.addFields({ name: 'Type', value: typeValueOf(newest), inline: true })

	return { embeds: [embed], components: [buildVersionSelect(versions, !number)] }
}

const MAX_SELECT_OPTIONS = 25

function buildVersionSelect(
	versions: Version[],
	withNumbers: boolean,
): ActionRowBuilder<StringSelectMenuBuilder> {
	const builds = buildLines(versions).flatMap(({ loaders, builds }) =>
		builds.map((version) => ({ version, loaders })),
	)

	const options = builds.slice(0, MAX_SELECT_OPTIONS).map(({ version, loaders }) => {
		const shown = loaders.filter((l) => l !== 'minecraft')
		const names = shown.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')
		const label = [names, buildLabel(version, withNumbers)].filter(Boolean).join(' ')
		const option = new StringSelectMenuOptionBuilder()
			.setLabel(label.slice(0, 100))
			.setDescription(version.version_number.slice(0, 100))
			.setValue(`version:${version.id}`)
		const emoji = emojiRefs[shown[0]]
		if (emoji) option.setEmoji(emoji)
		return option
	})

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId('version-group:view')
			.setPlaceholder('View version')
			.addOptions(options),
	)
}
