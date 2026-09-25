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
import { authorLink, info, success } from '../utils/embeds/index.js'
import { emojiRefs } from '../utils/emojis.js'
import { createModuleLogger } from '../utils/logger.js'
import { syncMemberAcrossGuilds } from '../utils/roles.js'
import { formatDiscordDate } from '../utils/time.js'

const MODRINTH_GREEN = 0x1bd96a

const log = createModuleLogger('account')

function userLink(username: string): string {
	return authorLink({ name: username, slug: username, kind: 'user' })
}

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
		`Your Discord account is now linked to ${userLink(user.username)} on Modrinth.`,
	)
	if (user.avatar_url) embed.setThumbnail(user.avatar_url)
	await notifyByDm(client, discordUserId, embed)

	await syncMemberAcrossGuilds(client, discordUserId, user.id)
	for (const id of displaced) await syncMemberAcrossGuilds(client, id, null)
}

// Also used by /roles get when the member hasn't linked yet
export async function buildLinkReply(discordUserId: string) {
	const state = randomBytes(32).toString('base64url')
	await queries.createPendingAccount(state, discordUserId)

	const button = new ButtonBuilder()
		.setLabel('Link with Modrinth')
		.setURL(buildAuthorizeUrl(state))
		.setStyle(ButtonStyle.Link)
	if (emojiRefs['modrinth']) button.setEmoji(emojiRefs['modrinth'])

	return {
		embeds: [info('Sign in with Modrinth to link your account.')],
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
			`Your Discord account is no longer linked to ${userLink(removed.modrinthUsername)} on Modrinth.`,
		),
	)
	await syncMemberAcrossGuilds(interaction.client, interaction.user.id, null)
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
	const linked = await queries.getAccount(interaction.user.id)
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
		.setDescription(`${userLink(username)} since ${formatDiscordDate(linked.createdAt, 'D')}`)
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
