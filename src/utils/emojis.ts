import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ApplicationEmoji, Client } from 'discord.js'

import { logger } from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const log = logger.child({ module: 'emojis' })

const LOADER_NAMES = [
	'fabric',
	'babric',
	'bta-babric',
	'forge',
	'java-agent',
	'legacy-fabric',
	'liteloader',
	'modloader',
	'neoforge',
	'nilloader',
	'ornithe',
	'quilt',
	'rift',
]

export const LOADERS = new Set(LOADER_NAMES)

const CHANNEL_NAMES = ['release', 'beta', 'alpha']

const PROJECT_TYPE_NAMES = [
	'mod',
	'resourcepack',
	'datapack',
	'shader',
	'modpack',
	'plugin',
	'minecraft_java_server',
]

const STAT_NAMES = ['downloads', 'follows']

const BRAND_NAMES = ['modrinth', 'topgg', 'discord']
const ICON_NAMES = ['kofi']

const CATEGORY_NAMES = [
	'adventure',
	'adventure-mode',
	'anarchy',
	'atmosphere',
	'audio',
	'battle-royale',
	'bedwars',
	'blocks',
	'bloom',
	'bosses',
	'cartoon',
	'challenging',
	'classes',
	'colored-lighting',
	'combat',
	'competitive',
	'core-shaders',
	'creative-mode',
	'creator-community',
	'crossplay',
	'cursed',
	'custom-content',
	'decoration',
	'dungeons',
	'economy',
	'entities',
	'environment',
	'equipment',
	'factions',
	'fantasy',
	'foliage',
	'fonts',
	'food',
	'game-mechanics',
	'gens',
	'gui',
	'hardcore-mode',
	'high',
	'items',
	'keep-inventory',
	'kitchen-sink',
	'kitpvp',
	'library',
	'lifesteal',
	'lightweight',
	'locale',
	'low',
	'magic',
	'management',
	'media',
	'medium',
	'microgames',
	'minigame',
	'minigames',
	'mmo',
	'mobs',
	'modded',
	'models',
	'multiplayer',
	'network',
	'offline-mode',
	'oneblock',
	'op',
	'optimization',
	'parkour',
	'path-tracing',
	'pbr',
	'personal-worlds',
	'plots',
	'pokemon',
	'potato',
	'prison',
	'pve',
	'pvp',
	'questing',
	'quests',
	'racing',
	'realistic',
	'recording-smp',
	'reflections',
	'roleplay',
	'rpg',
	'screenshot',
	'semi-realistic',
	'shadows',
	'simplistic',
	'skyblock',
	'smp',
	'social',
	'storage',
	'survival-mode',
	'teams',
	'technical',
	'technology',
	'themed',
	'towns',
	'transportation',
	'tweaks',
	'utility',
	'vanilla-like',
	'whitelisted',
	'world-resets',
	'worldgen',
]

export const emojis: Record<string, string> = {}
export const emojiRefs: Record<string, { id: string; name: string }> = {}

const HASH_LENGTH = 8
const NAMED_HASH_RE = /^(.+)_([0-9a-f]{8})$/

function hashFile(file: string): string {
	return createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, HASH_LENGTH)
}

export async function syncEmojis(client: Client): Promise<void> {
	const existing = await client.application!.emojis.fetch()

	const defs = [
		...LOADER_NAMES.map((n) => ({
			key: n,
			baseName: n.replace(/-/g, ''),
			file: join(__dirname, `../assets/loaders/${n}.png`),
		})),
		...CHANNEL_NAMES.map((n) => ({
			key: n,
			baseName: n,
			file: join(__dirname, `../assets/channels/${n}.png`),
		})),
		...PROJECT_TYPE_NAMES.map((n) => ({
			key: n,
			baseName: n,
			file: join(__dirname, `../assets/project-types/${n}.png`),
		})),
		...STAT_NAMES.map((n) => ({
			key: n,
			baseName: n,
			file: join(__dirname, `../assets/stats/${n}.png`),
		})),
		...BRAND_NAMES.map((n) => ({
			key: n,
			baseName: n,
			file: join(__dirname, `../assets/brand/${n}.png`),
		})),
		...ICON_NAMES.map((n) => ({
			key: n,
			baseName: n,
			file: join(__dirname, `../assets/icons/${n}.png`),
		})),
		...CATEGORY_NAMES.map((n) => ({
			key: n,
			baseName: n.replace(/-/g, ''),
			file: join(__dirname, `../assets/categories/${n}.png`),
		})),
	].map((d) => ({ ...d, hash: hashFile(d.file) }))

	// Existing managed emojis are named `${baseName}_${hash}`; index by baseName so we can
	// tell an unchanged icon (hash still matches, reuse it) from a stale one (hash differs,
	// or the def no longer exists, delete it) without ever touching unmanaged emojis.
	const existingByBase = new Map<string, ApplicationEmoji>()
	for (const emoji of existing.values()) {
		const match = NAMED_HASH_RE.exec(emoji.name)
		if (match) existingByBase.set(match[1], emoji)
	}

	const baseNames = new Set(defs.map((d) => d.baseName))
	let removed = 0
	for (const [baseName, emoji] of existingByBase) {
		if (baseNames.has(baseName)) continue
		try {
			await emoji.delete()
			removed++
		} catch (err) {
			log.warn({ name: emoji.name, err }, 'Failed to remove orphaned emoji')
		}
	}

	let uploaded = 0
	let reused = 0
	for (const { key, baseName, file, hash } of defs) {
		const fullName = `${baseName}_${hash}`
		const current = existingByBase.get(baseName)

		if (current?.name === fullName) {
			reused++
			emojis[key] = `<:${current.name}:${current.id}>`
			emojiRefs[key] = { id: current.id, name: current.name }
			continue
		}

		if (current) {
			try {
				await current.delete()
			} catch (err) {
				log.warn({ name: current.name, err }, 'Failed to clear stale emoji')
			}
		}

		try {
			const emoji = await client.application!.emojis.create({
				name: fullName,
				attachment: readFileSync(file),
			})
			uploaded++
			emojis[key] = `<:${emoji.name}:${emoji.id}>`
			emojiRefs[key] = { id: emoji.id, name: emoji.name }
		} catch (err) {
			log.warn({ key, err }, 'Failed to upload emoji')
		}
	}

	log.info({ count: Object.keys(emojis).length, uploaded, reused, removed }, 'Emojis synced')
}
