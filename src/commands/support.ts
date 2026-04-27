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
import { error, info } from '../utils/embeds/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const kofiIcon = new AttachmentBuilder(join(__dirname, '../assets/icons/kofi.png'), {
	name: 'kofi.png',
})

const KOFI_URL = 'https://ko-fi.com/creeperkatze'
const SUPPORTER_PERKS = `- Track up to **${MAX_TRACKED_SUPPORTER}** projects\n- Get notified **5x faster** (checks every 1 minute instead of 5)`

export function buildSupportInfoReply() {
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

	return { embeds: [embed], files: [kofiIcon], components: [row] }
}

export const supportCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('support')
		.setDescription('Support the development of this bot')
		.addSubcommand((sub) => sub.setName('info').setDescription('Show Ko-fi support info and perks'))
		.addSubcommand((sub) => sub.setName('list').setDescription('Show public supporters'))
		.addSubcommand((sub) =>
			sub
				.setName('activate')
				.setDescription('Activate supporter perks using your Ko-fi account')
				.addBooleanOption((opt) =>
					opt
						.setName('public')
						.setDescription('Show your name in `/support list` (true by default)')
						.setRequired(false),
				),
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
			await interaction.reply(buildSupportInfoReply())
			return
		}

		if (sub === 'list') {
			const supporters = await queries.getPublicSupporters()
			const description =
				supporters.length > 0
					? supporters.map((supporter) => `<@${supporter.discordUserId}>`).join('\n')
					: 'No public supporters yet.'

			await interaction.reply({
				embeds: [
					info(
						`### Supporters\n${description}\n\nThank you for helping keep Modrinth Scout running! ❤️`,
					),
				],
			})
			return
		}

		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
			await interaction.reply({
				embeds: [error('You need the Manage Server permission to use this command.')],
				flags: 'Ephemeral',
			})
			return
		}

		const guildId = interaction.guildId!

		if (sub === 'activate') {
			const showPublicly = interaction.options.getBoolean('public') ?? true
			const result = await queries.activateByUserId(interaction.user.id, guildId, showPublicly)

			if (result === 'not_found') {
				await interaction.reply({
					embeds: [
						error(
							'No Ko-fi donation found for your Discord account. Make sure your Discord is connected to Ko-fi, then try again.',
						),
					],
					flags: 'Ephemeral',
				})
				return
			}
			if (result === 'already_used') {
				await interaction.reply({
					embeds: [
						error(
							'Your Ko-fi donation has already been used to activate **supporter perks** on a different server.',
						),
					],
					flags: 'Ephemeral',
				})
				return
			}
			if (result === 'already_active') {
				await interaction.reply({
					embeds: [info('This server already has **supporter perks** active.')],
					flags: 'Ephemeral',
				})
				return
			}

			await interaction.reply({
				embeds: [
					info(
						`**Supporter perks** activated! This server now has the following perks:\n${SUPPORTER_PERKS}\n\n${
							showPublicly
								? 'You will appear in `/support list`.'
								: 'You opted out of appearing in `/support list`.'
						}\n\nThank you for your support!`,
					),
				],
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'status') {
			const config = await queries.getServerConfig(guildId)
			const isSupporter = config?.isSupporter ?? false
			await interaction.reply({
				embeds: [
					info(
						isSupporter
							? `This server has **supporter perks**:\n${SUPPORTER_PERKS}\n\nThank you for your support!`
							: `This server doesn't have **supporter perks**:\n${SUPPORTER_PERKS}.\n\nSupport the bot on Ko-fi with \`/support info\` to unlock them.`,
					),
				],
				flags: 'Ephemeral',
			})
		}
	},
}
