import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

export function buildOrganizationCard(
	org: Labrinth.Organizations.v3.Organization,
	projects: Labrinth.Projects.v3.Project[],
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
