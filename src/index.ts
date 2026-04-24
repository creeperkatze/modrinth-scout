import 'dotenv/config'

import { Client, Events, GatewayIntentBits } from 'discord.js'

import { commands } from './commands/index.js'
import { createCommandRegistry, deployCommands } from './utils/commands.js'
import { startPoller } from './utils/poller.js'

if (process.argv.includes('--deploy-commands')) {
	await deployCommands(commands)
	process.exit(0)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const { onInteractionCreate } = createCommandRegistry(commands)

client.once(Events.ClientReady, (c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`)
	startPoller(c)
})

client.on(Events.InteractionCreate, onInteractionCreate)

client.login(process.env.DISCORD_TOKEN)
