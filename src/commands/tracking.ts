import { ModrinthApiError } from '@modrinth/api-client'
import {
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChannelType,
	ContainerBuilder,
	EmbedBuilder,
	InteractionContextType,
	PermissionFlagsBits,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from 'discord.js'

import { usesSupporterPerks } from '../config/supporterPerks.js'
import { MAX_TRACKED_PER_GUILD, MAX_TRACKED_SUPPORTER, queries } from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { respondWithProjectSearch, respondWithTrackedProjectSearch } from '../utils/autocomplete.js'
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

export const TRACKING_LIST_REMOVE_PREFIX = 'tracking-list-remove:'

// Components V2 caps a message at 40 total components (including nested ones); each
// tracked project needs 3 (Section + TextDisplay + Button), plus a few fixed for the
// header/footer, so above this we fall back to a plain read-only list instead.
const MAX_INTERACTIVE_TRACKED = 10

function projectDetailsLabel(p: {
	releaseType?: string[] | null
	channelId?: string | null
	roleId?: string | null
}): string {
	const types = p.releaseType ?? ['release', 'beta', 'alpha']
	const details: string[] = []
	if (types.length !== 3) details.push(formatReleaseTypeLabel(types))
	if (p.channelId) details.push(`to <#${p.channelId}>`)
	if (p.roleId) details.push(`pinging <@&${p.roleId}>`)
	return details.join(', ')
}

function buildTrackingListPayload(
	tracked: Awaited<ReturnType<typeof queries.getTrackedProjects>>,
	config: Awaited<ReturnType<typeof queries.getServerConfig>>,
	limit: number,
) {
	if (tracked.length > MAX_INTERACTIVE_TRACKED) {
		const projectList = tracked
			.map((p) => {
				const detailsLabel = projectDetailsLabel(p)
				return `• [${p.name}](https://modrinth.com/project/${p.slug})${detailsLabel ? ` (${detailsLabel})` : ''}`
			})
			.join('\n')

		const defaultConfigValue = [
			`Notifications are posted in <#${config?.trackingChannelId}>.`,
			...(config?.trackingRoleId ? [`<@&${config?.trackingRoleId}> is pinged by default.`] : []),
		].join('\n')

		const embed = new EmbedBuilder()
			.setTitle('Tracked Projects')
			.setDescription(
				[
					`${tracked.length} / ${limit} tracked`,
					config?.trackingPaused ? '⏸ Tracking is paused.' : null,
					projectList,
				]
					.filter(Boolean)
					.join('\n\n'),
			)
			.addFields({ name: 'Default configuration', value: defaultConfigValue })
			.setColor(0x1bd96a)

		return { embeds: [embed], components: [], flags: [] as const }
	}

	const headerLines = ['## Tracked Projects', `-# ${tracked.length} / ${limit} tracked`]
	if (config?.trackingPaused) headerLines.push('⏸ Tracking is paused.')

	const container = new ContainerBuilder()
		.setAccentColor(0x1bd96a)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join('\n')))

	if (tracked.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'No projects are being tracked.\nUse `/tracking add` to start.',
			),
		)
	} else {
		for (const p of tracked) {
			const detailsLabel = projectDetailsLabel(p)
			const text = [`**[${p.name}](https://modrinth.com/project/${p.slug})**`]
			if (detailsLabel) text.push(`-# ${detailsLabel}`)

			const button = new ButtonBuilder()
				.setCustomId(`${TRACKING_LIST_REMOVE_PREFIX}${p.projectId}`)
				.setLabel('Remove')
				.setStyle(ButtonStyle.Danger)

			const section = new SectionBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(text.join('\n')))
				.setButtonAccessory(button)

			container.addSectionComponents(section)
		}

		const defaultConfigLine = [
			`Notifications are posted in <#${config?.trackingChannelId}>.`,
			...(config?.trackingRoleId ? [`<@&${config?.trackingRoleId}> is pinged by default.`] : []),
		].join(' ')

		container.addSeparatorComponents(
			new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
		)
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`-# ${defaultConfigLine}`),
		)
	}

	return { embeds: [], components: [container], flags: ['IsComponentsV2'] as const }
}

export async function handleTrackingListRemoveButton(interaction: ButtonInteraction) {
	if (!interaction.inGuild()) return

	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		await interaction.reply({
			embeds: [error('You need the Manage Server permission to do that.')],
			flags: 'Ephemeral',
		})
		return
	}

	const guildId = interaction.guildId
	const projectId = interaction.customId.slice(TRACKING_LIST_REMOVE_PREFIX.length)

	const entry = await queries.findTrackedProjectById(guildId, projectId)
	if (entry) {
		await queries.removeTrackedProject(guildId, projectId)
		log.info(
			{ guildId, projectId, slug: entry.slug, userId: interaction.user.id },
			'Project untracked',
		)
	}

	const [tracked, config] = await Promise.all([
		queries.getTrackedProjects(guildId),
		queries.getServerConfig(guildId),
	])
	const limit =
		!usesSupporterPerks || Boolean(config?.isSupporter)
			? MAX_TRACKED_SUPPORTER
			: MAX_TRACKED_PER_GUILD

	await interaction.update(buildTrackingListPayload(tracked, config, limit))
}

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
		)
		.setContexts(InteractionContextType.Guild)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
	meta: {
		name: 'tracking',
		description: 'Manage project update tracking for this server',
		category: 'utility',
		guildOnly: true,
		defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
	},

	async autocomplete(interaction) {
		const sub = interaction.options.getSubcommand()

		if (sub === 'add') {
			await respondWithProjectSearch(interaction)
			return
		}

		if (sub === 'remove') {
			await respondWithTrackedProjectSearch(interaction)
		}
	},

	async execute(interaction) {
		const sub = interaction.options.getSubcommand()
		const guildId = interaction.guildId!

		if (sub === 'setup') {
			const channel = interaction.options.getChannel('channel', true)
			const role = interaction.options.getRole('role')
			const trackingChannelId = channel.id
			const trackingRoleId = role?.id ?? null

			await queries.setServerConfig(guildId, trackingChannelId, trackingRoleId)
			log.info(
				{ guildId, trackingChannelId, trackingRoleId, userId: interaction.user.id },
				'Tracking channel configured',
			)
			const roleNote = role ? ` ${role} will be pinged on each update.` : ''
			await interaction.reply({
				embeds: [success(`Notifications will be posted in <#${trackingChannelId}>.\n${roleNote}`)],
				flags: 'Ephemeral',
			})
			return
		}

		if (sub === 'add') {
			const config = await queries.getServerConfig(guildId)
			if (!config?.trackingChannelId) {
				await interaction.reply({
					embeds: [error('Set a notification channel first with `/tracking setup`.')],
					flags: 'Ephemeral',
				})
				return
			}

			const count = await queries.countTrackedProjects(guildId)
			const hasPerks = !usesSupporterPerks || Boolean(config.isSupporter)
			const limit = hasPerks ? MAX_TRACKED_SUPPORTER : MAX_TRACKED_PER_GUILD
			if (count >= limit) {
				await interaction.reply({
					embeds: [
						error(
							`This server is already tracking the maximum of **${limit}** projects.${
								usesSupporterPerks && !hasPerks
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
				project = await modrinthClient.labrinth.projects_v3.get(input)
			} catch (err) {
				const notFound = err instanceof ModrinthApiError && err.statusCode === 404
				const message = notFound
					? `No project found for \`${input}\`.`
					: err instanceof Error
						? err.message
						: String(err)
				await interaction.editReply({ embeds: [error(message)] })
				return
			}

			const existing = await queries.findTrackedProjectById(guildId, project.id)
			if (existing) {
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
				project.slug ?? project.id,
				project.name,
				new Date(project.updated),
				releaseType,
				channelOverride?.id ?? null,
				roleOverride?.id ?? null,
			)
			log.info(
				{ guildId, projectId: project.id, slug: project.slug, userId: interaction.user.id },
				'Project tracked',
			)

			const releaseTypeLabel =
				releaseTypeInput === 'all' ? '' : ` (${formatReleaseTypeLabel(releaseType)})`
			const details = []
			if (channelOverride) {
				details.push(`Notifications will go to <#${channelOverride.id}>.`)
			}
			if (roleOverride) {
				details.push(`<@&${roleOverride.id}> will be pinged.`)
			}

			await interaction.editReply({
				embeds: [
					success(
						`Now tracking **[${project.name}](https://modrinth.com/project/${project.slug})**${releaseTypeLabel}.${details.length > 0 ? `\n${details.join('\n')}` : ''}`,
					),
				],
			})
			return
		}

		if (sub === 'remove') {
			const raw = interaction.options.getString('query', true).trim()
			const parsed = parseModrinthUrl(raw)
			const query = parsed?.type === 'project' ? parsed.slug : raw

			let projectId: string
			try {
				projectId = (await modrinthClient.labrinth.projects_v3.get(query)).id
			} catch (err) {
				const notFound = err instanceof ModrinthApiError && err.statusCode === 404
				if (parsed?.type === 'project' || !notFound) {
					const message = notFound
						? `No project found for \`${query}\`.`
						: err instanceof Error
							? err.message
							: String(err)
					await interaction.reply({ embeds: [error(message)], flags: 'Ephemeral' })
					return
				}
				// Not a URL and Modrinth doesn't recognize it (e.g. the project was deleted) —
				// fall back to treating the input itself as the tracked project ID.
				projectId = raw
			}

			const entry = await queries.findTrackedProjectById(guildId, projectId)

			if (!entry) {
				await interaction.reply({
					embeds: [error(`\`${raw}\` is not being tracked in this server.`)],
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

			const limit =
				!usesSupporterPerks || Boolean(config?.isSupporter)
					? MAX_TRACKED_SUPPORTER
					: MAX_TRACKED_PER_GUILD

			const payload = buildTrackingListPayload(tracked, config, limit)
			await interaction.reply({ ...payload, flags: [...payload.flags, 'Ephemeral'] })
			return
		}

		if (sub === 'pause') {
			const config = await queries.getServerConfig(guildId)
			if (!config?.trackingChannelId) {
				await interaction.reply({
					embeds: [error('Tracking is not set up in this server.')],
					flags: 'Ephemeral',
				})
				return
			}
			if (config.trackingPaused) {
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
			if (!config?.trackingChannelId) {
				await interaction.reply({
					embeds: [error('Tracking is not set up in this server.')],
					flags: 'Ephemeral',
				})
				return
			}
			if (!config.trackingPaused) {
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
			if (!config?.trackingChannelId) {
				await interaction.reply({
					embeds: [error('Tracking is not set up in this server.')],
					flags: 'Ephemeral',
				})
				return
			}
			await Promise.all([
				queries.removeAllTrackedProjects(guildId),
				queries.clearTrackingConfig(guildId),
			])
			log.info({ guildId, userId: interaction.user.id }, 'Tracking disabled')
			await interaction.reply({
				embeds: [success('All tracked projects and configuration have been removed.')],
				flags: 'Ephemeral',
			})
		}
	},
}
