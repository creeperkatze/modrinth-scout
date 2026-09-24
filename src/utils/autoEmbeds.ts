import { type Attachment, type Message, PermissionFlagsBits } from 'discord.js'

import { queries } from '../db/queries.js'
import { modrinthClient } from './api/modrinth.js'
import {
	buildCollectionCard,
	buildOrganizationCard,
	buildProjectCard,
	buildUserCard,
	buildVersionNotification,
} from './embeds/index.js'
import type { CardPayload } from './embeds/types.js'
import { hashAttachment, identifyByHash, MAX_JAR_FILE_BYTES } from './identify.js'
import { createModuleLogger } from './logger.js'
import { type ParsedModrinthUrl, parseModrinthUrl } from './url.js'

const log = createModuleLogger('auto-embeds')

const MAX_LINKS_PER_MESSAGE = 3
const MAX_JAR_ATTACHMENTS_PER_MESSAGE = 3
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
			const version = await modrinthClient.labrinth.versions_v3.getVersionFromIdOrNumber(
				project.id,
				parsed.reference,
			)
			return await buildVersionNotification(project, version)
		}

		if (parsed.type === 'user') {
			const [user, projects] = await Promise.all([
				modrinthClient.labrinth.users_v3.get(parsed.username),
				modrinthClient.labrinth.users_v3.getProjects(parsed.username),
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

async function resolveJarCard(attachment: Attachment): Promise<CardPayload | null> {
	try {
		const hash = await hashAttachment(attachment.url)
		const { project, version } = await identifyByHash(hash)
		return await buildVersionNotification(project, version)
	} catch {
		// Most posted jars won't match anything on Modrinth; that's expected, not an error.
		return null
	}
}

export async function resolveLinkCards(content: string): Promise<CardPayload[]> {
	const parsedUrls = extractModrinthUrls(content)
		.map(parseModrinthUrl)
		.filter((parsed): parsed is ParsedModrinthUrl => parsed !== null)
		.slice(0, MAX_LINKS_PER_MESSAGE)

	const cards = await Promise.all(parsedUrls.map(resolveCard))
	return cards.filter((card): card is CardPayload => card !== null)
}

export async function resolveJarCards(attachments: Attachment[]): Promise<CardPayload[]> {
	const candidates = attachments
		.filter((a) => a.size <= MAX_JAR_FILE_BYTES)
		.slice(0, MAX_JAR_ATTACHMENTS_PER_MESSAGE)

	const cards = await Promise.all(candidates.map(resolveJarCard))
	return cards.filter((card): card is CardPayload => card !== null)
}

export function jarAttachmentsOf(message: Message): Attachment[] {
	return [...message.attachments.filter((a) => a.name.toLowerCase().endsWith('.jar')).values()]
}

async function handleAutoEmbeds(message: Message<true>) {
	const cards = await resolveLinkCards(message.content)
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

async function handleJarIdentify(message: Message<true>, attachments: Attachment[]) {
	const cards = await resolveJarCards(attachments)
	if (cards.length === 0) return

	try {
		await message.reply({
			content: 'This file has been identified',
			embeds: cards.flatMap((card) => card.embeds),
			components: cards.flatMap((card) => card.components),
			allowedMentions: { repliedUser: false },
		})
	} catch (err) {
		log.warn(
			{ err, messageId: message.id, guildId: message.guildId },
			'Failed to send jar identify reply',
		)
	}
}

export async function handleMessageCreate(message: Message) {
	if (message.author.bot || !message.inGuild()) return

	const jarAttachments = jarAttachmentsOf(message)
	const hasModrinthLink = message.content.includes('modrinth.com')
	if (jarAttachments.length === 0 && !hasModrinthLink) return

	const config = await queries.getGuildConfig(message.guildId)
	if (!config) return

	if (jarAttachments.length > 0 && config.options?.jarIdentify) {
		await handleJarIdentify(message, jarAttachments)
	}

	if (hasModrinthLink && config.options?.autoEmbeds) {
		await handleAutoEmbeds(message)
	}
}
