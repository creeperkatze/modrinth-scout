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
import { syncMemberAcrossGuilds } from '../utils/roles.js'
import { formatDiscordDate } from '../utils/time.js'

const MODRINTH_GREEN = 0x1bd96a

const log = createModuleLogger('link')

async function notifyByDm(client: Client, discordUserId: string, embed: EmbedBuilder) {
	try {
		const user = await client.users.fetch(discordUserId)
		await user.send({ embeds: [embed] })
	} catch (err) {
		log.debug({ discordUserId, err }, 'Could not DM user about account link change')
	}
}

// Runs after the OAuth callback stored the link. `displaced` lost this Modrinth account to the new link
export async function handleAccountLinked(
	client: Client,
	discordUserId: string,
	user: Labrinth.Users.v3.User,
	displaced: string[],
) {
	const embed = success(
		`Your Discord account is now linked to [${user.username}](https://modrinth.com/user/${user.username}) on Modrinth.\n\nUse \`/link remove\` to undo this at any time.`,
	)
	if (user.avatar_url) embed.setThumbnail(user.avatar_url)
	await notifyByDm(client, discordUserId, embed)

	await syncMemberAcrossGuilds(client, discordUserId, user.id)
	for (const id of displaced) await syncMemberAcrossGuilds(client, id, null)
}

// Also used by /roles get when the member hasn't linked yet
export async function buildLinkReply(discordUserId: string) {
	const state = randomBytes(32).toString('base64url')
	await queries.createLinkState(state, discordUserId)

	const button = new ButtonBuilder()
		.setLabel('Link with Modrinth')
		.setURL(buildAuthorizeUrl(state))
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) button.setEmoji(emojiRefs['modrinth'])

	return {
		embeds: [
			info(
				'Click the button below to sign in with Modrinth and link your account. The button expires in 10 minutes.\n\nModrinth Scout only reads your public profile to confirm who you are.',
			),
		],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
	}
}

async function handleLink(interaction: ChatInputCommandInteraction) {
	await interaction.reply({ ...(await buildLinkReply(interaction.user.id)), flags: 'Ephemeral' })
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
	await syncMemberAcrossGuilds(interaction.client, interaction.user.id, null)
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
	const linked = await queries.getLinkedAccount(interaction.user.id)
	if (!linked) {
		await interaction.reply({
			embeds: [info("You don't have a linked Modrinth account. Use `/link add` to link one.")],
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

export const linkCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('link')
		.setDescription('Manage your linked Modrinth account')
		.addSubcommand((sub) =>
			sub.setName('add').setDescription('Link your Modrinth account to your Discord account'),
		)
		.addSubcommand((sub) => sub.setName('remove').setDescription('Unlink your Modrinth account'))
		.addSubcommand((sub) =>
			sub.setName('status').setDescription('Show which Modrinth account is linked'),
		)
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'link',
		description: 'Manage your linked Modrinth account',
		category: 'general',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		const sub = interaction.options.getSubcommand()
		if (sub === 'add') await handleLink(interaction)
		else if (sub === 'remove') await handleUnlink(interaction)
		else await handleStatus(interaction)
	},
}
