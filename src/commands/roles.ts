import { ModrinthApiError } from '@modrinth/api-client'
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChatInputCommandInteraction,
	ContainerBuilder,
	EmbedBuilder,
	Guild,
	InteractionContextType,
	PermissionFlagsBits,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from 'discord.js'

import { usesDonatorPerks } from '../config/donatorPerks.js'
import { PROJECT_TYPES } from '../config/modrinth.js'
import { hasActivePerks, MAX_ROLES, MAX_ROLES_DONATOR, queries } from '../db/queries.js'
import type { RoleRule } from '../db/schemas/guild.js'
import type { ChatInputCommand } from '../types/index.js'
import { modrinthClient } from '../utils/api/modrinth.js'
import { respondWithProjectSearch } from '../utils/autocomplete.js'
import { BADGE_LABELS, buildRolesHelp, error, info, success } from '../utils/embeds/index.js'
import { createModuleLogger } from '../utils/logger.js'
import { describeRule, syncMemberRoles } from '../utils/roles.js'
import { parseModrinthUrl } from '../utils/url.js'
import { buildLinkReply } from './account.js'

const log = createModuleLogger('roles')

export const ROLES_MANAGE_REMOVE_PREFIX = 'roles-manage-remove:'
export const ROLES_MANAGE_PAGE_PREFIX = 'roles-manage-page:'

const MANAGE_PAGE_SIZE = 5

type GuildInteraction = ChatInputCommandInteraction<'cached'>
type GuildConfigResult = Awaited<ReturnType<typeof queries.getGuildConfig>>
type TeamTarget = { id: string; slug: string; name: string; projectType: string | null }

function roleLimit(config: GuildConfigResult): number {
	const hasPerks = !usesDonatorPerks || hasActivePerks(config)
	return hasPerks ? MAX_ROLES_DONATOR : MAX_ROLES
}

async function resolveTeamTarget(
	kind: 'project' | 'organization',
	raw: string,
): Promise<TeamTarget | string> {
	const parsed = parseModrinthUrl(raw)
	try {
		if (kind === 'project') {
			const input = parsed?.type === 'project' ? parsed.slug : raw
			const project = await modrinthClient.labrinth.projects_v3.get(input)
			return {
				id: project.id,
				slug: project.slug ?? project.id,
				name: project.name,
				projectType: project.project_types[0] ?? null,
			}
		}
		const input = parsed?.type === 'organization' ? parsed.slug : raw
		const org = await modrinthClient.labrinth.organizations_v3.get(input)
		return { id: org.id, slug: org.slug, name: org.name, projectType: null }
	} catch (err) {
		if (err instanceof ModrinthApiError && err.statusCode === 404) {
			return `No ${kind} found for \`${raw}\`.`
		}
		throw err
	}
}

// Returns the rule, or an error message for the user
async function buildRule(interaction: GuildInteraction): Promise<RoleRule | string> {
	const { options } = interaction
	const projectInput = options.getString('project')
	const organizationInput = options.getString('organization')

	const project = projectInput ? await resolveTeamTarget('project', projectInput) : null
	if (typeof project === 'string') return project
	const organization = organizationInput
		? await resolveTeamTarget('organization', organizationInput)
		: null
	if (typeof organization === 'string') return organization

	return {
		roleId: options.getRole('role', true).id,
		project,
		organization,
		minDownloads: options.getInteger('min_downloads'),
		minProjects: options.getInteger('min_projects'),
		minFollowers: options.getInteger('min_followers'),
		projectType: options.getString('project_type'),
		badge: options.getString('badge'),
		minAccountAgeDays: options.getInteger('min_account_age'),
	}
}

async function handleAdd(interaction: GuildInteraction) {
	const role = interaction.options.getRole('role', true)

	if (role.id === interaction.guildId) {
		await interaction.reply({
			embeds: [error('`@everyone` cannot be used with `/roles`.')],
			flags: 'Ephemeral',
		})
		return
	}
	if (!role.editable) {
		await interaction.reply({
			embeds: [
				error(`I can't manage ${role}. Give me **Manage Roles** and move my role above it.`),
			],
			flags: 'Ephemeral',
		})
		return
	}

	const config = await queries.getGuildConfig(interaction.guildId)
	const existing = config?.roles ?? []
	const limit = roleLimit(config)
	if (!existing.some((r) => r.roleId === role.id) && existing.length >= limit) {
		const upsell =
			limit < MAX_ROLES_DONATOR
				? ` Donators can create up to ${MAX_ROLES_DONATOR}, see \`/donate info\`.`
				: ''
		await interaction.reply({
			embeds: [error(`This server has reached its limit of ${limit} roles.${upsell}`)],
			flags: 'Ephemeral',
		})
		return
	}

	await interaction.deferReply({ flags: 'Ephemeral' })

	const rule = await buildRule(interaction)
	if (typeof rule === 'string') {
		await interaction.editReply({ embeds: [error(rule)] })
		return
	}

	await queries.setRole(interaction.guildId, rule)
	log.info({ guildId: interaction.guildId, rule, userId: interaction.user.id }, 'Role set')

	const conditions = describeRule(rule)
		.map((line) => `- ${line}`)
		.join('\n')
	await interaction.editReply({
		embeds: [
			success(
				`${role} is now given to members whose Modrinth account meets all of:\n${conditions}`,
			),
		],
	})
}

async function handleRemove(interaction: GuildInteraction) {
	const role = interaction.options.getRole('role', true)
	const removed = await queries.removeRole(interaction.guildId, role.id)
	await interaction.reply({
		embeds: [
			removed
				? success(`${role} was removed from \`/roles\`.`)
				: error(`${role} isn't set up with \`/roles\`.`),
		],
		flags: 'Ephemeral',
	})
}

async function handleList(interaction: GuildInteraction) {
	const config = await queries.getGuildConfig(interaction.guildId)
	const rules = config?.roles ?? []

	const lines = rules
		.filter((rule) => interaction.guild.roles.cache.has(rule.roleId))
		.map((rule) => `- <@&${rule.roleId}> · ${describeRule(rule).join(' · ')}`)

	const embed = new EmbedBuilder()
		.setTitle('Roles')
		.setDescription(
			lines.length > 0 ? lines.join('\n') : "This server hasn't set up any roles yet.",
		)
		.setColor(0x1bd96a)

	await interaction.reply({ embeds: [embed], flags: 'Ephemeral' })
}

// Link changes already sync roles in every guild, this covers joining later and Modrinth changes
async function handleGet(interaction: GuildInteraction) {
	const [config, linked] = await Promise.all([
		queries.getGuildConfig(interaction.guildId),
		queries.getLinkedAccount(interaction.user.id),
	])

	// Roles are granted automatically once the OAuth callback stores the link
	if (!linked) {
		await interaction.reply({ ...(await buildLinkReply(interaction.user.id)), flags: 'Ephemeral' })
		return
	}

	const rules = config?.roles ?? []
	if (rules.length === 0) {
		await interaction.reply({
			embeds: [info("This server hasn't set up any roles yet.")],
			flags: 'Ephemeral',
		})
		return
	}

	await interaction.deferReply({ flags: 'Ephemeral' })

	const { added, removed } = await syncMemberRoles(interaction.member, rules, linked.modrinthUserId)

	const lines = [...added.map((id) => `+ <@&${id}>`), ...removed.map((id) => `− <@&${id}>`)]
	await interaction.editReply({
		embeds: [
			lines.length > 0
				? success(`Your roles were updated:\n${lines.join('\n')}`)
				: info('Your roles are already up to date.'),
		],
	})
}

async function handleHelp(interaction: GuildInteraction) {
	const config = await queries.getGuildConfig(interaction.guildId)
	await interaction.reply({ embeds: [buildRolesHelp(roleLimit(config))], flags: 'Ephemeral' })
}

function buildManagePayload(guild: Guild, rules: RoleRule[], limit: number, requestedPage = 0) {
	const totalPages = Math.max(1, Math.ceil(rules.length / MANAGE_PAGE_SIZE))
	const page = Math.min(Math.max(requestedPage, 0), totalPages - 1)
	const pageItems = rules.slice(page * MANAGE_PAGE_SIZE, (page + 1) * MANAGE_PAGE_SIZE)

	const container = new ContainerBuilder()
		.setAccentColor(0x1bd96a)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Roles'))

	if (rules.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('No roles yet. Use `/roles add` to add one.'),
		)
		return { components: [container], flags: ['IsComponentsV2'] as const }
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### Roles · ${rules.length} / ${limit}`),
	)

	pageItems.forEach((rule, i) => {
		const role = guild.roles.cache.get(rule.roleId)
		const lines = [role ? `**${role}**` : '**~~Deleted role~~**']
		lines.push(...describeRule(rule).map((line) => `-# ${line}`))
		if (role && !role.editable) {
			lines.push("-# ⚠️ I can't manage this role, move my role above it")
		}

		const button = new ButtonBuilder()
			.setCustomId(`${ROLES_MANAGE_REMOVE_PREFIX}${page}:${rule.roleId}`)
			.setLabel('Remove')
			.setStyle(ButtonStyle.Danger)

		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
				.setButtonAccessory(button),
		)

		if (i < pageItems.length - 1) {
			container.addSeparatorComponents(
				new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
			)
		}
	})

	if (totalPages > 1) {
		container.addActionRowComponents(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`${ROLES_MANAGE_PAGE_PREFIX}${page - 1}`)
					.setLabel('◀ Prev')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId(`${ROLES_MANAGE_PAGE_PREFIX}${page + 1}`)
					.setLabel('Next ▶')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= totalPages - 1),
			),
		)
	}

	return { components: [container], flags: ['IsComponentsV2'] as const }
}

async function loadManagePayload(guild: Guild, page = 0) {
	const config = await queries.getGuildConfig(guild.id)
	return buildManagePayload(guild, config?.roles ?? [], roleLimit(config), page)
}

async function handleManage(interaction: GuildInteraction) {
	const payload = await loadManagePayload(interaction.guild)
	await interaction.reply({ ...payload, flags: [...payload.flags, 'Ephemeral'] })
}

async function requireManageRoles(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<boolean> {
	if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) return true
	await interaction.reply({
		embeds: [error('You need the Manage Roles permission to do that.')],
		flags: 'Ephemeral',
	})
	return false
}

function parsePage(value: string | undefined): number {
	const page = parseInt(value ?? '0')
	return Number.isNaN(page) ? 0 : page
}

export async function handleRolesManageRemoveButton(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild() || !(await requireManageRoles(interaction))) return

	const [pageStr, roleId] = interaction.customId.slice(ROLES_MANAGE_REMOVE_PREFIX.length).split(':')
	await queries.removeRole(interaction.guildId, roleId)
	log.info({ guildId: interaction.guildId, roleId, userId: interaction.user.id }, 'Role removed')

	await interaction.update(await loadManagePayload(interaction.guild, parsePage(pageStr)))
}

export async function handleRolesManagePageButton(interaction: ButtonInteraction) {
	if (!interaction.inCachedGuild() || !(await requireManageRoles(interaction))) return

	const page = parsePage(interaction.customId.slice(ROLES_MANAGE_PAGE_PREFIX.length))
	await interaction.update(await loadManagePayload(interaction.guild, page))
}

const badgeChoices = Object.entries(BADGE_LABELS).map(([value, name]) => ({ name, value }))

export const rolesCommand: ChatInputCommand = {
	data: new SlashCommandBuilder()
		.setName('roles')
		.setDescription('Give roles to members based on their linked Modrinth account')
		.addSubcommand((sub) =>
			sub
				.setName('add')
				.setDescription('Give a role to members whose Modrinth account meets all set conditions')
				.addRoleOption((o) => o.setName('role').setDescription('Role to give').setRequired(true))
				.addStringOption((o) =>
					o
						.setName('project')
						.setDescription('Must be on the team of this project')
						.setAutocomplete(true),
				)
				.addStringOption((o) =>
					o
						.setName('organization')
						.setDescription('Must be a member of this organization (slug, ID, or URL)'),
				)
				.addIntegerOption((o) =>
					o
						.setName('min_downloads')
						.setDescription('Minimum total downloads across their projects')
						.setMinValue(1),
				)
				.addIntegerOption((o) =>
					o
						.setName('min_projects')
						.setDescription('Minimum number of projects they are a team member of')
						.setMinValue(1),
				)
				.addIntegerOption((o) =>
					o
						.setName('min_followers')
						.setDescription('Minimum total followers across their projects')
						.setMinValue(1),
				)
				.addStringOption((o) =>
					o
						.setName('project_type')
						.setDescription('Must have at least one project of this type')
						.addChoices(...PROJECT_TYPES),
				)
				.addStringOption((o) =>
					o
						.setName('badge')
						.setDescription('Must have this Modrinth badge')
						.addChoices(...badgeChoices),
				)
				.addIntegerOption((o) =>
					o
						.setName('min_account_age')
						.setDescription('Minimum Modrinth account age in days')
						.setMinValue(1),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('remove')
				.setDescription('Stop giving out a role')
				.addRoleOption((o) => o.setName('role').setDescription('Role to remove').setRequired(true)),
		)
		.addSubcommand((sub) => sub.setName('manage').setDescription("Manage this server's roles"))
		.addSubcommand((sub) =>
			sub.setName('list').setDescription("Show this server's roles and what they require"),
		)
		.addSubcommand((sub) =>
			sub.setName('get').setDescription('Get the roles your Modrinth account qualifies for'),
		)
		.addSubcommand((sub) =>
			sub.setName('help').setDescription('Explain how roles, conditions, and syncing work'),
		)
		.setContexts(InteractionContextType.Guild)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall),
	// No defaultMemberPermissions: Discord applies it to the whole command, which would hide `get`
	// and `list` from members. The admin subcommands check Manage Roles in execute instead
	meta: {
		name: 'roles',
		description: 'Give roles to members based on their linked Modrinth account',
		category: 'utility',
		guildOnly: true,
		cooldownSeconds: 10,
	},
	async autocomplete(interaction) {
		await respondWithProjectSearch(interaction)
	},
	async execute(interaction) {
		if (!interaction.inCachedGuild()) return

		const sub = interaction.options.getSubcommand()
		if (sub === 'get') return handleGet(interaction)
		if (sub === 'list') return handleList(interaction)
		if (sub === 'help') return handleHelp(interaction)

		if (!(await requireManageRoles(interaction))) return
		if (sub === 'add') await handleAdd(interaction)
		else if (sub === 'remove') await handleRemove(interaction)
		else if (sub === 'manage') await handleManage(interaction)
	},
}
