import type { Labrinth } from '@modrinth/api-client'
import { ModrinthApiError } from '@modrinth/api-client'
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChannelSelectMenuBuilder,
	ChannelSelectMenuInteraction,
	ChannelType,
	ChatInputCommandInteraction,
	ContainerBuilder,
	InteractionContextType,
	PermissionFlagsBits,
	RoleSelectMenuBuilder,
	RoleSelectMenuInteraction,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from 'discord.js'

import { usesDonatorPerks } from '../config/donatorPerks.js'
import {
	MAX_TRACKED,
	MAX_TRACKED_AUTHORS,
	MAX_TRACKED_AUTHORS_SUPPORTER,
	MAX_TRACKED_SUPPORTER,
	queries,
} from '../db/queries.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import {
	respondWithProjectSearch,
	respondWithTrackedAuthorSearch,
	respondWithTrackedProjectSearch,
} from '../utils/autocomplete.js'
import { error, success } from '../utils/embeds/index.js'
import { emojis } from '../utils/emojis.js'
import { logger } from '../utils/logger.js'
import { fetchAuthorProjects } from '../utils/tracking/author.js'
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
export const TRACKING_LIST_AUTHOR_REMOVE_PREFIX = 'tracking-list-author-remove:'
export const TRACKING_LIST_PAUSE_PREFIX = 'tracking-list-pause:'
export const TRACKING_LIST_CHANNEL_SELECT_PREFIX = 'tracking-list-channel:'
export const TRACKING_LIST_ROLE_SELECT_PREFIX = 'tracking-list-role:'
export const TRACKING_LIST_PAGE_PREFIX = 'tracking-list-page:'
export const TRACKING_LIST_AUTHOR_PAGE_PREFIX = 'tracking-list-author-page:'

// Components V2 caps messages at 40 total components. Projects and Authors each get their own
// Prev/Next row, so these page sizes (worst case: both sections full + both pagination rows) stay
// under the cap.
const PAGE_SIZE = 4
const AUTHOR_PAGE_SIZE = 2

function parsePage(value: string | undefined): number {
	const page = parseInt(value ?? '', 10)
	return Number.isFinite(page) && page >= 0 ? page : 0
}

// Every control in the combined list carries both the project page and the author page so the other
// section's scroll position survives a refresh, e.g. "2:0" or "2:0:some-project-id" for item buttons.
function encodePageState(projectPage: number, authorPage: number): string {
	return `${projectPage}:${authorPage}`
}

function parsePageState(rest: string): { projectPage: number; authorPage: number; id: string } {
	const [projectPageStr, authorPageStr, ...idParts] = rest.split(':')
	return {
		projectPage: parsePage(projectPageStr),
		authorPage: parsePage(authorPageStr),
		id: idParts.join(':'),
	}
}

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

async function fetchProjectsById(
	ids: string[],
): Promise<Map<string, Labrinth.Projects.v3.Project>> {
	if (ids.length === 0) return new Map()
	try {
		const projects = await modrinthClient.labrinth.projects_v3.getMultiple(ids)
		return new Map(projects.map((project) => [project.id, project]))
	} catch (err) {
		log.warn({ err }, 'Failed to fetch tracked project details')
		return new Map()
	}
}

type TrackedProjectDoc = { projectId: string; name: string; slug: string } & Parameters<
	typeof projectDetailsLabel
>[0]

function buildProjectHeaderText(
	p: TrackedProjectDoc,
	full: Labrinth.Projects.v3.Project | undefined,
): string {
	const typeEmoji = full ? emojis[full.project_types[0] ?? 'project'] : undefined
	const lines = [
		`**${typeEmoji ? `${typeEmoji} ` : ''}[${p.name}](https://modrinth.com/project/${p.slug})**`,
	]

	if (full) {
		const downloads = full.downloads.toLocaleString('en-US', {
			notation: 'compact',
			maximumFractionDigits: 1,
		})
		const followers = full.followers.toLocaleString('en-US', {
			notation: 'compact',
			maximumFractionDigits: 1,
		})
		const rawLoaders = full.loaders ?? []
		const loaders = rawLoaders.filter((l) => l !== 'minecraft' || rawLoaders.length === 1)
		const loaderEmojis = loaders
			.map((l) => emojis[l])
			.filter(Boolean)
			.join(' ')
		const stats = [
			`${emojis['downloads'] ?? '↓'} ${downloads}`,
			`${emojis['follows'] ?? '♡'} ${followers}`,
			loaderEmojis,
		].filter(Boolean)
		lines.push(`-# ${stats.join(' · ')}`)
	}

	return lines.join('\n')
}

async function buildTrackingListPayload(
	guildId: string,
	tracked: Awaited<ReturnType<typeof queries.getManuallyTrackedProjects>>,
	trackedAuthors: Awaited<ReturnType<typeof queries.getTrackedAuthors>>,
	config: Awaited<ReturnType<typeof queries.getServerConfig>>,
	limit: number,
	authorLimit: number,
	requestedProjectPage = 0,
	requestedAuthorPage = 0,
) {
	const projectTotalPages = Math.max(1, Math.ceil(tracked.length / PAGE_SIZE))
	const authorTotalPages = Math.max(1, Math.ceil(trackedAuthors.length / AUTHOR_PAGE_SIZE))
	const projectPage = Math.min(Math.max(requestedProjectPage, 0), projectTotalPages - 1)
	const authorPage = Math.min(Math.max(requestedAuthorPage, 0), authorTotalPages - 1)
	const pageState = encodePageState(projectPage, authorPage)
	const pageItems = tracked.slice(projectPage * PAGE_SIZE, projectPage * PAGE_SIZE + PAGE_SIZE)
	const authorPageItems = trackedAuthors.slice(
		authorPage * AUTHOR_PAGE_SIZE,
		authorPage * AUTHOR_PAGE_SIZE + AUTHOR_PAGE_SIZE,
	)

	const container = new ContainerBuilder()
		.setAccentColor(0x1bd96a)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Tracking'))

	const paused = Boolean(config?.trackingPaused)
	const statusButton = new ButtonBuilder()
		.setCustomId(`${TRACKING_LIST_PAUSE_PREFIX}${pageState}`)
		.setLabel(paused ? 'Resume' : 'Pause')
		.setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary)
	const statusSection = new SectionBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`**Status**\n-# ${paused ? '⏸ Paused' : '▶ Active'}`),
		)
		.setButtonAccessory(statusButton)
	container.addSectionComponents(statusSection)

	const channelSelect = new ChannelSelectMenuBuilder()
		.setCustomId(`${TRACKING_LIST_CHANNEL_SELECT_PREFIX}${pageState}`)
		.setPlaceholder('Notification channel')
		.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
	if (config?.trackingChannelId) channelSelect.setDefaultChannels(config.trackingChannelId)
	container.addActionRowComponents(
		new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
	)

	const roleSelect = new RoleSelectMenuBuilder()
		.setCustomId(`${TRACKING_LIST_ROLE_SELECT_PREFIX}${pageState}`)
		.setPlaceholder('Ping role (optional)')
		.setMinValues(0)
		.setMaxValues(1)
	if (config?.trackingRoleId) roleSelect.setDefaultRoles(config.trackingRoleId)
	container.addActionRowComponents(
		new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect),
	)

	if (tracked.length > 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### Projects · ${tracked.length} / ${limit} tracked`),
		)

		const projectsById = await fetchProjectsById(pageItems.map((p) => p.projectId))

		pageItems.forEach((p, i) => {
			const full = projectsById.get(p.projectId)
			const headerText = buildProjectHeaderText(p, full)
			const detailsLabel = projectDetailsLabel(p)
			const text = detailsLabel ? `${headerText}\n-# ${detailsLabel}` : headerText

			const button = new ButtonBuilder()
				.setCustomId(`${TRACKING_LIST_REMOVE_PREFIX}${pageState}:${p.projectId}`)
				.setLabel('Remove')
				.setStyle(ButtonStyle.Danger)

			const section = new SectionBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
				.setButtonAccessory(button)
			container.addSectionComponents(section)

			if (i < pageItems.length - 1) {
				container.addSeparatorComponents(
					new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
				)
			}
		})

		if (projectTotalPages > 1) {
			const prevButton = new ButtonBuilder()
				.setCustomId(`${TRACKING_LIST_PAGE_PREFIX}${encodePageState(projectPage - 1, authorPage)}`)
				.setLabel('◀ Prev')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(projectPage === 0)
			const nextButton = new ButtonBuilder()
				.setCustomId(`${TRACKING_LIST_PAGE_PREFIX}${encodePageState(projectPage + 1, authorPage)}`)
				.setLabel('Next ▶')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(projectPage >= projectTotalPages - 1)
			container.addActionRowComponents(
				new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton),
			)
		}
	}

	if (trackedAuthors.length > 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`### Authors · ${trackedAuthors.length} / ${authorLimit} tracked`,
			),
		)

		const projectCountsByAuthor = await queries.getTrackedProjectCountsByAuthors(
			guildId,
			authorPageItems.map((a) => a.authorId),
		)

		authorPageItems.forEach((a, i) => {
			const headerText = buildAuthorHeaderText(a, projectCountsByAuthor.get(a.authorId) ?? 0)
			const detailsLabel = authorDetailsLabel(a)
			const text = detailsLabel ? `${headerText}\n-# ${detailsLabel}` : headerText

			const button = new ButtonBuilder()
				.setCustomId(`${TRACKING_LIST_AUTHOR_REMOVE_PREFIX}${pageState}:${a.authorId}`)
				.setLabel('Remove')
				.setStyle(ButtonStyle.Danger)

			const section = new SectionBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
				.setButtonAccessory(button)
			container.addSectionComponents(section)

			if (i < authorPageItems.length - 1) {
				container.addSeparatorComponents(
					new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
				)
			}
		})

		if (authorTotalPages > 1) {
			const prevButton = new ButtonBuilder()
				.setCustomId(
					`${TRACKING_LIST_AUTHOR_PAGE_PREFIX}${encodePageState(projectPage, authorPage - 1)}`,
				)
				.setLabel('◀ Prev')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(authorPage === 0)
			const nextButton = new ButtonBuilder()
				.setCustomId(
					`${TRACKING_LIST_AUTHOR_PAGE_PREFIX}${encodePageState(projectPage, authorPage + 1)}`,
				)
				.setLabel('Next ▶')
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(authorPage >= authorTotalPages - 1)
			container.addActionRowComponents(
				new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton),
			)
		}
	}

	if (tracked.length === 0 && trackedAuthors.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				'Nothing is being tracked yet.\nUse `/tracking add` or `/tracking author add` to start.',
			),
		)
	}

	return { components: [container], flags: ['IsComponentsV2'] as const }
}

type ResolvedAuthor = {
	type: 'user' | 'organization'
	id: string
	username: string
	name: string
}

async function resolveAuthor(raw: string): Promise<ResolvedAuthor> {
	const parsed = parseModrinthUrl(raw)

	if (parsed?.type === 'user') {
		const user = await modrinthClient.labrinth.users_v3.get(parsed.username)
		return { type: 'user', id: user.id, username: user.username, name: user.username }
	}
	if (parsed?.type === 'organization') {
		const org = await modrinthClient.labrinth.organizations_v3.get(parsed.slug)
		return { type: 'organization', id: org.id, username: org.slug, name: org.name }
	}

	// Plain text input is ambiguous between the two namespaces, so try organization first
	// (usernames and org slugs occupy separate namespaces on Modrinth, so at most one will hit).
	try {
		const org = await modrinthClient.labrinth.organizations_v3.get(raw)
		return { type: 'organization', id: org.id, username: org.slug, name: org.name }
	} catch (err) {
		if (!(err instanceof ModrinthApiError && err.statusCode === 404)) throw err
	}

	const user = await modrinthClient.labrinth.users_v3.get(raw)
	return { type: 'user', id: user.id, username: user.username, name: user.username }
}

function authorDetailsLabel(a: { channelId?: string | null; roleId?: string | null }): string {
	const details: string[] = []
	if (a.channelId) details.push(`to <#${a.channelId}>`)
	if (a.roleId) details.push(`pinging <@&${a.roleId}>`)
	return details.join(', ')
}

function buildAuthorHeaderText(
	a: Awaited<ReturnType<typeof queries.getTrackedAuthors>>[number],
	projectCount: number,
): string {
	const typeEmoji = emojis[a.authorType === 'organization' ? 'organization' : 'user']
	const url =
		a.authorType === 'organization'
			? `https://modrinth.com/organization/${a.username}`
			: `https://modrinth.com/user/${a.username}`

	return [
		`**${typeEmoji ? `${typeEmoji} ` : ''}[${a.name}](${url})**`,
		`-# ${projectCount} Project${projectCount === 1 ? '' : 's'}`,
	].join('\n')
}

type TrackingListInteraction =
	ButtonInteraction | ChannelSelectMenuInteraction | RoleSelectMenuInteraction

async function requireManageGuild(interaction: TrackingListInteraction): Promise<boolean> {
	if (!interaction.inGuild()) return false
	if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true

	await interaction.reply({
		embeds: [error('You need the Manage Server permission to do that.')],
		flags: 'Ephemeral',
	})
	return false
}

async function refreshTrackingList(
	interaction: TrackingListInteraction,
	guildId: string,
	projectPage: number,
	authorPage: number,
) {
	const [tracked, trackedAuthors, config] = await Promise.all([
		queries.getManuallyTrackedProjects(guildId),
		queries.getTrackedAuthors(guildId),
		queries.getServerConfig(guildId),
	])
	const limit =
		!usesDonatorPerks || Boolean(config?.isSupporter) ? MAX_TRACKED_SUPPORTER : MAX_TRACKED
	const authorLimit =
		!usesDonatorPerks || Boolean(config?.isSupporter)
			? MAX_TRACKED_AUTHORS_SUPPORTER
			: MAX_TRACKED_AUTHORS

	await interaction.update(
		await buildTrackingListPayload(
			guildId,
			tracked,
			trackedAuthors,
			config,
			limit,
			authorLimit,
			projectPage,
			authorPage,
		),
	)
}

export async function handleTrackingListRemoveButton(interaction: ButtonInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const {
		projectPage,
		authorPage,
		id: projectId,
	} = parsePageState(interaction.customId.slice(TRACKING_LIST_REMOVE_PREFIX.length))

	const entry = await queries.findTrackedProjectById(guildId, projectId)
	// The manage list only ever renders manually-tracked projects, so this should be unreachable
	// for author-sourced ones, guard anyway rather than trust the customId blindly.
	if (entry && !entry.sourceAuthorId) {
		await queries.removeTrackedProject(guildId, projectId)
		log.info(
			{ guildId, projectId, slug: entry.slug, userId: interaction.user.id },
			'Project untracked',
		)
	}

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
}

export async function handleTrackingListAuthorRemoveButton(interaction: ButtonInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const {
		projectPage,
		authorPage,
		id: authorId,
	} = parsePageState(interaction.customId.slice(TRACKING_LIST_AUTHOR_REMOVE_PREFIX.length))

	const entry = await queries.findTrackedAuthorById(guildId, authorId)
	if (entry) {
		await queries.removeTrackedAuthor(guildId, authorId)
		log.info(
			{ guildId, authorId, username: entry.username, userId: interaction.user.id },
			'Author untracked',
		)
	}

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
}

export async function handleTrackingListPauseButton(interaction: ButtonInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const { projectPage, authorPage } = parsePageState(
		interaction.customId.slice(TRACKING_LIST_PAUSE_PREFIX.length),
	)
	const config = await queries.getServerConfig(guildId)
	const paused = !config?.trackingPaused
	await (paused ? queries.pauseTracking(guildId) : queries.resumeTracking(guildId))
	log.info({ guildId, userId: interaction.user.id, paused }, 'Tracking pause toggled')

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
}

export async function handleTrackingListChannelSelect(interaction: ChannelSelectMenuInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const { projectPage, authorPage } = parsePageState(
		interaction.customId.slice(TRACKING_LIST_CHANNEL_SELECT_PREFIX.length),
	)
	const channelId = interaction.values[0]
	const config = await queries.getServerConfig(guildId)
	await queries.setServerConfig(guildId, channelId, config?.trackingRoleId ?? null)
	log.info({ guildId, channelId, userId: interaction.user.id }, 'Tracking channel updated')

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
}

export async function handleTrackingListRoleSelect(interaction: RoleSelectMenuInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const { projectPage, authorPage } = parsePageState(
		interaction.customId.slice(TRACKING_LIST_ROLE_SELECT_PREFIX.length),
	)
	const roleId = interaction.values[0] ?? null
	await queries.setTrackingRole(guildId, roleId)
	log.info({ guildId, roleId, userId: interaction.user.id }, 'Tracking role updated')

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
}

export async function handleTrackingListPageButton(interaction: ButtonInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const { projectPage, authorPage } = parsePageState(
		interaction.customId.slice(TRACKING_LIST_PAGE_PREFIX.length),
	)

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
}

export async function handleTrackingListAuthorPageButton(interaction: ButtonInteraction) {
	if (!(await requireManageGuild(interaction))) return

	const guildId = interaction.guildId!
	const { projectPage, authorPage } = parsePageState(
		interaction.customId.slice(TRACKING_LIST_AUTHOR_PAGE_PREFIX.length),
	)

	await refreshTrackingList(interaction, guildId, projectPage, authorPage)
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
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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
						.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
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
			sub.setName('manage').setDescription('Manage projects and authors tracked in this server'),
		)
		.addSubcommand((sub) =>
			sub
				.setName('pause')
				.setDescription(
					'Pause tracking notifications without removing tracked projects and authors',
				),
		)
		.addSubcommand((sub) =>
			sub.setName('resume').setDescription('Resume tracking notifications for this server'),
		)
		.addSubcommand((sub) =>
			sub
				.setName('disable')
				.setDescription('Disable tracking and remove all tracked projects and authors'),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('author')
				.setDescription('Track Modrinth authors and auto-track the projects they publish')
				.addSubcommand((sub) =>
					sub
						.setName('add')
						.setDescription('Start tracking a Modrinth user or organization')
						.addStringOption((opt) =>
							opt
								.setName('query')
								.setDescription('Username, organization slug, ID, or URL')
								.setRequired(true),
						)
						.addChannelOption((opt) =>
							opt
								.setName('channel')
								.setDescription(
									'Post announcements for this author to a specific channel (overrides server default)',
								)
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
								.setRequired(false),
						)
						.addRoleOption((opt) =>
							opt
								.setName('role')
								.setDescription('Ping a specific role for this author (overrides server default)')
								.setRequired(false),
						),
				)
				.addSubcommand((sub) =>
					sub
						.setName('remove')
						.setDescription('Stop tracking an author')
						.addStringOption((opt) =>
							opt
								.setName('query')
								.setDescription('Username, organization slug, ID, or URL')
								.setRequired(true)
								.setAutocomplete(true),
						),
				),
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
		const group = interaction.options.getSubcommandGroup(false)
		const sub = interaction.options.getSubcommand()

		if (group === 'author') {
			if (sub === 'remove') {
				await respondWithTrackedAuthorSearch(interaction)
			}
			return
		}

		if (sub === 'add') {
			await respondWithProjectSearch(interaction)
			return
		}

		if (sub === 'remove') {
			await respondWithTrackedProjectSearch(interaction)
		}
	},

	async execute(interaction) {
		const group = interaction.options.getSubcommandGroup(false)
		const sub = interaction.options.getSubcommand()
		const guildId = interaction.guildId!

		if (group === 'author') {
			await executeAuthorSubcommand(interaction, sub, guildId)
			return
		}

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

			const count = await queries.countManuallyTrackedProjects(guildId)
			const hasPerks = !usesDonatorPerks || Boolean(config.isSupporter)
			const limit = hasPerks ? MAX_TRACKED_SUPPORTER : MAX_TRACKED
			if (count >= limit) {
				await interaction.reply({
					embeds: [
						error(
							`This server is already tracking the maximum of **${limit}** projects.${
								usesDonatorPerks && !hasPerks
									? `\n\nDonate on Ko-fi using \`/donate info\` to track up to **${MAX_TRACKED_SUPPORTER}** projects.`
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
			if (existing && !existing.sourceAuthorId) {
				await interaction.editReply({
					embeds: [error(`**${project.name}** is already being tracked.`)],
				})
				return
			}

			const releaseTypeInput = interaction.options.getString('release_type') ?? 'all'
			const releaseType = parseReleaseType(releaseTypeInput)
			const channelOverride = interaction.options.getChannel('channel')
			const roleOverride = interaction.options.getRole('role')

			// Detaches the project from its author if it was already auto-tracked through one.
			await queries.trackProjectManually(
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
				{
					guildId,
					projectId: project.id,
					slug: project.slug,
					userId: interaction.user.id,
					convertedFromAuthorId: existing?.sourceAuthorId ?? undefined,
				},
				existing?.sourceAuthorId
					? 'Author-tracked project converted to manual tracking'
					: 'Project tracked',
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
			if (existing?.sourceAuthorId) {
				details.push(`It will keep being tracked even if you stop tracking its author.`)
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
				// Not a URL and unrecognized by Modrinth, so treat the input as the tracked project ID.
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

			if (entry.sourceAuthorId) {
				const author = await queries.findTrackedAuthorById(guildId, entry.sourceAuthorId)
				await interaction.reply({
					embeds: [
						error(
							`**${entry.name}** is tracked automatically through ${author ? `**${author.name}**` : 'a tracked author'}. Use \`/tracking author remove\` to stop tracking it.`,
						),
					],
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

		if (sub === 'manage') {
			const [tracked, trackedAuthors, config] = await Promise.all([
				queries.getManuallyTrackedProjects(guildId),
				queries.getTrackedAuthors(guildId),
				queries.getServerConfig(guildId),
			])

			const limit =
				!usesDonatorPerks || Boolean(config?.isSupporter) ? MAX_TRACKED_SUPPORTER : MAX_TRACKED
			const authorLimit =
				!usesDonatorPerks || Boolean(config?.isSupporter)
					? MAX_TRACKED_AUTHORS_SUPPORTER
					: MAX_TRACKED_AUTHORS

			const payload = await buildTrackingListPayload(
				guildId,
				tracked,
				trackedAuthors,
				config,
				limit,
				authorLimit,
			)
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
				queries.removeAllTrackedAuthors(guildId),
				queries.clearTrackingConfig(guildId),
			])
			log.info({ guildId, userId: interaction.user.id }, 'Tracking disabled')
			await interaction.reply({
				embeds: [success('All tracked projects, authors, and configuration have been removed.')],
				flags: 'Ephemeral',
			})
		}
	},
}

async function executeAuthorSubcommand(
	interaction: ChatInputCommandInteraction,
	sub: string,
	guildId: string,
) {
	if (sub === 'add') {
		const config = await queries.getServerConfig(guildId)
		if (!config?.trackingChannelId) {
			await interaction.reply({
				embeds: [error('Set a notification channel first with `/tracking setup`.')],
				flags: 'Ephemeral',
			})
			return
		}

		const count = await queries.countTrackedAuthors(guildId)
		const hasPerks = !usesDonatorPerks || Boolean(config.isSupporter)
		const limit = hasPerks ? MAX_TRACKED_AUTHORS_SUPPORTER : MAX_TRACKED_AUTHORS
		if (count >= limit) {
			await interaction.reply({
				embeds: [
					error(
						`This server is already tracking the maximum of **${limit}** authors.${
							usesDonatorPerks && !hasPerks
								? `\n\nDonate on Ko-fi using \`/donate info\` to track up to **${MAX_TRACKED_AUTHORS_SUPPORTER}** authors.`
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
		let author
		try {
			author = await resolveAuthor(raw)
		} catch (err) {
			const notFound = err instanceof ModrinthApiError && err.statusCode === 404
			const message = notFound
				? `No user or organization found for \`${raw}\`.`
				: err instanceof Error
					? err.message
					: String(err)
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		const existing = await queries.findTrackedAuthorById(guildId, author.id)
		if (existing) {
			await interaction.editReply({
				embeds: [error(`**${author.name}** is already being tracked.`)],
			})
			return
		}

		let projects: Labrinth.Projects.v3.Project[]
		try {
			projects = await fetchAuthorProjects(author.type, author.id)
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			await interaction.editReply({ embeds: [error(message)] })
			return
		}

		const channelOverride = interaction.options.getChannel('channel')
		const roleOverride = interaction.options.getRole('role')

		await queries.addTrackedAuthor(
			guildId,
			author.id,
			author.type,
			author.username,
			author.name,
			projects.map((p) => p.id),
			channelOverride?.id ?? null,
			roleOverride?.id ?? null,
		)

		// Track everything the author already has out now; the poller only tracks projects published after this point.
		const newlyTracked = await Promise.all(
			projects.map((project) =>
				queries.addTrackedProjectIfMissing(
					guildId,
					project.id,
					project.slug ?? project.id,
					project.name,
					new Date(project.updated),
					undefined,
					channelOverride?.id ?? null,
					roleOverride?.id ?? null,
					author.id,
				),
			),
		)
		const autoTrackedCount = newlyTracked.filter(Boolean).length
		log.info(
			{
				guildId,
				authorId: author.id,
				authorType: author.type,
				username: author.username,
				projects: projects.length,
				autoTracked: autoTrackedCount,
				userId: interaction.user.id,
			},
			'Author tracked',
		)

		const details = []
		if (channelOverride) details.push(`Notifications will go to <#${channelOverride.id}>.`)
		if (roleOverride) details.push(`<@&${roleOverride.id}> will be pinged.`)
		if (autoTrackedCount < projects.length) {
			details.push(
				`${projects.length - autoTrackedCount} of their project${projects.length - autoTrackedCount === 1 ? '' : 's'} ${projects.length - autoTrackedCount === 1 ? 'was' : 'were'} already tracked and kept as-is.`,
			)
		}

		await interaction.editReply({
			embeds: [
				success(
					`Now tracking **${author.name}** (${author.type}) and their ${autoTrackedCount} project${autoTrackedCount === 1 ? '' : 's'}.${details.length > 0 ? `\n${details.join('\n')}` : ''}`,
				),
			],
		})
		return
	}

	if (sub === 'remove') {
		const raw = interaction.options.getString('query', true).trim()

		let entry = await queries.findTrackedAuthorById(guildId, raw)
		if (!entry) {
			try {
				const author = await resolveAuthor(raw)
				entry = await queries.findTrackedAuthorById(guildId, author.id)
			} catch {
				// Not resolvable on Modrinth either; entry stays null and is reported below.
			}
		}

		if (!entry) {
			await interaction.reply({
				embeds: [error(`\`${raw}\` is not being tracked in this server.`)],
				flags: 'Ephemeral',
			})
			return
		}

		const untrackedProjects = await queries.countTrackedProjectsByAuthor(guildId, entry.authorId)
		await queries.removeTrackedAuthor(guildId, entry.authorId)
		log.info(
			{
				guildId,
				authorId: entry.authorId,
				username: entry.username,
				untrackedProjects,
				userId: interaction.user.id,
			},
			'Author untracked',
		)
		await interaction.reply({
			embeds: [
				success(
					`Stopped tracking **${entry.name}**${untrackedProjects > 0 ? ` and untracked ${untrackedProjects} of their project${untrackedProjects === 1 ? '' : 's'}` : ''}.`,
				),
			],
			flags: 'Ephemeral',
		})
	}
}
