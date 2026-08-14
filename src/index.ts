import 'dotenv/config'

import { Client, Events, GatewayIntentBits } from 'discord.js'

import { commands } from './commands/index.js'
import { connectDb } from './db/index.js'
import { queries } from './db/queries.js'
import { handleMessageCreate } from './utils/autoEmbeds.js'
import { createCommandRegistry, deployCommands } from './utils/commands.js'
import { syncEmojis } from './utils/emojis.js'
import { startHeartbeat } from './utils/heartbeat.js'
import { createModuleLogger } from './utils/logger.js'
import { donatorGuildCount, guildCount } from './utils/metrics.js'
import { postTopggStats, startTopggStats } from './utils/topgg.js'
import { startTracking } from './utils/tracking/index.js'
import { startWebServer } from './web/index.js'

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
})
const { onInteractionCreate } = createCommandRegistry(commands)
const log = createModuleLogger('app')

function waitForReady(): Promise<Client<true>> {
	return new Promise((resolve, reject) => {
		client.once(Events.ClientReady, resolve)
		client.login(process.env.DISCORD_TOKEN).catch(reject)
	})
}

async function main() {
	const startedAt = Date.now()

	await connectDb()

	const readyClient = await waitForReady()
	log.info(
		{ tag: readyClient.user.tag, guilds: readyClient.guilds.cache.size },
		'Discord client ready',
	)

	await deployCommands(commands)
	await syncEmojis(readyClient)

	log.info({ guilds: readyClient.guilds.cache.size }, 'Initializing guild configs')
	await Promise.all(
		readyClient.guilds.cache.map((g) => queries.initGuildConfig(g.id, g.name, g.memberCount)),
	)
	guildCount.set(readyClient.guilds.cache.size)
	donatorGuildCount.set(await queries.countDonatorGuilds())

	startTracking(readyClient)
	startWebServer()
	startHeartbeat()
	startTopggStats(readyClient)

	log.info(
		{
			tag: readyClient.user.tag,
			guilds: readyClient.guilds.cache.size,
			durationMs: Date.now() - startedAt,
		},
		'Bot ready',
	)
}

client.on(Events.GuildCreate, async (guild) => {
	await queries.initGuildConfig(guild.id, guild.name, guild.memberCount)
	guildCount.inc()
	postTopggStats(guild.client)
	log.info({ guildId: guild.id, name: guild.name }, 'Joined guild')
})

client.on(Events.GuildDelete, async (guild) => {
	const config = await queries.getGuildConfig(guild.id)
	await queries.deleteGuild(guild.id)
	guildCount.dec()
	if (config?.isDonator) donatorGuildCount.dec()
	postTopggStats(guild.client)
	log.info({ guildId: guild.id, name: config?.name ?? guild.name }, 'Left guild, cleaned up data')
})

client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
	if (oldGuild.name === newGuild.name) return
	await queries.initGuildConfig(newGuild.id, newGuild.name, newGuild.memberCount)
	log.info({ guildId: newGuild.id, from: oldGuild.name, to: newGuild.name }, 'Guild renamed')
})

client.on(Events.GuildUnavailable, (guild) =>
	log.warn({ guildId: guild.id }, 'Guild unavailable, likely a server outage'),
)

client.on(Events.Error, (err) => log.error({ err }, 'Discord client error'))
client.on(Events.Warn, (message) => log.warn({ message }, 'Discord client warning'))
client.on(Events.ShardError, (err) => log.error({ err }, 'Discord shard error'))
client.on(Events.ShardDisconnect, (event, id) =>
	log.warn({ shardId: id, code: event.code }, 'Discord shard disconnected'),
)
client.on(Events.ShardReconnecting, (id) => log.info({ shardId: id }, 'Discord shard reconnecting'))
client.on(Events.ShardResume, (id, replayedEvents) =>
	log.info({ shardId: id, replayedEvents }, 'Discord shard resumed'),
)
client.on(Events.Invalidated, () => {
	log.fatal('Discord session invalidated, exiting for restart')
	process.exit(1)
})

client.on(Events.InteractionCreate, onInteractionCreate)

client.on(Events.MessageCreate, (message) => {
	handleMessageCreate(message).catch((err) =>
		log.error(
			{ err, messageId: message.id, guildId: message.guildId },
			'Auto embed handling failed',
		),
	)
})

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

main().catch((error) => {
	log.fatal({ err: error }, 'Bot startup failed')
	client.destroy()
	process.exit(1)
})
