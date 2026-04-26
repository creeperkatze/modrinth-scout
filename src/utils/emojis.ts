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

const CHANNEL_NAMES = ['release', 'beta', 'alpha']

export const emojis: Record<string, string> = {}

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
		emojis[key] = `<:${emoji.name ?? emojiName}:${emoji.id}>`
	}

	log.info({ count: Object.keys(emojis).length, uploaded }, 'Emojis synced')
}
