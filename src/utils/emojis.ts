import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Client } from 'discord.js'

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

const BRAND_NAMES = [
	'modrinth',
	'topgg',
	'discord',
	'kofi',
	'github',
	'gitlab',
	'codeberg',
	'bitbucket',
	'sourcehut',
	'wikigg',
	'fandom',
	'gitbook',
	'readthedocs',
	'curseforge',
	'miraheze',
]

const BUTTON_NAMES = ['download']

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

const BADGE_NAMES = [
	'badge-alpha',
	'badge-plus',
	'badge-early-modpack',
	'badge-early-plugin',
	'badge-early-resourcepack',
	'badge-staff',
	'badge-moderator',
]

export const emojis: Record<string, string> = {}
export const emojiRefs: Record<string, { id: string; name: string }> = {}

export async function syncEmojis(client: Client): Promise<void> {
	const existing = await client.application!.emojis.fetch()

	const defs = [
		...LOADER_NAMES.map((n) => ({
			key: n,
			emojiName: n.replace(/-/g, ''),
			file: join(__dirname, `../assets/loaders/${n}.png`),
		})),
		...CHANNEL_NAMES.map((n) => ({
			key: n,
			emojiName: n,
			file: join(__dirname, `../assets/channels/${n}.png`),
		})),
		...PROJECT_TYPE_NAMES.map((n) => ({
			key: n,
			emojiName: n,
			file: join(__dirname, `../assets/project-types/${n}.png`),
		})),
		...STAT_NAMES.map((n) => ({
			key: n,
			emojiName: n,
			file: join(__dirname, `../assets/stats/${n}.png`),
		})),
		...BRAND_NAMES.map((n) => ({
			key: n,
			emojiName: n,
			file: join(__dirname, `../assets/brand/${n}.png`),
		})),
		...BUTTON_NAMES.map((n) => ({
			key: n,
			emojiName: n,
			file: join(__dirname, `../assets/buttons/${n}.png`),
		})),
		...CATEGORY_NAMES.map((n) => ({
			key: n,
			emojiName: n.replace(/-/g, ''),
			file: join(__dirname, `../assets/categories/${n}.png`),
		})),
		...BADGE_NAMES.map((n) => ({
			key: n,
			emojiName: n.replace(/-/g, ''),
			file: join(__dirname, `../assets/badges/${n.replace('badge-', '')}.png`),
		})),
	]

	const existingByName = new Map(existing.map((e) => [e.name, e]))
	const managedNames = new Set(defs.map((d) => d.emojiName))

	let cleared = 0
	for (const emoji of existing.values()) {
		if (managedNames.has(emoji.name)) continue
		try {
			await emoji.delete()
			cleared++
		} catch (err) {
			log.warn({ name: emoji.name, err }, 'Failed to clear stale emoji')
		}
	}

	let uploaded = 0
	for (const { key, emojiName, file } of defs) {
		const existingEmoji = existingByName.get(emojiName)
		if (existingEmoji) {
			emojis[key] = `<:${existingEmoji.name}:${existingEmoji.id}>`
			emojiRefs[key] = { id: existingEmoji.id, name: existingEmoji.name! }
			continue
		}

		try {
			const emoji = await client.application!.emojis.create({
				name: emojiName,
				attachment: readFileSync(file),
			})
			uploaded++
			emojis[key] = `<:${emoji.name}:${emoji.id}>`
			emojiRefs[key] = { id: emoji.id, name: emoji.name }
		} catch (err) {
			log.warn({ key, err }, 'Failed to upload emoji')
		}
	}

	log.info({ count: Object.keys(emojis).length, uploaded, cleared }, 'Emojis synced')
}
