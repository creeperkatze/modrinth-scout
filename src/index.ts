import 'dotenv/config'

import { Client, Events, GatewayIntentBits } from 'discord.js'

import { commands } from './commands/index.js'
import { connectDb } from './db/index.js'
import { createCommandRegistry, deployCommands } from './utils/commands.js'
import { logger } from './utils/logger.js'
import { startPoller } from './utils/poller.js'

await connectDb()

if (process.argv.includes('--deploy-commands')) {
	await deployCommands(commands)
	process.exit(0)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const { onInteractionCreate } = createCommandRegistry(commands)

client.once(Events.ClientReady, (c) => {
	logger.info({ tag: c.user.tag }, 'Bot ready')
	startPoller(c)
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
