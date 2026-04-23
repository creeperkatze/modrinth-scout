import { createRequire } from 'node:module'

import {
	ActionRowBuilder,
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
import { supportCommand } from './support.js'
import { userCommand } from './user.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const GITHUB_URL = 'https://github.com/creeperkatze/modrinth-scout'
const KOFI_URL = 'https://ko-fi.com/creeperkatze'

const listed = [
	pingCommand,
	randomCommand,
	searchCommand,
	projectCommand,
	userCommand,
	organizationCommand,
	collectionCommand,
	supportCommand,
]

export const helpCommand: ChatInputCommand = {
	data: new SlashCommandBuilder().setName('help').setDescription('Show bot info and commands'),
	meta: {
		name: 'help',
		description: 'Show bot info and commands',
		category: 'general',
	},
	async execute(interaction) {
		const description = listed
			.map((cmd) => `**/${cmd.meta.name}**: ${cmd.meta.description}`)
			.join('\n')

		const embed = new EmbedBuilder()
			.setAuthor({
				name: interaction.client.user.username,
				iconURL: interaction.client.user.displayAvatarURL(),
			})
			.setDescription(
				'A Discord bot for discovering and exploring projects on Modrinth.\n\n' + description,
			)
			.setColor(0x1bd96a)
			.setFooter({ text: `v${version}` })

		const buttons = [
			new ButtonBuilder()
				.setLabel('View GitHub')
				.setEmoji('🌐')
				.setURL(GITHUB_URL)
				.setStyle(ButtonStyle.Link),

			new ButtonBuilder()
				.setLabel('Support on Ko-fi')
				.setEmoji('☕')
				.setURL(KOFI_URL)
				.setStyle(ButtonStyle.Link),
		].filter(Boolean) as ButtonBuilder[]

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)

		await interaction.reply({ embeds: [embed], components: [row] })
	},
}
