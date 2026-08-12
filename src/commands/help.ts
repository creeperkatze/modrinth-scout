import { createRequire } from 'node:module'

import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	InteractionContextType,
	SlashCommandBuilder,
} from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import { usesDonatorPerks } from '../config/donatorPerks.js'
import type { ChatInputCommand } from '../types/index.js'
import { emojiRefs } from '../utils/emojis.js'
import { collectionCommand } from './collection.js'
import { donateCommand } from './donate.js'
import { identifyCommand } from './identify.js'
import { optionsCommand } from './options.js'
import { organizationCommand } from './organization.js'
import { pingCommand } from './ping.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { searchCommand } from './search.js'
import { statisticsCommand } from './statistics.js'
import { trackingCommand } from './tracking.js'
import { userCommand } from './user.js'
import { versionCommand } from './version.js'
import { voteCommand } from './vote.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const GITHUB_URL = 'https://github.com/creeperkatze/modrinth-scout'
const PRIVACY_URL = 'https://github.com/creeperkatze/modrinth-scout/blob/main/PRIVACY.md'
const TERMS_URL = 'https://github.com/creeperkatze/modrinth-scout/blob/main/TERMS.md'

export const HELP_DONATE_BUTTON_ID = 'help:donate'

type Entry = { name: string; description: string; dmUsable: boolean }
type Section = { heading: string; entries: Entry[] }

// Subcommands inherit their parent command's contexts; Discord has no per-subcommand contexts.
function isDmUsable(cmd: ChatInputCommand): boolean {
	const contexts = cmd.data.toJSON().contexts
	if (!contexts) return true
	return (
		contexts.includes(InteractionContextType.BotDM) ||
		contexts.includes(InteractionContextType.PrivateChannel)
	)
}

function toEntry(cmd: ChatInputCommand): Entry {
	return { name: cmd.meta.name, description: cmd.meta.description, dmUsable: isDmUsable(cmd) }
}

function toSubcommandEntries(cmd: ChatInputCommand): Entry[] {
	const dmUsable = isDmUsable(cmd)
	const entries: Entry[] = []

	for (const option of cmd.data.toJSON().options ?? []) {
		if (option.type === ApplicationCommandOptionType.Subcommand) {
			entries.push({
				name: `${cmd.meta.name} ${option.name}`,
				description: option.description,
				dmUsable,
			})
			continue
		}
		if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
			for (const sub of option.options ?? []) {
				entries.push({
					name: `${cmd.meta.name} ${option.name} ${sub.name}`,
					description: sub.description,
					dmUsable,
				})
			}
		}
	}

	return entries
}

function moveGroupAfter(entries: Entry[], afterName: string): Entry[] {
	const grouped = entries.filter((e) => e.name.split(' ').length > 2)
	const rest = entries.filter((e) => !grouped.includes(e))
	const index = rest.findIndex((e) => e.name === afterName)
	if (index === -1) return entries

	return [...rest.slice(0, index + 1), ...grouped, ...rest.slice(index + 1)]
}

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
			identifyCommand,
		].map(toEntry),
	},
	{
		heading: 'Tracking',
		entries: moveGroupAfter(toSubcommandEntries(trackingCommand), 'tracking remove'),
	},
	...(usesDonatorPerks
		? [{ heading: 'Donate', entries: toSubcommandEntries(donateCommand) } satisfies Section]
		: []),
	{
		heading: 'Miscellaneous',
		entries: [optionsCommand, statisticsCommand, voteCommand, pingCommand].map(toEntry),
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
		const usableSections = sections
			.map((section) => ({
				...section,
				entries: section.entries.filter((e) => e.dmUsable || interaction.inGuild()),
			}))
			.filter((section) => section.entries.length > 0)

		const description = usableSections
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

		if (usesDonatorPerks) {
			const donateButton = new ButtonBuilder()
				.setLabel('Donate')
				.setCustomId(HELP_DONATE_BUTTON_ID)
				.setStyle(ButtonStyle.Secondary)
			if (emojiRefs['kofi']) donateButton.setEmoji(emojiRefs['kofi'])
			buttons.push(donateButton)
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

				.setLabel('Terms')
				.setEmoji('📄')
				.setURL(TERMS_URL)
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
