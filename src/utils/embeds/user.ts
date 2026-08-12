import type { Labrinth } from '@modrinth/api-client'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'

import { emojiRefs, withEmoji } from '../emojis.js'
import { formatDiscordDate } from '../time.js'
import { topProjectsList } from './helpers.js'
import type { CardPayload } from './types.js'

// Bit values from Labrinth's `Badges` bitflags (apps/labrinth/src/models/v3/users.rs).
// CONTRIBUTOR/TRANSLATOR/AFFILIATE are reserved/internal and not shown here.
const BADGE_BITS = {
	'badge-plus': 1 << 0, // MIDAS
	'badge-early-modpack': 1 << 1,
	'badge-early-resourcepack': 1 << 2,
	'badge-early-plugin': 1 << 3,
	'badge-alpha': 1 << 4, // ALPHA_TESTER
}

export const BADGE_LABELS: Record<string, string> = {
	'badge-staff': 'Staff',
	'badge-moderator': 'Moderator',
	'badge-plus': 'Modrinth+',
	'badge-alpha': 'Alpha Tester',
	'badge-early-modpack': 'Early Modpack Adopter',
	'badge-early-resourcepack': 'Early Resource Pack Adopter',
	'badge-early-plugin': 'Early Plugin Adopter',
}

export function resolveBadges(user: Pick<Labrinth.Users.v3.User, 'role' | 'badges'>): string[] {
	const badges: string[] = []
	if (user.role === 'admin') badges.push('badge-staff')
	else if (user.role === 'moderator') badges.push('badge-moderator')
	for (const [key, bit] of Object.entries(BADGE_BITS)) {
		if (user.badges & bit) badges.push(key)
	}
	return badges
}

function formatBadges(keys: string[]): string {
	return keys.map((key) => withEmoji(key, BADGE_LABELS[key])).join(' ')
}

export function buildUserCard(
	user: Labrinth.Users.v3.User,
	projects: Labrinth.Projects.v3.Project[],
): CardPayload {
	const profileUrl = `https://modrinth.com/user/${user.username}`
	const totalDownloads = projects.reduce((sum, p) => sum + p.downloads, 0)
	const topProjects = topProjectsList(projects)
	const badges = resolveBadges(user)

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
	if (badges.length > 0) embed.addFields({ name: 'Badges', value: formatBadges(badges) })
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
