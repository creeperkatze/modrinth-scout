import { randomBytes } from 'node:crypto'

import type { Labrinth } from '@modrinth/api-client'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChatInputCommandInteraction,
	Client,
	EmbedBuilder,
	SlashCommandBuilder,
} from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import { queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { buildAuthorizeUrl } from '../utils/api/modrinthOAuth.js'
import { info, success } from '../utils/embeds/index.js'
import { emojiRefs } from '../utils/emojis.js'
import { createModuleLogger } from '../utils/logger.js'
import { formatDiscordDate } from '../utils/time.js'

const MODRINTH_GREEN = 0x1bd96a

const log = createModuleLogger('account')

async function notifyByDm(client: Client, discordUserId: string, embed: EmbedBuilder) {
	try {
		const user = await client.users.fetch(discordUserId)
		await user.send({ embeds: [embed] })
	} catch (err) {
		log.debug({ discordUserId, err }, 'Could not DM user about account link change')
	}
}

export function notifyAccountLinked(
	client: Client,
	discordUserId: string,
	user: Labrinth.Users.v3.User,
) {
	const embed = success(
		`Your Discord account is now linked to [${user.username}](https://modrinth.com/user/${user.username}) on Modrinth.\n\nUse \`/account unlink\` to undo this at any time.`,
	)
	if (user.avatar_url) embed.setThumbnail(user.avatar_url)
	return notifyByDm(client, discordUserId, embed)
}

async function handleLink(interaction: ChatInputCommandInteraction) {
	const state = randomBytes(32).toString('base64url')
	await queries.createLinkState(state, interaction.user.id)

	const button = new ButtonBuilder()
		.setLabel('Link with Modrinth')
		.setURL(buildAuthorizeUrl(state))
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) button.setEmoji(emojiRefs['modrinth'])

	await interaction.reply({
		embeds: [
			info(
				'Click the button below to sign in with Modrinth and link your account. The button expires in 10 minutes.\n\nModrinth Scout only reads your public profile to confirm who you are.',
			),
		],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
		flags: 'Ephemeral',
	})
}

async function handleUnlink(interaction: ChatInputCommandInteraction) {
	const removed = await queries.unlinkAccount(interaction.user.id)
	await interaction.reply({
		embeds: [
			removed
				? success('Your Modrinth account has been unlinked.')
				: info("You don't have a linked Modrinth account."),
		],
		flags: 'Ephemeral',
	})
	if (!removed) return

	await notifyByDm(
		interaction.client,
		interaction.user.id,
		success(
			`Your Discord account is no longer linked to [${removed.modrinthUsername}](https://modrinth.com/user/${removed.modrinthUsername}) on Modrinth.`,
		),
	)
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
	const linked = await queries.getLinkedAccount(interaction.user.id)
	if (!linked) {
		await interaction.reply({
			embeds: [info("You don't have a linked Modrinth account. Use `/account link` to link one.")],
			flags: 'Ephemeral',
		})
		return
	}

	const user = await modrinthClient.labrinth.users_v3.get(linked.modrinthUserId).catch(() => null)
	const username = user?.username ?? linked.modrinthUsername

	const embed = new EmbedBuilder()
		.setTitle('Linked Modrinth account')
		.setDescription(
			`[${username}](https://modrinth.com/user/${username}) since ${formatDiscordDate(linked.createdAt, 'D')}`,
		)
		.setColor(MODRINTH_GREEN)
	if (user?.avatar_url) embed.setThumbnail(user.avatar_url)

	await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
}

export const accountCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('account')
		.setDescription('Manage your linked Modrinth account')
		.addSubcommand((sub) =>
			sub.setName('link').setDescription('Link your Modrinth account to your Discord account'),
		)
		.addSubcommand((sub) => sub.setName('unlink').setDescription('Unlink your Modrinth account'))
		.addSubcommand((sub) =>
			sub.setName('status').setDescription('Show which Modrinth account is linked'),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'account',
		description: 'Manage your linked Modrinth account',
		category: 'general',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		const sub = interaction.options.getSubcommand()
		if (sub === 'link') await handleLink(interaction)
		else if (sub === 'unlink') await handleUnlink(interaction)
		else await handleStatus(interaction)
	},
}
