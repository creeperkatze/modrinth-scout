import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import type {
	ModrinthCollection,
	ModrinthOrganization,
	ModrinthProject,
	ModrinthUser,
} from '../api/modrinth.js'

export interface CardPayload {
	embeds: EmbedBuilder[]
	components: ActionRowBuilder<ButtonBuilder>[]
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

export function buildProjectCard(project: ModrinthProject): CardPayload {
	const type = project.project_types[0] ?? 'project'
	const url = `https://modrinth.com/${type}/${project.slug}`
	const recentVersions = project.game_versions.slice(-3).reverse()
	const extraVersions = project.game_versions.length - recentVersions.length
	const versionsText =
		recentVersions.join(', ') + (extraVersions > 0 ? ` *(+${extraVersions} more)*` : '')
	const loaders = project.loaders.filter((l) => l !== 'minecraft' || project.loaders.length === 1)

	const embed = new EmbedBuilder()
		.setTitle(project.name)
		.setDescription(project.summary)
		.addFields(
			{ name: 'Downloads', value: project.downloads.toLocaleString('en-US'), inline: true },
			{ name: 'Followers', value: project.followers.toLocaleString('en-US'), inline: true },
			{ name: 'Type', value: type.charAt(0).toUpperCase() + type.slice(1), inline: true },
		)
		.setFooter({ text: 'Updated' })
		.setTimestamp(new Date(project.updated))

	if (loaders.length > 0)
		embed.addFields({ name: 'Loaders', value: loaders.join(', '), inline: true })
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
