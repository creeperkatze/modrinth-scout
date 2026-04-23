import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const kofiIcon = new AttachmentBuilder(join(__dirname, '../assets/icons/kofi.png'), {
	name: 'kofi.png',
})

const KOFI_URL = 'https://ko-fi.com/creeperkatze'

export const supportCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('support')
		.setDescription('Support the development of this bot'),
	meta: {
		name: 'support',
		description: 'Support the development of this bot',
		category: 'general',
		cooldownSeconds: 10,
	},
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setTitle('Support Modrinth Scout')
			.setDescription(
				'Modrinth Scout is free to use. If you find it useful, consider buying me a coffee. It helps keep the bot running and motivates further development. Thank you!',
			)
			.setThumbnail('attachment://kofi.png')
			.setColor(0xff5e5b)

		const button = new ButtonBuilder()
			.setLabel('Support on Ko-fi')
			.setURL(KOFI_URL)
			.setStyle(ButtonStyle.Link)
			.setEmoji('☕')

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

		await interaction.reply({ embeds: [embed], files: [kofiIcon], components: [row] })
	},
}
