import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { MAX_TRACKED_PER_GUILD, MAX_TRACKED_SUPPORTER, queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { respondWithProjectSearch } from '../utils/autocomplete.js'
import { logger } from '../utils/logger.js'
import { parseModrinthUrl } from '../utils/url.js'

const VERSION_CHANNEL_CHOICES = [
	{ name: 'Release', value: 'release' },
	{ name: 'Beta', value: 'beta' },
	{ name: 'Alpha', value: 'alpha' },
	{ name: 'Release & Beta', value: 'release,beta' },
	{ name: 'Beta & Alpha', value: 'beta,alpha' },
	{ name: 'Release & Alpha', value: 'release,alpha' },
] as const

function parseVersionChannels(value: string): string[] {
	return value === 'all' ? ['release', 'beta', 'alpha'] : value.split(',')
}

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
						.setName('query')
						.setDescription('Project name, slug, ID, or URL')
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addStringOption((opt) =>
					opt
						.setName('channels')
						.setDescription('Which release channels to receive notifications for')
						.addChoices(...VERSION_CHANNEL_CHOICES)
						.setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('remove')
				.setDescription('Stop tracking a project')
				.addStringOption((opt) =>
					opt
						.setName('query')
						.setDescription('Project name, slug, ID, or URL')
						.setRequired(true)
						.setAutocomplete(true),
				),
		)
		.addSubcommand((sub) =>
			sub.setName('list').setDescription('Show all projects tracked in this server'),
		)
		.addSubcommand((sub) =>
			sub
				.setName('pause')
				.setDescription('Pause tracking notifications without removing tracked projects'),
		)
		.addSubcommand((sub) =>
			sub.setName('resume').setDescription('Resume tracking notifications for this server'),
		)
		.addSubcommand((sub) =>
			sub.setName('disable').setDescription('Disable tracking and remove all tracked projects'),
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
			if (!config?.channelId) {
				await interaction.reply({
					content: 'Set a notification channel first with `/tracking setup`.',
					flags: 'Ephemeral',
				})
				return
			}

			const count = await queries.countTrackedProjects(guildId)
			const limit = config.isSupporter ? MAX_TRACKED_SUPPORTER : MAX_TRACKED_PER_GUILD
			if (count >= limit) {
				await interaction.reply({
					content: `This server is already tracking the maximum of ${limit} projects.${!config.isSupporter ? ' Support the bot on Ko-fi with `/support` to unlock a higher limit.' : ''}`,
					flags: 'Ephemeral',
				})
				return
			}

			await interaction.deferReply({ flags: 'Ephemeral' })

			const raw = interaction.options.getString('query', true).trim()
			const parsed = parseModrinthUrl(raw)
			const input = parsed?.type === 'project' ? parsed.slug : raw

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

			const channelsInput = interaction.options.getString('channels') ?? 'all'
			const versionTypes = parseVersionChannels(channelsInput)

			await queries.addTrackedProject(
				guildId,
				project.id,
				project.slug,
				project.name,
				project.updated,
				interaction.user.id,
				versionTypes,
			)
			log.info(
				{ guildId, projectId: project.id, slug: project.slug, userId: interaction.user.id },
				'Project tracked',
			)

			const channelsNote = channelsInput !== 'all' ? ` (${versionTypes.join(', ')} only)` : ''
			await interaction.editReply(
				`Now tracking **${project.name}**${channelsNote}. Notifications will go to <#${config.channelId}>.`,
			)
			return
		}

		if (sub === 'remove') {
			const raw = interaction.options.getString('query', true).trim()
			const parsed = parseModrinthUrl(raw)
			const input = parsed?.type === 'project' ? parsed.slug : raw
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

			const limit = config?.isSupporter ? MAX_TRACKED_SUPPORTER : MAX_TRACKED_PER_GUILD

			if (tracked.length === 0) {
				const embed = new EmbedBuilder()
					.setDescription('No projects are being tracked. Use `/tracking add` to start.')
					.setColor(0x1bd96a)
				await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
				return
			}

			const projectList = tracked
				.map((p) => {
					const types = p.versionChannels ?? ['release', 'beta', 'alpha']
					const label = types.length === 3 ? '' : ` · *${types.join(', ')}*`
					return `• [${p.name}](https://modrinth.com/project/${p.slug})${label}`
				})
				.join('\n')

			const notifValue = config?.channelId
				? `<#${config.channelId}>${config.roleId ? ` · <@&${config.roleId}>` : ''}`
				: 'Not configured — use `/tracking setup`'

			const embed = new EmbedBuilder()
				.setTitle(`Tracked Projects — ${tracked.length} / ${limit}`)
				.setDescription(config?.paused ? `⏸ Tracking is paused.\n\n${projectList}` : projectList)
				.addFields({ name: 'Notifications', value: notifValue })
				.setColor(0x1bd96a)

			await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
			return
		}

		if (sub === 'pause') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					content: 'Tracking is not set up in this server.',
					flags: 'Ephemeral',
				})
				return
			}
			if (config.paused) {
				await interaction.reply({ content: 'Tracking is already paused.', flags: 'Ephemeral' })
				return
			}
			await queries.pauseTracking(guildId)
			log.info({ guildId, userId: interaction.user.id }, 'Tracking paused')
			await interaction.reply({
				content: 'Tracking paused. Your projects are preserved — use `/tracking resume` to resume.',
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'resume') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					content: 'Tracking is not set up in this server.',
					flags: 'Ephemeral',
				})
				return
			}
			if (!config.paused) {
				await interaction.reply({ content: 'Tracking is already active.', flags: 'Ephemeral' })
				return
			}
			await queries.resumeTracking(guildId)
			log.info({ guildId, userId: interaction.user.id }, 'Tracking resumed')
			await interaction.reply({
				content: config.channelId
					? `Tracking resumed. Notifications will go to <#${config.channelId}>.`
					: 'Tracking resumed.',
				flags: 'Ephemeral',
			})
			return
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
			log.info({ guildId, userId: interaction.user.id }, 'Tracking reset')
			await interaction.reply({
				content: 'All tracked projects and configuration have been removed.',
				flags: 'Ephemeral',
			})
		}
	},
}
