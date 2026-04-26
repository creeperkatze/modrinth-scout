import 'dotenv/config'

import { Client, Events, GatewayIntentBits } from 'discord.js'

import { commands } from './commands/index.js'
import { connectDb } from './db/index.js'
import { queries } from './db/queries.js'
import { createCommandRegistry, deployCommands } from './utils/commands.js'
import { syncEmojis } from './utils/emojis.js'
import { logger } from './utils/logger.js'
import { startPoller } from './utils/poller.js'
import { startWebServer } from './web/index.js'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const { onInteractionCreate } = createCommandRegistry(commands)

client.once(Events.ClientReady, async (c) => {
	await connectDb()
	await deployCommands(commands)
	await syncEmojis(c)
	await Promise.all(c.guilds.cache.map((g) => queries.initServerConfig(g.id)))
	logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, 'Bot ready')
	startPoller(c)
	startWebServer()
})

client.on(Events.GuildCreate, async (guild) => {
	await queries.initServerConfig(guild.id)
	logger.info({ guildId: guild.id }, 'Joined guild')
})

client.on(Events.GuildDelete, async (guild) => {
	await queries.deleteServer(guild.id)
	logger.info({ guildId: guild.id }, 'Left guild, cleaned up data')
})

client.on(Events.ShardError, (err) => logger.error({ err }, 'Discord shard error'))
client.on(Events.ShardDisconnect, (event, id) =>
	logger.warn({ shardId: id, code: event.code }, 'Discord shard disconnected'),
)
client.on(Events.ShardReconnecting, (id) =>
	logger.info({ shardId: id }, 'Discord shard reconnecting'),
)

client.on(Events.InteractionCreate, onInteractionCreate)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.once(signal, () => {
		logger.info({ signal }, 'Shutting down')
		process.exit(0)
	})
}

client.login(process.env.DISCORD_TOKEN)
