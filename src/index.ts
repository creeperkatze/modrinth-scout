import 'dotenv/config'

import { Client, Events, GatewayIntentBits } from 'discord.js'

import { commands } from './commands/index.js'
import { connectDb } from './db/index.js'
import { logger } from './utils/logger.js'
import { createCommandRegistry, deployCommands } from './utils/commands.js'
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

client.on(Events.InteractionCreate, onInteractionCreate)

client.login(process.env.DISCORD_TOKEN)
