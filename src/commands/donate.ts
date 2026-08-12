import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	InteractionContextType,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'

import { MAX_TRACKED_AUTHORS_DONATOR, MAX_TRACKED_DONATOR, queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { error, info } from '../utils/embeds/index.js'
import { emojiRefs } from '../utils/emojis.js'
import { donatorGuildCount } from '../utils/metrics.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const kofiIcon = new AttachmentBuilder(join(__dirname, '../assets/brand/kofi.png'), {
	name: 'kofi.png',
})

const KOFI_URL = 'https://ko-fi.com/creeperkatze'
const DONATOR_PERKS = `- Track up to **${MAX_TRACKED_DONATOR}** projects\n- Track up to **${MAX_TRACKED_AUTHORS_DONATOR}** authors\n- Get notified **5x faster** (checks every 1 minute instead of 5)`

export function buildDonateInfoReply() {
	const embed = new EmbedBuilder()
		.setTitle('Donate')
		.setDescription(
			`Modrinth Scout is free to use. If you find it useful, consider buying me a coffee. It helps keep the bot running and motivates further development.\n### Donator perks:\n${DONATOR_PERKS}\n### ⚠️ Important:\nLink your Discord account in your Ko-fi settings before donating, then run \`/donate activate\` in your server. This is a donation, not a subscription. Any donation permanently unlocks donator perks for one server.`,
		)
		.setThumbnail('attachment://kofi.png')
		.setColor(0xff5e5b)

	const button = new ButtonBuilder()
		.setLabel('Donate on Ko-fi')
		.setURL(KOFI_URL)
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['kofi']) button.setEmoji(emojiRefs['kofi'])

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

	return { embeds: [embed], files: [kofiIcon], components: [row] }
}

export const donateCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('donate')
		.setDescription('Donate to support the development of this bot')
		.addSubcommand((sub) =>
			sub.setName('info').setDescription('Show Ko-fi donation info and perks'),
		)
		.addSubcommand((sub) => sub.setName('list').setDescription('Show public donations'))
		.addSubcommand((sub) =>
			sub
				.setName('activate')
				.setDescription('Activate donator perks using your Ko-fi account')
				.addBooleanOption((opt) =>
					opt
						.setName('public')
						.setDescription('Show your name in `/donate list` (true by default)')
						.setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub.setName('status').setDescription('Check the donator status of this server'),
		)
		.setContexts(InteractionContextType.Guild)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
	meta: {
		name: 'donate',
		description: 'Donate to support the development of this bot',
		category: 'general',
		cooldownSeconds: 5,
		guildOnly: true,
	},
	async execute(interaction) {
		const sub = interaction.options.getSubcommand()

		if (sub === 'info') {
			await interaction.reply(buildDonateInfoReply())
			return
		}

		if (sub === 'list') {
			const donators = await queries.getPublicDonators()
			const description =
				donators.length > 0
					? donators.map((donator) => `<@${donator.discordUserId}>`).join('\n')
					: 'No public donations yet.'

			await interaction.reply({
				embeds: [
					info(
						`### Donations\n${description}\n\nThank you for helping keep Modrinth Scout running! ❤️`,
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
							'Your Ko-fi donation has already been used to activate **donator perks** on a different server.',
						),
					],
					flags: 'Ephemeral',
				})
				return
			}
			if (result === 'already_active') {
				await interaction.reply({
					embeds: [info('This server already has **donator perks** active.')],
					flags: 'Ephemeral',
				})
				return
			}

			donatorGuildCount.inc()

			await interaction.reply({
				embeds: [
					info(
						`**Donator perks** activated! This server now has the following perks:\n${DONATOR_PERKS}\n\n${
							showPublicly
								? 'You will appear in `/donate list`.'
								: 'You opted out of appearing in `/donate list`.'
						}\n\nThank you for your support!`,
					),
				],
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'status') {
			const config = await queries.getServerConfig(guildId)
			const isDonator = config?.isDonator ?? false
			await interaction.reply({
				embeds: [
					info(
						isDonator
							? `This server has **donator perks**:\n${DONATOR_PERKS}\n\nThank you for your support!`
							: `This server doesn't have **donator perks**:\n${DONATOR_PERKS}.\n\nDonate on Ko-fi with \`/donate info\` to unlock them.`,
					),
				],
				flags: 'Ephemeral',
			})
		}
	},
}
