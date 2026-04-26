import { createRequire } from 'node:module'

import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'
import { collectionCommand } from './collection.js'
import { organizationCommand } from './organization.js'
import { pingCommand } from './ping.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { searchCommand } from './search.js'
import { statisticsCommand } from './statistics.js'
import { supportCommand } from './support.js'
import { trackingCommand } from './tracking.js'
import { userCommand } from './user.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const GITHUB_URL = 'https://github.com/creeperkatze/modrinth-scout'
const KOFI_URL = 'https://ko-fi.com/creeperkatze'
const PRIVACY_URL = 'https://github.com/creeperkatze/modrinth-scout/blob/main/PRIVACY.md'

type Entry = { name: string; description: string }

const sections: { heading: string; entries: Entry[] }[] = [
	{
		heading: 'General',
		entries: [
			searchCommand,
			projectCommand,
			randomCommand,
			userCommand,
			organizationCommand,
			collectionCommand,
		].map((c) => ({ name: c.meta.name, description: c.meta.description })),
	},
	{
		heading: 'Tracking',
		entries: (trackingCommand.data.toJSON().options ?? [])
			.filter((o) => o.type === ApplicationCommandOptionType.Subcommand)
			.map((o) => ({ name: `${trackingCommand.meta.name} ${o.name}`, description: o.description })),
	},
	{
		heading: 'Miscellaneous',
		entries: [statisticsCommand, supportCommand, pingCommand].map((c) => ({
			name: c.meta.name,
			description: c.meta.description,
		})),
	},
]

export const helpCommand: ChatInputCommand = {
	data: new SlashCommandBuilder().setName('help').setDescription('Show bot info and commands'),
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
				`Yet another Discord bot for discovering, exploring and tracking projects on Modrinth.\n${description}`,
			)
			.setColor(0x1bd96a)
			.setFooter({ text: `v${version} · Made with ❤️ by Creeperkatze` })

		const topggUrl = `https://top.gg/bot/${interaction.client.user.id}/vote`

		const buttons = [
			new ButtonBuilder()
				.setLabel('Star on GitHub')
				.setEmoji('⭐')
				.setURL(GITHUB_URL)
				.setStyle(ButtonStyle.Link),
			new ButtonBuilder()
				.setLabel('Privacy Policy')
				.setEmoji('🔒')
				.setURL(PRIVACY_URL)
				.setStyle(ButtonStyle.Link),

			new ButtonBuilder()
				.setLabel('Support on Ko-fi')
				.setEmoji('☕')
				.setURL(KOFI_URL)
				.setStyle(ButtonStyle.Link),

			new ButtonBuilder()
				.setLabel('Vote on top.gg')
				.setEmoji('🔺')
				.setURL(topggUrl)
				.setStyle(ButtonStyle.Link),
		].filter(Boolean) as ButtonBuilder[]

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)

		await interaction.reply({ embeds: [embed], components: [row] })
	},
}
