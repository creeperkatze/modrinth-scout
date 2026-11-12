import {
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ContainerBuilder,
	InteractionContextType,
	PermissionFlagsBits,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from 'discord.js'

import { queries } from '../db/queries.js'
import type { GuildConfig, GuildSetting } from '../db/schemas/guild.js'
import { isSettingEnabled } from '../db/schemas/guild.js'
import type { ChatInputCommand } from '../types/index.js'
import { error } from '../utils/embeds/index.js'
import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('settings')

export const SETTINGS_BUTTON_PREFIX = 'settings:'

type ServerConfig = Pick<GuildConfig, 'settings'> | null

type Toggle = {
	setting: GuildSetting
	label: string
	description: string
}

const TOGGLES: Toggle[] = [
	{
		setting: 'groupVersions',
		label: '📦 Group Versions',
		description:
			'Combine builds of one release for different loaders and game versions into a single tracking notification.',
	},
	{
		setting: 'autoEmbeds',
		label: '⚡ Auto Embeds',
		description: 'Replace plain Modrinth links posted in chat with rich embeds.',
	},
	{
		setting: 'jarIdentify',
		label: '🔍 File Identify',
		description: 'Identify project files posted in chat, same as the `/identify` command.',
	},
]

function isEnabled(config: ServerConfig, setting: GuildSetting): boolean {
	return isSettingEnabled(config?.settings, setting)
}

function buildSettingsPayload(config: ServerConfig) {
	const toggles = TOGGLES

	const container = new ContainerBuilder()
		.setAccentColor(0x1bd96a)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Settings'))

	toggles.forEach((toggle, i) => {
		const enabled = isEnabled(config, toggle.setting)

		const button = new ButtonBuilder()
			.setCustomId(`${SETTINGS_BUTTON_PREFIX}${toggle.setting}`)
			.setLabel(enabled ? 'Enabled' : 'Disabled')
			.setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)

		const section = new SectionBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`**${toggle.label}**\n-# ${toggle.description}`),
			)
			.setButtonAccessory(button)

		container.addSectionComponents(section)

		if (i < toggles.length - 1) {
			container.addSeparatorComponents(
				new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
			)
		}
	})

	return {
		components: [container],
		flags: ['IsComponentsV2'] as const,
	}
}

export async function handleSettingsButton(interaction: ButtonInteraction) {
	if (!interaction.inGuild()) return

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await interaction.reply({
			embeds: [error('You need the Manage Server permission to do that.')],
			flags: 'Ephemeral',
		})
		return
	}

	const setting = interaction.customId.slice(SETTINGS_BUTTON_PREFIX.length)
	const toggle = TOGGLES.find((t) => t.setting === setting)
	if (!toggle) return

	const guildId = interaction.guildId
	const config = await queries.getGuildConfig(guildId)
	const enabled = !isEnabled(config, toggle.setting)

	await queries.setSetting(guildId, toggle.setting, enabled)
	log.info(
		{ guildId, setting: toggle.setting, enabled, userId: interaction.user.id },
		'Setting toggled',
	)

	const updated = await queries.getGuildConfig(guildId)
	await interaction.update(buildSettingsPayload(updated))
}

export const settingsCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription('Manage server bot settings')
		.setContexts(InteractionContextType.Guild)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
	meta: {
		name: 'settings',
		description: 'Manage server bot settings',
		category: 'utility',
		guildOnly: true,
		defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
	},

	async execute(interaction) {
		const guildId = interaction.guildId!
		const config = await queries.getGuildConfig(guildId)
		const payload = buildSettingsPayload(config)
		await interaction.reply({ ...payload, flags: [...payload.flags, 'Ephemeral'] })
	},
}
