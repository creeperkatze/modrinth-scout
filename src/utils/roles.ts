import type { Client, GuildMember } from 'discord.js'

import { queries } from '../db/queries.js'
import type { RoleRule } from '../db/schemas/guild.js'
import { modrinthClient } from './api/modrinth.js'
import { authorLink, BADGE_LABELS, projectLink, resolveBadges, typeLabel } from './embeds/index.js'
import { withEmoji } from './emojis.js'
import { createModuleLogger } from './logger.js'

const log = createModuleLogger('roles')

const DAY_MS = 24 * 60 * 60 * 1000

// Shared by one sync run so each Modrinth lookup happens at most once, even across guilds
export type SyncCache = Map<string, Promise<unknown>>

export type SyncResult = { added: string[]; removed: string[] }

type TeamKind = 'project' | 'organization'
type TeamTarget = { id: string; slug: string; name: string }

function cached<T>(cache: SyncCache, key: string, fetch: () => Promise<T>): Promise<T> {
	let value = cache.get(key) as Promise<T> | undefined
	if (!value) {
		value = fetch()
		cache.set(key, value)
	}
	return value
}

// Accepted members only, pending invites don't count
function fetchTeam(cache: SyncCache, kind: TeamKind, id: string): Promise<Set<string>> {
	return cached(cache, `team:${kind}:${id}`, async () => {
		const members =
			kind === 'project'
				? await modrinthClient.labrinth.projects_v3.getMembers(id)
				: (await modrinthClient.labrinth.organizations_v3.get(id)).members
		return new Set(members.filter((m) => m.accepted).map((m) => m.user.id))
	})
}

async function meetsTeam(
	cache: SyncCache,
	kind: TeamKind,
	target: TeamTarget,
	modrinthUserId: string,
): Promise<boolean> {
	return (await fetchTeam(cache, kind, target.id)).has(modrinthUserId)
}

async function meetsRule(
	rule: RoleRule,
	modrinthUserId: string,
	cache: SyncCache,
): Promise<boolean> {
	if (rule.project && !(await meetsTeam(cache, 'project', rule.project, modrinthUserId))) {
		return false
	}
	if (
		rule.organization &&
		!(await meetsTeam(cache, 'organization', rule.organization, modrinthUserId))
	) {
		return false
	}

	if (rule.badge != null || rule.minAccountAgeDays != null) {
		const user = await cached(cache, `user:${modrinthUserId}`, () =>
			modrinthClient.labrinth.users_v3.get(modrinthUserId),
		)
		if (rule.badge != null && !resolveBadges(user).includes(rule.badge)) return false
		if (
			rule.minAccountAgeDays != null &&
			Date.now() - new Date(user.created).getTime() < rule.minAccountAgeDays * DAY_MS
		) {
			return false
		}
	}

	if (
		rule.minDownloads != null ||
		rule.minProjects != null ||
		rule.minFollowers != null ||
		rule.projectType != null
	) {
		const projects = await cached(cache, `projects:${modrinthUserId}`, () =>
			modrinthClient.labrinth.users_v3.getProjects(modrinthUserId),
		)
		const downloads = projects.reduce((sum, p) => sum + p.downloads, 0)
		const followers = projects.reduce((sum, p) => sum + p.followers, 0)
		if (rule.minDownloads != null && downloads < rule.minDownloads) return false
		if (rule.minProjects != null && projects.length < rule.minProjects) return false
		if (rule.minFollowers != null && followers < rule.minFollowers) return false
		if (
			rule.projectType != null &&
			!projects.some((p) => p.project_types.some((type) => type === rule.projectType))
		) {
			return false
		}
	}

	return true
}

// null means eligibility couldn't be determined (API error), the role is then left untouched
async function isEligible(
	rule: RoleRule,
	modrinthUserId: string | null,
	cache: SyncCache,
): Promise<boolean | null> {
	if (!modrinthUserId) return false
	try {
		return await meetsRule(rule, modrinthUserId, cache)
	} catch (err) {
		log.warn({ err, roleId: rule.roleId, modrinthUserId }, 'Could not evaluate role')
		return null
	}
}

function formatCount(count: number): string {
	return count.toLocaleString('en-US')
}

// One line per condition, for /roles list and /roles manage
export function describeRule(rule: RoleRule): string[] {
	const lines: string[] = []

	if (rule.project) {
		lines.push(`Team member of ${projectLink(rule.project, rule.project.projectType ?? undefined)}`)
	}
	if (rule.organization) {
		lines.push(`Member of ${authorLink({ ...rule.organization, kind: 'organization' })}`)
	}
	if (rule.minDownloads != null) lines.push(`At least ${formatCount(rule.minDownloads)} downloads`)
	if (rule.minProjects != null) {
		lines.push(
			`At least ${formatCount(rule.minProjects)} project${rule.minProjects === 1 ? '' : 's'}`,
		)
	}
	if (rule.minFollowers != null) lines.push(`At least ${formatCount(rule.minFollowers)} followers`)
	if (rule.projectType != null) {
		lines.push(
			withEmoji(rule.projectType, `Published a ${typeLabel(rule.projectType).toLowerCase()}`),
		)
	}
	if (rule.badge != null) {
		lines.push(withEmoji(rule.badge, `${BADGE_LABELS[rule.badge] ?? rule.badge} badge`))
	}
	if (rule.minAccountAgeDays != null) {
		lines.push(
			`Account at least ${formatCount(rule.minAccountAgeDays)} day${rule.minAccountAgeDays === 1 ? '' : 's'} old`,
		)
	}

	return lines.length > 0 ? lines : ['Any linked Modrinth account']
}

// Roles are fully managed: members who don't meet a rule lose its role
export async function syncMemberRoles(
	member: GuildMember,
	rules: RoleRule[],
	modrinthUserId: string | null,
	cache: SyncCache = new Map(),
): Promise<SyncResult> {
	const result: SyncResult = { added: [], removed: [] }

	for (const rule of rules) {
		// Deleted roles and roles above the bot are skipped, /roles manage flags them
		const role = member.guild.roles.cache.get(rule.roleId)
		if (!role?.editable) continue

		const eligible = await isEligible(rule, modrinthUserId, cache)
		if (eligible === null) continue

		const has = member.roles.cache.has(role.id)
		try {
			if (eligible && !has) {
				await member.roles.add(role, 'Meets role conditions')
				result.added.push(role.id)
			} else if (!eligible && has) {
				await member.roles.remove(role, 'No longer meets role conditions')
				result.removed.push(role.id)
			}
		} catch (err) {
			log.warn({ err, guildId: member.guild.id, roleId: role.id }, 'Could not update role')
		}
	}

	return result
}

// Runs after a link change. Without the privileged GuildMembers intent the bot can't list a user's
// guilds, so it checks every guild with rules and skips the ones the user isn't in
export async function syncMemberAcrossGuilds(
	client: Client,
	discordUserId: string,
	modrinthUserId: string | null,
) {
	const configs = await queries.getGuildsWithRoles()
	const cache: SyncCache = new Map()

	for (const config of configs) {
		const guild = client.guilds.cache.get(config._id)
		if (!guild) continue

		const member = await guild.members.fetch(discordUserId).catch(() => null)
		if (!member) continue

		const { added, removed } = await syncMemberRoles(member, config.roles, modrinthUserId, cache)
		if (added.length > 0 || removed.length > 0) {
			log.info({ guildId: guild.id, discordUserId, added, removed }, 'Roles synced')
		}
	}
}
