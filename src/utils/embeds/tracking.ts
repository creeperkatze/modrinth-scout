import { EmbedBuilder } from 'discord.js'

import { withEmoji } from '../emojis.js'

export function buildTrackingPausedNotice(channelId: string) {
	return new EmbedBuilder()
		.setColor(0xd83c3e)
		.setDescription(
			`⏸ Tracking has been paused.\n\nI don't have permission to post update notifications in <#${channelId}>.\n\nAdd the send messages permission in that channel for me, then run \`/tracking resume\`.`,
		)
}

export function buildTrackingHelp(limits: { projects: number; authors: number }) {
	return new EmbedBuilder()
		.setColor(0x1bd96a)
		.setTitle('How tracking works')
		.setDescription(
			[
				'Every notification setting resolves in this order:',
				"**The entry's own options ➡️ The author it came from ➡️ The server's defaults**",
				'### Defaults',
				'`/tracking setup` sets the channel, ping role, and release types used by everything this server tracks. Run it before tracking anything.',
				'### Overrides',
				`\`/tracking add\` and \`/tracking author add\` each accept \`channel\`, \`role\`, and \`release_type\` (${withEmoji('release', 'release')}, ${withEmoji('beta', 'beta')}, or ${withEmoji('alpha', 'alpha')}). Whatever you set there applies to that entry alone. Whatever you leave empty keeps following the server default, including changes you make to it later.`,
				'### Tracking an author',
				`Tracking a ${withEmoji('user', 'user')} or ${withEmoji('organization', 'organization')} also tracks the projects they already have, plus anything new they publish. Those projects inherit the author's settings, so changing the author's channel or release types moves all of them at once.`,
				'### When a project is tracked both ways',
				'If a project was found through an author and you then add it with `/tracking add`, it detaches from that author. From then on it uses its own settings, ignores later changes to the author, and stays tracked even if you stop tracking the author.',
				'### Limits',
				`This server can track ${withEmoji('mod', `**${limits.projects}**`)} projects and ${withEmoji('user', `**${limits.authors}**`)} authors. Projects found through an author don't count toward the project limit, only the author does.`,
				'### Pausing',
				"`/tracking pause` stops notifications without forgetting anything. If I cant access a notification channel, tracking pauses itself and I'll let you know.",
			].join('\n'),
		)
}
