import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

import { modrinth } from '../api/modrinth.js'
import { MAX_TRACKED_PER_GUILD, MAX_TRACKED_SUPPORTER, queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { respondWithProjectSearch } from '../utils/autocomplete.js'
import { error, success } from '../utils/embeds/index.js'
import { logger } from '../utils/logger.js'
import { parseModrinthUrl } from '../utils/url.js'

const RELEASE_TYPE_CHOICES = [
	{ name: 'Release', value: 'release' },
	{ name: 'Beta', value: 'beta' },
	{ name: 'Alpha', value: 'alpha' },
	{ name: 'Release & Beta', value: 'release,beta' },
	{ name: 'Beta & Alpha', value: 'beta,alpha' },
	{ name: 'Release & Alpha', value: 'release,alpha' },
] as const

function parseReleaseType(value: string): string[] {
	return value === 'all' ? ['release', 'beta', 'alpha'] : value.split(',')
}

function formatReleaseTypeLabel(releaseTypes: string[]): string {
	if (releaseTypes.length === 3) return 'all releases'
	if (releaseTypes.length === 1) return `${releaseTypes[0]} releases`
	const [last, ...restReversed] = [...releaseTypes].reverse()
	const rest = restReversed.reverse()
	return `${rest.join(' and ')} and ${last} releases`
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
						.setName('release_type')
						.setDescription('Which release channels to receive notifications for')
						.addChoices(...RELEASE_TYPE_CHOICES)
						.setRequired(false),
				)
				.addChannelOption((opt) =>
					opt
						.setName('channel')
						.setDescription(
							'Post updates for this project to a specific channel (overrides server default)',
						)
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(false),
				)
				.addRoleOption((opt) =>
					opt
						.setName('role')
						.setDescription('Ping a specific role for this project (overrides server default)')
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
				embeds: [success(`Notifications will be posted in <#${channel.id}>.\n${roleNote}`)],
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'add') {
			const config = await queries.getServerConfig(guildId)
			if (!config?.channelId) {
				await interaction.reply({
					embeds: [error('Set a notification channel first with `/tracking setup`.')],
					flags: 'Ephemeral',
				})
				return
			}

			const count = await queries.countTrackedProjects(guildId)
			const limit = config.isSupporter ? MAX_TRACKED_SUPPORTER : MAX_TRACKED_PER_GUILD
			if (count >= limit) {
				await interaction.reply({
					embeds: [
						error(
							`This server is already tracking the maximum of **${limit}** projects.${
								!config.isSupporter
									? `\n\nSupport the bot on Ko-fi using \`/support info\` to track up to **${MAX_TRACKED_SUPPORTER}** projects.`
									: ''
							}`,
						),
					],
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
				await interaction.editReply({ embeds: [error(`No project found for \`${input}\`.`)] })
				return
			}

			const existing = await queries.getTrackedProjects(guildId)
			if (existing.some((p) => p.projectId === project.id)) {
				await interaction.editReply({
					embeds: [error(`**${project.name}** is already being tracked.`)],
				})
				return
			}

			const releaseTypeInput = interaction.options.getString('release_type') ?? 'all'
			const releaseType = parseReleaseType(releaseTypeInput)
			const channelOverride = interaction.options.getChannel('channel')
			const roleOverride = interaction.options.getRole('role')

			await queries.addTrackedProject(
				guildId,
				project.id,
				project.slug,
				project.name,
				project.updated,
				interaction.user.id,
				releaseType,
				channelOverride?.id ?? null,
				roleOverride?.id ?? null,
			)
			log.info(
				{ guildId, projectId: project.id, slug: project.slug, userId: interaction.user.id },
				'Project tracked',
			)

			const targetChannelId = channelOverride?.id ?? config.channelId
			const targetRoleId = roleOverride?.id ?? config.roleId
			const releaseTypeLabel =
				releaseTypeInput === 'all' ? '' : ` (${formatReleaseTypeLabel(releaseType)})`
			const details = [`Notifications will go to <#${targetChannelId}>.`]
			if (targetRoleId) {
				details.push(`<@&${targetRoleId}> will be pinged.`)
			}

			await interaction.editReply({
				embeds: [
					success(
						`Now tracking **[${project.name}](https://modrinth.com/project/${project.slug})**${releaseTypeLabel}.\n${details.join('\n')}`,
					),
				],
			})
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
					embeds: [error(`\`${input}\` is not being tracked in this server.`)],
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
				embeds: [success(`Stopped tracking **${entry.name}**.`)],
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
				await interaction.reply({
					embeds: [success('No projects are being tracked.\nUse `/tracking add` to start.')],
					flags: 'Ephemeral',
				})
				return
			}

			const projectList = tracked
				.map((p) => {
					const types = p.releaseType ?? ['release', 'beta', 'alpha']
					const details = []
					if (types.length !== 3) {
						details.push(formatReleaseTypeLabel(types))
					}
					if (p.channelId) {
						details.push(`to <#${p.channelId}>`)
					}
					if (p.roleId) {
						details.push(`pinging <@&${p.roleId}>`)
					}
					const detailsLabel = details.length > 0 ? ` (${details.join(', ')})` : ''
					return `• [${p.name}](https://modrinth.com/project/${p.slug})${detailsLabel}`
				})
				.join('\n')

			const defaultConfigValue = [
				`Notifications are posted in <#${config?.channelId}>.`,
				...(config?.roleId ? [`<@&${config?.roleId}> is pinged by default.`] : []),
			].join('\n')

			const embed = new EmbedBuilder()
				.setTitle(`Tracked Projects · ${tracked.length} / ${limit}`)
				.setDescription(config?.paused ? `⏸ Tracking is paused.\n\n${projectList}` : projectList)
				.addFields({ name: 'Default configuration', value: defaultConfigValue })
				.setColor(0x1bd96a)

			await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
			return
		}

		if (sub === 'pause') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					embeds: [error('Tracking is not set up in this server.')],
					flags: 'Ephemeral',
				})
				return
			}
			if (config.paused) {
				await interaction.reply({
					embeds: [error('Tracking is already paused.')],
					flags: 'Ephemeral',
				})
				return
			}
			await queries.pauseTracking(guildId)
			log.info({ guildId, userId: interaction.user.id }, 'Tracking paused')
			await interaction.reply({
				embeds: [success('Tracking paused. Use `/tracking resume` to resume tracking.')],
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'resume') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					embeds: [error('Tracking is not set up in this server.')],
					flags: 'Ephemeral',
				})
				return
			}
			if (!config.paused) {
				await interaction.reply({
					embeds: [error('Tracking is already active.')],
					flags: 'Ephemeral',
				})
				return
			}
			await queries.resumeTracking(guildId)
			log.info({ guildId, userId: interaction.user.id }, 'Tracking resumed')
			await interaction.reply({
				embeds: [success('Tracking resumed.')],
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'disable') {
			const config = await queries.getServerConfig(guildId)
			if (!config) {
				await interaction.reply({
					embeds: [error('Tracking is not set up in this server.')],
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
				embeds: [success('All tracked projects and configuration have been removed.')],
				flags: 'Ephemeral',
			})
		}
	},
}
