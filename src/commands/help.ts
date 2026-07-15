import { createRequire } from 'node:module'

import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import { usesSupporterPerks } from '../config/supporterPerks.js'
import type { ChatInputCommand } from '../types/index.js'
import { emojiRefs } from '../utils/emojis.js'
import { collectionCommand } from './collection.js'
import { optionsCommand } from './options.js'
import { organizationCommand } from './organization.js'
import { pingCommand } from './ping.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { searchCommand } from './search.js'
import { statisticsCommand } from './statistics.js'
import { supportCommand } from './support.js'
import { trackingCommand } from './tracking.js'
import { userCommand } from './user.js'
import { versionCommand } from './version.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const GITHUB_URL = 'https://github.com/creeperkatze/modrinth-scout'
const PRIVACY_URL = 'https://github.com/creeperkatze/modrinth-scout/blob/main/PRIVACY.md'

export const HELP_SUPPORT_BUTTON_ID = 'help:support'

type Entry = { name: string; description: string }
type Section = { heading: string; entries: Entry[] }

const sections: Section[] = [
	{
		heading: 'General',
		entries: [
			projectCommand,
			versionCommand,
			randomCommand,
			userCommand,
			organizationCommand,
			collectionCommand,
			searchCommand,
		].map((c) => ({ name: c.meta.name, description: c.meta.description })),
	},
	{
		heading: 'Tracking',
		entries: (trackingCommand.data.toJSON().options ?? [])
			.filter((o) => o.type === ApplicationCommandOptionType.Subcommand)
			.map((o) => ({ name: `${trackingCommand.meta.name} ${o.name}`, description: o.description })),
	},
	...(usesSupporterPerks
		? [
				{
					heading: 'Support',
					entries: (supportCommand.data.toJSON().options ?? [])
						.filter((o) => o.type === ApplicationCommandOptionType.Subcommand)
						.map((o) => ({
							name: `${supportCommand.meta.name} ${o.name}`,
							description: o.description,
						})),
				} satisfies Section,
			]
		: []),
	{
		heading: 'Options',
		entries: [optionsCommand].map((c) => ({ name: c.meta.name, description: c.meta.description })),
	},
	{
		heading: 'Miscellaneous',
		entries: [statisticsCommand, pingCommand].map((c) => ({
			name: c.meta.name,
			description: c.meta.description,
		})),
	},
]

export const helpCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Show bot info and commands')
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'help',
		description: 'Show bot info and commands',
		category: 'general',
	},
	async execute(interaction) {
		const description = sections
			.map(
				({ heading, entries }) =>
					`### ${heading}\n` + entries.map((e) => `**/${e.name}** · ${e.description}`).join('\n'),
			)
			.join('\n')

		const embed = new EmbedBuilder()
			.setAuthor({
				name: interaction.client.user.username,
				iconURL: interaction.client.user.displayAvatarURL(),
			})
			.setDescription(
				`A Discord bot for discovering, exploring and tracking projects on Modrinth.\n${description}`,
			)
			.setColor(0x1bd96a)
			.setFooter({ text: `v${version} · Made with ❤️ by Creeperkatze` })

		const topggUrl = `https://top.gg/bot/${interaction.client.user.id}/vote`

		const buttons: ButtonBuilder[] = []

		if (usesSupporterPerks) {
			const supportButton = new ButtonBuilder()
				.setLabel('Support')
				.setCustomId(HELP_SUPPORT_BUTTON_ID)
				.setStyle(ButtonStyle.Secondary)
			if (emojiRefs['kofi']) supportButton.setEmoji(emojiRefs['kofi'])
			buttons.push(supportButton)
		}

		const topggButton = new ButtonBuilder()
			.setLabel('Vote on top.gg')
			.setURL(topggUrl)
			.setStyle(ButtonStyle.Link)
		if (emojiRefs['topgg']) topggButton.setEmoji(emojiRefs['topgg'])

		buttons.push(
			new ButtonBuilder()

				.setLabel('Privacy')
				.setEmoji('🔒')
				.setURL(PRIVACY_URL)
				.setStyle(ButtonStyle.Link),
			new ButtonBuilder()

				.setLabel('Star on GitHub')
				.setEmoji('⭐')
				.setURL(GITHUB_URL)
				.setStyle(ButtonStyle.Link),
			topggButton,
		)

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)

		await interaction.reply({ embeds: [embed], components: [row] })
	},
}
