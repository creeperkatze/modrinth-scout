import { EmbedBuilder } from 'discord.js'

export function buildTrackingPausedNotice(channelId: string) {
	return new EmbedBuilder()
		.setColor(0xd83c3e)
		.setDescription(
			`⏸ Tracking has been paused.\n\nI don't have permission to post update notifications in <#${channelId}>.\n\nAdd the send messages permission in that channel for me, then run \`/tracking resume\`.`,
		)
}
