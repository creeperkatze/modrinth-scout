import { emojis } from './emojis.js'

export function formatTags(tags: string[]): string {
	return tags
		.map((t) => {
			const emoji = emojis[t.toLowerCase()]
			const label = `\`${t.charAt(0).toUpperCase() + t.slice(1)}\``
			return emoji ? `${emoji} ${label}` : label
		})
		.join(' ')
}
