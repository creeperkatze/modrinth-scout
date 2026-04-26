import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { MAX_TRACKED_PER_GUILD, queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { respondWithProjectSearch } from '../utils/autocomplete.js'
import { logger } from '../utils/logger.js'

const log = logger.child({ module: 'tracking' })

export const trackingCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('tracking')
		.setDescription('Manage project update tracking for this server')
		.addSubcommand((sub) =>
			sub
				.setName('setup')
				.setDescription('Set the channel where update notifications will be posted')
				.addChannelOption((opt) =>
					opt
						.setName('channel')
						.setDescription('The channel to post notifications in')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				)
				.addRoleOption((opt) =>
					opt
						.setName('role')
						.setDescription('Role to ping when an update is posted (leave empty to clear)')
						.setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('add')
				.setDescription('Start tracking a Modrinth project')
				.addStringOption((opt) =>
					opt
						.setName('project')
						.setDescription('Project name, slug, or ID')
						.setRequired(true)
						.setAutocomplete(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('remove')
				.setDescription('Stop tracking a project')
				.addStringOption((opt) =>
					opt
						.setName('project')
						.setDescription('Project slug or ID')
						.setRequired(true)
						.setAutocomplete(true),
				),
		)
		.addSubcommand((sub) =>
			sub.setName('list').setDescription('Show all projects tracked in this server'),
		)
		.addSubcommand((sub) =>
			sub
				.setName('disable')
				.setDescription('Disable tracking and remove all tracked projects for this server'),
		),
	meta: {
		name: 'tracking',
		description: 'Manage project update tracking for this server',
		category: 'utility',
		guildOnly: true,
		defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
	},

	async autocomplete(interaction) {
		const sub = interaction.options.getSubcommand()
		const focused = interaction.options.getFocused()

		if (sub === 'add') {
			await respondWithProjectSearch(interaction)
			return
		}

		if (sub === 'remove') {
			const guildId = interaction.guildId!
			const tracked = await queries.getTrackedProjects(guildId)
			const choices = tracked
				.filter(
					(p) => p.slug.includes(focused) || p.name.toLowerCase().includes(focused.toLowerCase()),
				)
				.slice(0, 25)
				.map((p) => ({ name: p.name, value: p.slug }))
			await interaction.respond(choices)
		}
	},

	async execute(interaction) {
		const sub = interaction.options.getSubcommand()
		const guildId = interaction.guildId!

		if (sub === 'setup') {
			const channel = interaction.options.getChannel('channel', true)
			const role = interaction.options.getRole('role')
			await queries.setServerConfig(guildId, channel.id, interaction.user.id, role?.id)
			log.info(
				{ guildId, channelId: channel.id, roleId: role?.id, userId: interaction.user.id },
				'Tracking channel configured',
			)
			const roleNote = role ? ` ${role} will be pinged on each update.` : ''
			await interaction.reply({
				content: `Update notifications will be posted in <#${channel.id}>.${roleNote}`,
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'add') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					content: 'Set a notification channel first with `/tracking setup`.',
					flags: 'Ephemeral',
				})
				return
			}

			const count = await queries.countTrackedProjects(guildId)
			if (count >= MAX_TRACKED_PER_GUILD) {
				await interaction.reply({
					content: `This server is already tracking the maximum of ${MAX_TRACKED_PER_GUILD} projects.`,
					flags: 'Ephemeral',
				})
				return
			}

			await interaction.deferReply({ flags: 'Ephemeral' })

			const input = interaction.options.getString('project', true).trim()
			let project
			try {
				project = await modrinth.getProject(input)
			} catch {
				await interaction.editReply(`No project found for \`${input}\`.`)
				return
			}

			const existing = await queries.getTrackedProjects(guildId)
			if (existing.some((p) => p.projectId === project.id)) {
				await interaction.editReply(`**${project.name}** is already being tracked.`)
				return
			}

			await queries.addTrackedProject(
				guildId,
				project.id,
				project.slug,
				project.name,
				project.updated,
				interaction.user.id,
			)
			log.info(
				{ guildId, projectId: project.id, slug: project.slug, userId: interaction.user.id },
				'Project tracked',
			)

			await interaction.editReply(
				`Now tracking **${project.name}**. Notifications will go to <#${config.channelId}>.`,
			)
			return
		}

		if (sub === 'remove') {
			const input = interaction.options.getString('project', true).trim()
			const tracked = await queries.getTrackedProjects(guildId)
			const entry = tracked.find((p) => p.slug === input || p.projectId === input)

			if (!entry) {
				await interaction.reply({
					content: `\`${input}\` is not being tracked in this server.`,
					flags: 'Ephemeral',
				})
				return
			}

			await queries.removeTrackedProject(guildId, entry.projectId)
			log.info(
				{ guildId, projectId: entry.projectId, slug: entry.slug, userId: interaction.user.id },
				'Project untracked',
			)
			await interaction.reply({
				content: `Stopped tracking **${entry.name}**.`,
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'list') {
			const [tracked, config] = await Promise.all([
				queries.getTrackedProjects(guildId),
				queries.getServerConfig(guildId),
			])

			if (tracked.length === 0) {
				await interaction.reply({
					content: 'No projects are being tracked in this server. Use `/tracking add` to start.',
					flags: 'Ephemeral',
				})
				return
			}

			const list = tracked
				.map((p) => `• [${p.name}](https://modrinth.com/project/${p.slug})`)
				.join('\n')

			const channelLine = config
				? `\nNotifications → <#${config.channelId}>${config.roleId ? ` · pings <@&${config.roleId}>` : ''}`
				: ''

			await interaction.reply({
				content: `**Tracked projects (${tracked.length}/${MAX_TRACKED_PER_GUILD})**\n${list}${channelLine}`,
				flags: 'Ephemeral',
			})
		}

		if (sub === 'disable') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					content: 'Tracking is not set up in this server.',
					flags: 'Ephemeral',
				})
				return
			}

			await Promise.all([
				queries.removeAllTrackedProjects(guildId),
				queries.removeServerConfig(guildId),
			])
			log.info({ guildId, userId: interaction.user.id }, 'Tracking disabled')
			await interaction.reply({
				content: 'Tracking has been disabled and all tracked projects have been removed.',
				flags: 'Ephemeral',
			})
		}
	},
}
