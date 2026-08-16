import { withEmoji } from './emojis.js'

const titleCase = (tag: string) => tag.charAt(0).toUpperCase() + tag.slice(1)

export function formatTags(tags: string[]): string {
	return tags.map((t) => withEmoji(t.toLowerCase(), `\`${titleCase(t)}\``)).join(' ')
}

export function formatTagsLimited(tags: string[], maxLength = 1024): string {
	const formatted = tags.map((t) => withEmoji(t.toLowerCase(), `\`${titleCase(t)}\``))
	let value = ''
	let shown = 0
	for (const tag of formatted) {
		const candidate = value ? `${value} ${tag}` : tag
		const remaining = formatted.length - shown - 1
		const suffix = remaining > 0 ? ` *(+${remaining} more)*` : ''
		if (candidate.length + suffix.length > maxLength) break
		value = candidate
		shown++
	}
	const extra = formatted.length - shown
	return extra > 0 ? `${value} *(+${extra} more)*`.trim() : value
}

export function formatPlainTags(tags: string[]): string {
	return tags.map((t) => withEmoji(t.toLowerCase(), titleCase(t))).join(' ')
}
