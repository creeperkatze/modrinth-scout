import { type Client, DiscordAPIError } from 'discord.js'

import { queries } from '../../db/queries.js'
import { buildTrackingPausedNotice } from '../embeds/index.js'
import { createModuleLogger } from '../logger.js'

const log = createModuleLogger('tracking:shared')

// These error codes mean the channel needs a fix on the Discord server owners side, not ours
export function isUnreachableChannelError(err: unknown): err is DiscordAPIError {
	return err instanceof DiscordAPIError && (err.status === 403 || err.status === 404)
}

export async function pauseTrackingForUnreachableChannel(
	client: Client,
	guildId: string,
	channelId: string,
) {
	const config = await queries.getServerConfig(guildId)
	if (config?.trackingPaused) return

	await queries.pauseTracking(guildId)
	log.warn({ guildId, channelId }, 'Tracking paused, notification channel is unreachable')

	const guild = client.guilds.cache.get(guildId)
	const systemChannel = guild?.systemChannel
	if (!systemChannel?.isTextBased()) return

	try {
		await systemChannel.send({ embeds: [buildTrackingPausedNotice(channelId)] })
	} catch (err) {
		log.debug({ guildId, err }, 'Could not post pause notice to system channel')
	}
}
