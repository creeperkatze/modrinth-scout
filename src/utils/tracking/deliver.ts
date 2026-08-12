import { type Client, DiscordAPIError, type NewsChannel, type TextChannel } from 'discord.js'

import { queries } from '../../db/queries.js'
import type { CardPayload } from '../embeds/index.js'
import { buildTrackingPausedNotice } from '../embeds/index.js'
import { createModuleLogger } from '../logger.js'
import type { TrackingSubscription } from './load.js'

const log = createModuleLogger('tracking:deliver')

// 'unreachable' means the guild has to fix something on their side, anything else throws to retry
export type DeliveryOutcome = 'sent' | 'unreachable'

// These error codes mean the channel needs a fix on the Discord server owners side, not ours
function isUnreachableChannelError(err: unknown): err is DiscordAPIError {
	return err instanceof DiscordAPIError && (err.status === 403 || err.status === 404)
}

async function pauseTrackingForUnreachableChannel(
	client: Client,
	guildId: string,
	channelId: string,
) {
	const config = await queries.getServerConfig(guildId)
	if (config?.tracking?.paused) return

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

// Posts one subscription's notifications, pinging its resolved role on the first message only
export async function deliver(
	client: Client,
	subscription: TrackingSubscription,
	payloads: CardPayload[],
	context: Record<string, unknown> = {},
): Promise<DeliveryOutcome> {
	const { guildId, settings } = subscription
	const { channelId, roleId } = settings

	const channel = client.channels.cache.get(channelId) as TextChannel | NewsChannel | undefined
	if (!channel?.isTextBased()) {
		log.warn({ ...context, guildId, channelId, roleId }, 'Channel not found or not text-based')
		await pauseTrackingForUnreachableChannel(client, guildId, channelId)
		return 'unreachable'
	}

	const mention = roleId ? channel.guild.roles.cache.get(roleId)?.toString() : undefined

	try {
		for (let i = 0; i < payloads.length; i++) {
			await channel.send({
				content: i === 0 ? mention : undefined,
				embeds: payloads[i].embeds,
				components: payloads[i].components,
			})
		}
	} catch (err) {
		if (isUnreachableChannelError(err)) {
			log.warn({ ...context, guildId, channelId, err }, 'Failed to notify channel, unreachable')
			await pauseTrackingForUnreachableChannel(client, guildId, channelId)
			return 'unreachable'
		}
		throw err
	}

	return 'sent'
}
