import 'dotenv/config'

import { Client, Events, GatewayIntentBits } from 'discord.js'

import { commands } from './commands/index.js'
import { supporterPerksEnabled } from './config/supporterPerks.js'
import { connectDb } from './db/index.js'
import { queries } from './db/queries.js'
import { createCommandRegistry, deployCommands } from './utils/commands.js'
import { syncEmojis } from './utils/emojis.js'
import { createModuleLogger } from './utils/logger.js'
import { startPoller } from './utils/poller.js'
import { startWebServer } from './web/index.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const { onInteractionCreate } = createCommandRegistry(commands)
const log = createModuleLogger('app')

client.once(Events.ClientReady, async (c) => {
	const startedAt = Date.now()

	try {
		log.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, 'Discord client ready')

		await connectDb()
		await deployCommands(commands)
		await syncEmojis(c)

		log.info({ guilds: c.guilds.cache.size }, 'Initializing guild configs')
		await Promise.all(c.guilds.cache.map((g) => queries.initServerConfig(g.id)))

		startPoller(c)
		if (supporterPerksEnabled) {
			startWebServer()
		}

		log.info(
			{ tag: c.user.tag, guilds: c.guilds.cache.size, durationMs: Date.now() - startedAt },
			'Bot ready',
		)
	} catch (error) {
		log.fatal({ err: error, durationMs: Date.now() - startedAt }, 'Bot startup failed')
		client.destroy()
		process.exit(1)
	}
})

client.on(Events.GuildCreate, async (guild) => {
	await queries.initServerConfig(guild.id)
	log.info({ guildId: guild.id }, 'Joined guild')
})

client.on(Events.GuildDelete, async (guild) => {
	await queries.deleteServer(guild.id)
	log.info({ guildId: guild.id }, 'Left guild, cleaned up data')
})

client.on(Events.ShardError, (err) => log.error({ err }, 'Discord shard error'))
client.on(Events.ShardDisconnect, (event, id) =>
	log.warn({ shardId: id, code: event.code }, 'Discord shard disconnected'),
)
client.on(Events.ShardReconnecting, (id) => log.info({ shardId: id }, 'Discord shard reconnecting'))

client.on(Events.InteractionCreate, onInteractionCreate)

process.on('unhandledRejection', (reason) => {
	log.fatal({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (error) => {
	log.fatal({ err: error }, 'Uncaught exception')
	process.exit(1)
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.once(signal, () => {
		log.info({ signal }, 'Shutting down')
		client.destroy()
		process.exit(0)
	})
}

client.login(process.env.DISCORD_TOKEN).catch((error) => {
	log.fatal({ err: error }, 'Discord login failed')
	process.exit(1)
})
