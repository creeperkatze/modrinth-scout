import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import type {
	ModrinthCollection,
	ModrinthOrganization,
	ModrinthProject,
	ModrinthUser,
	ModrinthVersion,
} from '../api/modrinth.js'

export interface CardPayload {
	embeds: EmbedBuilder[]
	components: ActionRowBuilder<ButtonBuilder>[]
}

const LOADER_EMOJIS: Record<string, string> = {
	fabric: '<:fabric:1497892889932337182>',
	babric: '<:babric:1497892908806832158>',
	'bta-babric': '<:btababric:1497892915903598612>',
	forge: '<:forge:1497892941031542875>',
	'java-agent': '<:javaagent:1497892948849856592>',
	'legacy-fabric': '<:legacyfabric:1497892956915630133>',
	liteloader: '<:liteloader:1497892966092771459>',
	modloader: '<:modloader:1497892982160883762>',
	neoforge: '<:neoforge:1497892990281056386>',
	nilloader: '<:nilloader:1497892997751111740>',
	ornithe: '<:ornithe:1497893006668337233>',
	quilt: '<:quilt:1497893017745358879>',
	rift: '<:rift:1497893025236389888>',
}

function formatTags(tags: string[]): string {
	return tags
		.map((t) => {
			const emoji = LOADER_EMOJIS[t.toLowerCase()]
			const label = `\`${t.charAt(0).toUpperCase() + t.slice(1)}\``
			return emoji ? `${emoji} ${label}` : label
		})
		.join(' ')
}

function topProjectsList(projects: ModrinthProject[]): string {
	return [...projects]
		.sort((a, b) => b.downloads - a.downloads)
		.slice(0, 5)
		.map(
			(p) =>
				`[${p.name}](https://modrinth.com/${p.project_types[0]}/${p.slug}) — ${p.downloads.toLocaleString('en-US')} downloads`,
		)
		.join('\n')
}

export const TYPE_LABELS: Record<string, string> = {
	minecraft_java_server: 'Server',
}

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

export function buildVersionNotification(
	project: ModrinthProject,
	version: ModrinthVersion,
): CardPayload {
	const type = project.project_types[0] ?? 'project'
	const projectUrl = `https://modrinth.com/${type}/${project.slug}`
	const versionUrl = `${projectUrl}/version/${version.id}`

	const loaders = version.loaders.filter((l) => l !== 'minecraft' || version.loaders.length === 1)

	const MAX_CHANGELOG = 4000
	let changelog = version.changelog?.trim() ?? null
	if (changelog && changelog.length > MAX_CHANGELOG)
		changelog = changelog.slice(0, MAX_CHANGELOG) + '\n...'

	const typeLabel = version.version_type.charAt(0).toUpperCase() + version.version_type.slice(1)

	const embed = new EmbedBuilder()
		.setTitle(`${project.name} ${version.version_number}`)
		.setColor(project.color ?? 0x1bd96a)
		.setFooter({ text: 'Released' })
		.setTimestamp(new Date(version.date_published))

	if (changelog) embed.setDescription(changelog)
	if (project.icon_url) embed.setThumbnail(project.icon_url)

	if (version.game_versions.length > 0)
		embed.addFields({ name: 'MC Version', value: version.game_versions.join(', '), inline: true })
	if (loaders.length > 0)
		embed.addFields({ name: 'Loaders', value: formatTags(loaders), inline: true })
	embed.addFields({ name: 'Type', value: typeLabel, inline: true })

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setLabel('View Version').setURL(versionUrl).setStyle(ButtonStyle.Link),
				new ButtonBuilder().setLabel('View Project').setURL(projectUrl).setStyle(ButtonStyle.Link),
			),
		],
	}
}

export function buildUpdateNotification(project: ModrinthProject): CardPayload {
	const type = project.project_types[0] ?? 'project'
	const url = `https://modrinth.com/${type}/${project.slug}`

	const embed = new EmbedBuilder()
		.setTitle(`${project.name} was updated`)
		.setDescription(project.summary)
		.setColor(project.color ?? 0x1bd96a)
		.setFooter({ text: 'Updated' })
		.setTimestamp(new Date(project.updated))

	if (project.icon_url) embed.setThumbnail(project.icon_url)

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setLabel('View on Modrinth').setURL(url).setStyle(ButtonStyle.Link),
			),
		],
	}
}

export function buildOrganizationCard(
	org: ModrinthOrganization,
	projects: ModrinthProject[],
): CardPayload {
	const orgUrl = `https://modrinth.com/organization/${org.slug}`
	const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
	const topProjects = topProjectsList(projects)

	const embed = new EmbedBuilder()
		.setTitle(org.name)
		.setColor(org.color ?? 0x1bd96a)
		.addFields(
			{ name: 'Projects', value: String(projects.length), inline: true },
			{ name: 'Downloads', value: totalDownloads.toLocaleString('en-US'), inline: true },
		)

	if (org.description) embed.setDescription(org.description)
	if (org.icon_url) embed.setThumbnail(org.icon_url)
	if (topProjects) embed.addFields({ name: 'Top Projects', value: topProjects })

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setLabel('View Organization').setURL(orgUrl).setStyle(ButtonStyle.Link),
			),
		],
	}
}
