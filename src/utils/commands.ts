import {
	ActionRowBuilder,
	ButtonInteraction,
	ChannelSelectMenuInteraction,
	Collection,
	Interaction,
	ModalBuilder,
	ModalSubmitInteraction,
	PermissionsBitField,
	REST,
	RoleSelectMenuInteraction,
	Routes,
	SlashCommandBuilder,
	StringSelectMenuInteraction,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js'

import { HELP_SUPPORT_BUTTON_ID } from '../commands/help.js'
import { handleOptionsButton, OPTIONS_BUTTON_PREFIX } from '../commands/options.js'
import {
	buildSearchId,
	buildSearchPayload,
	parseSearchId,
	SEARCH_LIMIT,
} from '../commands/search.js'
import { buildSupportInfoReply } from '../commands/support.js'
import {
	handleTrackingListChannelSelect,
	handleTrackingListPageButton,
	handleTrackingListPauseButton,
	handleTrackingListRemoveButton,
	handleTrackingListRoleSelect,
	TRACKING_LIST_CHANNEL_SELECT_PREFIX,
	TRACKING_LIST_PAGE_PREFIX,
	TRACKING_LIST_PAUSE_PREFIX,
	TRACKING_LIST_REMOVE_PREFIX,
	TRACKING_LIST_ROLE_SELECT_PREFIX,
} from '../commands/tracking.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from './api/modrinth.js'
import { buildProjectCard } from './embeds/index.js'
import { createModuleLogger } from './logger.js'
import { commandDurationSeconds, commandsTotal } from './metrics.js'

const log = createModuleLogger('commands')

type CooldownKey = `${string}:${string}`

export function createCommandRegistry(
	commands: ChatInputCommand[],
	opts: { defaultCooldownSeconds?: number } = {},
) {
	const { defaultCooldownSeconds = 3 } = opts
	const map: Map<string, ChatInputCommand> = new Map(commands.map((c) => [c.meta.name, c]))
	const cooldowns = new Collection<CooldownKey, number>()

	function checkCooldown(userId: string, name: string, seconds: number) {
		const key: CooldownKey = `${userId}:${name}`
		const now = Date.now()
		const until = cooldowns.get(key)
		if (until && until > now) return Math.ceil((until - now) / 1000)
		cooldowns.set(key, now + seconds * 1000)
		return 0
	}

	async function showProjectCard(
		interaction: ButtonInteraction | StringSelectMenuInteraction,
		id: string,
	) {
		await interaction.deferReply()
		try {
			const project = await modrinthClient.labrinth.projects_v3.get(id)
			await interaction.editReply(await buildProjectCard(project))
		} catch {
			await interaction.editReply({ content: `No project found for \`${id}\`.` })
		}
	}

	async function handleButton(interaction: ButtonInteraction) {
		const { customId } = interaction

		if (customId === HELP_SUPPORT_BUTTON_ID) {
			await interaction.reply({ ...buildSupportInfoReply(), flags: 'Ephemeral' })
			return
		}

		if (customId.startsWith(OPTIONS_BUTTON_PREFIX)) {
			await handleOptionsButton(interaction)
			return
		}

		if (customId.startsWith(TRACKING_LIST_REMOVE_PREFIX)) {
			await handleTrackingListRemoveButton(interaction)
			return
		}

		if (customId.startsWith(TRACKING_LIST_PAUSE_PREFIX)) {
			await handleTrackingListPauseButton(interaction)
			return
		}

		if (customId.startsWith(TRACKING_LIST_PAGE_PREFIX)) {
			await handleTrackingListPageButton(interaction)
			return
		}

		if (customId.startsWith('search:')) {
			const { action, offset, query, type, index } = parseSearchId(customId)

			if (action === 'jump') {
				const modal = new ModalBuilder()
					.setCustomId(buildSearchId('modal', offset, query, type, index))
					.setTitle('Jump to Page')
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>().addComponents(
							new TextInputBuilder()
								.setCustomId('page')
								.setLabel('Page number')
								.setStyle(TextInputStyle.Short)
								.setRequired(true)
								.setMinLength(1)
								.setMaxLength(4),
						),
					)
				await interaction.showModal(modal)
				return
			}

			await interaction.deferUpdate()
			const payload = await buildSearchPayload(query, type, index, offset)
			if (!payload) {
				await interaction.followUp({ content: 'No results on that page.', flags: 'Ephemeral' })
				return
			}
			await interaction.editReply(payload)
			return
		}

		const colon = customId.indexOf(':')
		if (colon === -1) return
		if (customId.slice(0, colon) === 'project')
			await showProjectCard(interaction, customId.slice(colon + 1))
	}

	async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
		const value = interaction.values[0]
		const colon = value.indexOf(':')
		if (colon === -1) return
		if (value.slice(0, colon) === 'project')
			await showProjectCard(interaction, value.slice(colon + 1))
	}

	async function handleChannelSelectMenu(interaction: ChannelSelectMenuInteraction) {
		if (interaction.customId.startsWith(TRACKING_LIST_CHANNEL_SELECT_PREFIX)) {
			await handleTrackingListChannelSelect(interaction)
		}
	}

	async function handleRoleSelectMenu(interaction: RoleSelectMenuInteraction) {
		if (interaction.customId.startsWith(TRACKING_LIST_ROLE_SELECT_PREFIX)) {
			await handleTrackingListRoleSelect(interaction)
		}
	}

	async function handleModal(interaction: ModalSubmitInteraction) {
		if (!interaction.customId.startsWith('search:modal:')) return

		const { query, type, index } = parseSearchId(interaction.customId)
		const pageStr = interaction.fields.getTextInputValue('page')
		const page = parseInt(pageStr)

		if (isNaN(page) || page < 1) {
			await interaction.reply({ content: 'Please enter a valid page number.', flags: 'Ephemeral' })
			return
		}

		const offset = (page - 1) * SEARCH_LIMIT
		await interaction.deferUpdate()
		const payload = await buildSearchPayload(query, type, index, offset)
		if (!payload) {
			await interaction.followUp({ content: `Page ${page} is out of range.`, flags: 'Ephemeral' })
			return
		}
		await interaction.editReply(payload)
	}

	async function onInteractionCreate(interaction: Interaction) {
		if (interaction.isAutocomplete()) {
			const cmd = map.get(interaction.commandName)
			await cmd?.autocomplete?.(interaction)
			return
		}

		if (interaction.isButton()) {
			await handleButton(interaction)
			return
		}

		if (interaction.isStringSelectMenu()) {
			await handleSelectMenu(interaction)
			return
		}

		if (interaction.isChannelSelectMenu()) {
			await handleChannelSelectMenu(interaction)
			return
		}

		if (interaction.isRoleSelectMenu()) {
			await handleRoleSelectMenu(interaction)
			return
		}

		if (interaction.isModalSubmit()) {
			await handleModal(interaction)
			return
		}

		if (!interaction.isChatInputCommand()) return

		const cmd = map.get(interaction.commandName)
		if (!cmd) return

		if (cmd.meta.guildOnly && !interaction.inGuild()) return
		if (cmd.meta.dmOnly && interaction.inGuild()) return

		const cd = cmd.meta.cooldownSeconds ?? defaultCooldownSeconds
		if (cd > 0) {
			const remain = checkCooldown(interaction.user.id, cmd.meta.name, cd)
			if (remain > 0) {
				log.debug(
					{
						command: cmd.meta.name,
						userId: interaction.user.id,
						guildId: interaction.guildId,
						remainSeconds: remain,
					},
					'Command rate-limited',
				)
				await interaction.reply({
					content: `Please wait ${remain}s before using /${cmd.meta.name} again.`,
					flags: 'Ephemeral',
				})
				return
			}
		}

		const startedAt = Date.now()
		const context = {
			command: cmd.meta.name,
			interactionId: interaction.id,
			userId: interaction.user.id,
			guildId: interaction.guildId,
		}

		log.debug(context, 'Command started')

		try {
			await Promise.resolve(cmd.execute(interaction))
			log.info({ ...context, durationMs: Date.now() - startedAt }, 'Command completed')
			commandsTotal.inc({ command: cmd.meta.name, status: 'success' })
			commandDurationSeconds.observe({ command: cmd.meta.name }, (Date.now() - startedAt) / 1000)
		} catch (error) {
			log.error(
				{ ...context, durationMs: Date.now() - startedAt, err: error },
				'Command execution failed',
			)
			commandsTotal.inc({ command: cmd.meta.name, status: 'error' })
			commandDurationSeconds.observe({ command: cmd.meta.name }, (Date.now() - startedAt) / 1000)
			const reply = {
				content: 'There was an error while executing this command!',
				flags: 'Ephemeral' as const,
			}
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(reply)
			} else {
				await interaction.reply(reply)
			}
		}
	}

	return { onInteractionCreate }
}

export function getSlashCommandsData(commands: ChatInputCommand[]) {
	return commands.map((c) => {
		const builder = c.data as SlashCommandBuilder
		if (c.meta.defaultMemberPermissions !== undefined) {
			builder.setDefaultMemberPermissions(
				PermissionsBitField.resolve(c.meta.defaultMemberPermissions),
			)
		}
		return builder.toJSON()
	})
}

export async function deployCommands(commands: ChatInputCommand[]) {
	const { DISCORD_CLIENT_ID, DISCORD_TOKEN, DISCORD_GUILD_ID } = process.env

	if (!DISCORD_CLIENT_ID || !DISCORD_TOKEN) {
		throw new Error('Missing DISCORD_CLIENT_ID or DISCORD_TOKEN in environment')
	}

	const rest = new REST().setToken(DISCORD_TOKEN)
	const data = getSlashCommandsData(commands)
	const startedAt = Date.now()

	if (DISCORD_GUILD_ID) {
		await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
			body: data,
		})
		log.info(
			{ count: data.length, guildId: DISCORD_GUILD_ID, durationMs: Date.now() - startedAt },
			'Commands deployed in guild',
		)
	} else {
		await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: data })
		log.info(
			{ count: data.length, durationMs: Date.now() - startedAt },
			'Commands deployed globally',
		)
	}
}
