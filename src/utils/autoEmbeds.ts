import type { Labrinth } from '@modrinth/api-client'
import { type Message, PermissionFlagsBits } from 'discord.js'

import { queries } from '../db/queries.js'
import { modrinthClient } from './api.js'
import {
	buildCollectionCard,
	buildOrganizationCard,
	buildProjectCard,
	buildUserCard,
	buildVersionNotification,
} from './embeds/index.js'
import type { CardPayload } from './embeds/types.js'
import { createModuleLogger } from './logger.js'
import { type ParsedModrinthUrl, parseModrinthUrl } from './url.js'

const log = createModuleLogger('auto-embeds')

const MAX_LINKS_PER_MESSAGE = 3
const MODRINTH_URL_REGEX = /https?:\/\/modrinth\.com\/\S+/gi

function extractModrinthUrls(content: string): string[] {
	const matches = content.match(MODRINTH_URL_REGEX) ?? []
	const trimmed = matches.map((url) => url.replace(/[)\]>,.!?'"]+$/, ''))
	return [...new Set(trimmed)]
}

async function resolveCard(parsed: ParsedModrinthUrl): Promise<CardPayload | null> {
	try {
		if (parsed.type === 'project') {
			const project = await modrinthClient.labrinth.projects_v3.get(parsed.slug)
			return await buildProjectCard(project)
		}

		if (parsed.type === 'version') {
			const project = await modrinthClient.labrinth.projects_v3.get(parsed.projectSlug)
			const versions = await modrinthClient.labrinth.versions_v3.getProjectVersions(project.id)
			const version = versions.find(
				(entry) => entry.id === parsed.reference || entry.version_number === parsed.reference,
			)
			return version ? await buildVersionNotification(project, version) : null
		}

		if (parsed.type === 'user') {
			const [user, projects] = await Promise.all([
				modrinthClient.labrinth.users_v3.get(parsed.username),
				modrinthClient.request<Labrinth.Projects.v3.Project[]>(
					`/user/${parsed.username}/projects`,
					{ api: 'labrinth', version: 3, method: 'GET' },
				),
			])
			return buildUserCard(user, projects)
		}

		if (parsed.type === 'organization') {
			const [org, projects] = await Promise.all([
				modrinthClient.labrinth.organizations_v3.get(parsed.slug),
				modrinthClient.labrinth.organizations_v3.getProjects(parsed.slug),
			])
			return buildOrganizationCard(org, projects)
		}

		const collection = await modrinthClient.labrinth.collections.get(parsed.id)
		const projects =
			collection.projects.length > 0
				? await modrinthClient.labrinth.projects_v3.getMultiple(collection.projects)
				: []
		return await buildCollectionCard(collection, projects)
	} catch (err) {
		log.warn({ err, parsed }, 'Failed to resolve Modrinth link for embed')
		return null
	}
}

export async function handleMessageCreate(message: Message) {
	if (message.author.bot || !message.inGuild()) return
	if (!message.content.includes('modrinth.com')) return

	const config = await queries.getServerConfig(message.guildId)
	if (!config?.autoEmbedsEnabled) return

	const parsedUrls = extractModrinthUrls(message.content)
		.map(parseModrinthUrl)
		.filter((parsed): parsed is ParsedModrinthUrl => parsed !== null)
		.slice(0, MAX_LINKS_PER_MESSAGE)
	if (parsedUrls.length === 0) return

	const cards = (await Promise.all(parsedUrls.map(resolveCard))).filter(
		(card): card is CardPayload => card !== null,
	)
	if (cards.length === 0) return

	try {
		await message.reply({
			embeds: cards.flatMap((card) => card.embeds),
			components: cards.flatMap((card) => card.components),
			allowedMentions: { repliedUser: false },
		})
	} catch (err) {
		log.warn({ err, messageId: message.id, guildId: message.guildId }, 'Failed to send auto embed')
		return
	}

	const me = message.guild.members.me
	if (me?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
		await message
			.suppressEmbeds(true)
			.catch((err) => log.warn({ err, messageId: message.id }, 'Failed to suppress original embed'))
	}
}
