import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'

import { MAX_TRACKED_SUPPORTER, queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const kofiIcon = new AttachmentBuilder(join(__dirname, '../assets/icons/kofi.png'), {
	name: 'kofi.png',
})

const KOFI_URL = 'https://ko-fi.com/creeperkatze'
const SUPPORTER_PERKS = `- Track up to **${MAX_TRACKED_SUPPORTER}** projects\n- Get notified **5x faster** (checks every 1 minute instead of 5)`

export const supportCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('support')
		.setDescription('Support the development of this bot')
		.addSubcommand((sub) => sub.setName('info').setDescription('Show Ko-fi support info and perks'))
		.addSubcommand((sub) =>
			sub.setName('activate').setDescription('Activate supporter perks using your Ko-fi account'),
		)
		.addSubcommand((sub) =>
			sub.setName('status').setDescription('Check the supporter status of this server'),
		),
	meta: {
		name: 'support',
		description: 'Support the development of this bot',
		category: 'general',
		cooldownSeconds: 5,
		guildOnly: true,
	},
	async execute(interaction) {
		const sub = interaction.options.getSubcommand()

		if (sub === 'info') {
			const embed = new EmbedBuilder()
				.setTitle('Support')
				.setDescription(
					`Modrinth Scout is free to use. If you find it useful, consider buying me a coffee. It helps keep the bot running and motivates further development.\n### Supporter perks:\n${SUPPORTER_PERKS}\n### ⚠️ Important:\nLink your Discord account in your Ko-fi settings before donating, then run \`/support activate\` in your server. This is a donation, not a subscription. Any donation permanently unlocks supporter perks for one server.`,
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
			return
		}

		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
			await interaction.reply({
				content: 'You need the Manage Server permission to use this command.',
				flags: 'Ephemeral',
			})
			return
		}

		const guildId = interaction.guildId!

		if (sub === 'activate') {
			const result = await queries.activateByUserId(interaction.user.id, guildId)

			if (result === 'not_found') {
				const embed = new EmbedBuilder()
					.setDescription(
						'No Ko-fi donation found for your Discord account. Make sure your Discord is connected to Ko-fi, then try again.',
					)
					.setColor(0xed4245)
				await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
				return
			}
			if (result === 'already_used') {
				const embed = new EmbedBuilder()
					.setDescription(
						'Your Ko-fi donation has already been used to activate **supporter perks** on a different server.',
					)
					.setColor(0xed4245)
				await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
				return
			}
			if (result === 'already_active') {
				const embed = new EmbedBuilder()
					.setDescription('This server already has **supporter perks** active.')
					.setColor(0xff5e5b)
				await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
				return
			}

			const activateEmbed = new EmbedBuilder()
				.setDescription(
					`**Supporter perks** activated! This server now has the following perks:\n${SUPPORTER_PERKS}\n\nThank you for your support!`,
				)
				.setColor(0xff5e5b)
			await interaction.reply({ embeds: [activateEmbed], flags: 'Ephemeral' })
			return
		}

		if (sub === 'status') {
			const config = await queries.getServerConfig(guildId)
			const isSupporter = config?.isSupporter ?? false
			const statusEmbed = new EmbedBuilder()
				.setDescription(
					isSupporter
						? `This server has **supporter perks**:\n${SUPPORTER_PERKS}\n\nThank you for your support!`
						: `This server doesn't have **supporter perks**:\n${SUPPORTER_PERKS}.\n\nSupport the bot on Ko-fi with \`/support info\` to unlock them.`,
				)
				.setColor(0xff5e5b)
			await interaction.reply({ embeds: [statusEmbed], flags: 'Ephemeral' })
			return
		}
	},
}
