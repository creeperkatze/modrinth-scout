import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'

import { ANYWHERE_CONTEXTS, ANYWHERE_INTEGRATION_TYPES } from '../config/discord.js'
import { usesVoteRewards } from '../config/voteRewards.js'
import { queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { error } from '../utils/embeds/index.js'
import { emojiRefs } from '../utils/emojis.js'

export const VOTE_CLAIM_BUTTON_ID = 'vote:claim'

export async function handleVoteClaimButton(interaction: ButtonInteraction) {
	if (!interaction.inGuild()) {
		await interaction.reply({
			embeds: [error('Vote rewards can only be claimed inside a server.')],
			flags: 'Ephemeral',
		})
		return
	}

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await interaction.reply({
			embeds: [error('You need the Manage Server permission to do that.')],
			flags: 'Ephemeral',
		})
		return
	}

	await queries.linkVote(interaction.user.id, interaction.guildId)

	await interaction.reply({
		embeds: [
			new EmbedBuilder()
				.setDescription(
					"Linked! Every time you vote on top.gg from now on, **this server** gets temporary donator perks for 24 hours. If you haven't voted in the last 12 hours, vote now to activate them right away.",
				)
				.setColor(0xff3366),
		],
		flags: 'Ephemeral',
	})
}

export const voteCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Vote for the bot on top.gg')
		.setContexts(ANYWHERE_CONTEXTS)
		.setIntegrationTypes(ANYWHERE_INTEGRATION_TYPES),
	meta: {
		name: 'vote',
		description: 'Vote for the bot on top.gg',
		category: 'general',
		cooldownSeconds: 5,
	},
	async execute(interaction) {
		const topggUrl = `https://top.gg/bot/${interaction.client.user.id}/vote`

		const embed = new EmbedBuilder()
			.setTitle('Vote for Modrinth Scout')
			.setDescription(
				'Enjoying the bot? Vote for it on top.gg to help more people discover it. You can vote once every 12 hours.' +
					(usesVoteRewards && interaction.inGuild()
						? '\n\nLink your votes to this server below to give it temporary **donator perks** for 24 hours after each vote.'
						: ''),
			)
			.setColor(0xff3366)

		const voteButton = new ButtonBuilder()
			.setLabel('Vote on top.gg')
			.setURL(topggUrl)
			.setStyle(ButtonStyle.Link)
		if (emojiRefs['topgg']) voteButton.setEmoji(emojiRefs['topgg'])

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton)
		if (usesVoteRewards && interaction.inGuild()) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(VOTE_CLAIM_BUTTON_ID)
					.setLabel('Link to this server')
					.setEmoji('🔗')
					.setStyle(ButtonStyle.Secondary),
			)
		}

		await interaction.reply({ embeds: [embed], components: [row] })
	},
}
