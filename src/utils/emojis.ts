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

const BRAND_NAMES = ['modrinth']

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
	]

	let uploaded = 0
	for (const { key, emojiName, file } of defs) {
		let emoji = existing.find((e) => e.name === emojiName)
		if (!emoji) {
			try {
				emoji = await client.application!.emojis.create({
					name: emojiName,
					attachment: readFileSync(file),
				})
				uploaded++
			} catch (err) {
				log.warn({ key, err }, 'Failed to upload emoji')
				continue
			}
		}
		const name = emoji.name ?? emojiName
		emojis[key] = `<:${name}:${emoji.id}>`
		emojiRefs[key] = { id: emoji.id, name }
	}

	log.info({ count: Object.keys(emojis).length, uploaded }, 'Emojis synced')
}
