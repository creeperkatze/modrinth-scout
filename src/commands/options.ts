import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	EmbedBuilder,
	InteractionContextType,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'

import { aiSummariesEnabled } from '../config/ai.js'
import { queries } from '../db/queries.js'
import type { Server } from '../db/schemas/server.js'
import type { ChatInputCommand } from '../types/index.js'
import { error } from '../utils/embeds/index.js'
import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('options')

export const OPTIONS_BUTTON_PREFIX = 'options:'

type ServerConfig = Pick<Server, 'autoEmbedsEnabled' | 'changelogSummariesEnabled'> | null

type Toggle = {
	id: string
	label: string
	description: string
	isEnabled: (config: ServerConfig) => boolean
	setEnabled: (guildId: string, enabled: boolean) => Promise<unknown>
	available?: boolean
}

const TOGGLES: Toggle[] = [
	{
		id: 'autoembeds',
		label: 'Auto Embeds',
		description: 'Replace plain Modrinth links posted in chat with rich embeds.',
		isEnabled: (config) => Boolean(config?.autoEmbedsEnabled),
		setEnabled: (guildId, enabled) => queries.setAutoEmbeds(guildId, enabled),
	},
	{
		id: 'changelog-summaries',
		label: 'AI Changelog Summaries',
		description: 'Add a short AI-generated summary above changelogs in tracking notifications.',
		isEnabled: (config) => Boolean(config?.changelogSummariesEnabled),
		setEnabled: (guildId, enabled) => queries.setChangelogSummaries(guildId, enabled),
		available: aiSummariesEnabled,
	},
]

function availableToggles() {
	return TOGGLES.filter((t) => t.available !== false)
}

function buildOptionsPayload(config: ServerConfig) {
	const toggles = availableToggles()
	const embed = new EmbedBuilder()
		.setTitle('Options')
		.setColor(0x1bd96a)
		.setDescription(
			toggles
				.map((t) => `${t.isEnabled(config) ? '✅' : '❌'} **${t.label}** · ${t.description}`)
				.join('\n\n'),
		)

	const buttons = toggles.map((t) => {
		const enabled = t.isEnabled(config)
		return new ButtonBuilder()
			.setCustomId(`${OPTIONS_BUTTON_PREFIX}${t.id}`)
			.setLabel(t.label)
			.setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
	})

	return {
		embeds: [embed],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
	}
}

export async function handleOptionsButton(interaction: ButtonInteraction) {
	if (!interaction.inGuild()) return

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await interaction.reply({
			embeds: [error('You need the Manage Server permission to do that.')],
			flags: 'Ephemeral',
		})
		return
	}

	const id = interaction.customId.slice(OPTIONS_BUTTON_PREFIX.length)
	const toggle = availableToggles().find((t) => t.id === id)
	if (!toggle) return

	const guildId = interaction.guildId
	const config = await queries.getServerConfig(guildId)
	const enabled = !toggle.isEnabled(config)

	await toggle.setEnabled(guildId, enabled)
	log.info({ guildId, toggle: toggle.id, enabled, userId: interaction.user.id }, 'Option toggled')

	const updated = await queries.getServerConfig(guildId)
	await interaction.update(buildOptionsPayload(updated))
}

export const optionsCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('options')
		.setDescription('Manage server bot options')
		.setContexts(InteractionContextType.Guild)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
	meta: {
		name: 'options',
		description: 'Manage server bot options',
		category: 'utility',
		guildOnly: true,
		defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
	},

	async execute(interaction) {
		const guildId = interaction.guildId!
		const config = await queries.getServerConfig(guildId)
		await interaction.reply({ ...buildOptionsPayload(config), flags: 'Ephemeral' })
	},
}
