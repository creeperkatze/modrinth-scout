import { withEmoji } from './emojis.js'

const titleCase = (tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1)

export function formatTags(tags: string[]): string {
	return tags.map((t) => withEmoji(t.toLowerCase(), `\`${titleCase(t)}\``)).join(' ')
}

export function formatPlainTags(tags: string[]): string {
	return tags.map((t) => withEmoji(t.toLowerCase(), titleCase(t))).join(' ')
}
