import type { Html, Link, Nodes, Parents, PhrasingContent, Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { defaultHandlers, toMarkdown, type Join } from 'mdast-util-to-markdown'
import { gfm } from 'micromark-extension-gfm'
import { SKIP, visit } from 'unist-util-visit'

import { createModuleLogger } from './logger.js'

const log = createModuleLogger('changelog')

const FENCE = /^\s*(```|~~~)/
const KNOWN_TAG =
	/<\/?(a|abbr|b|big|blockquote|br|center|code|del|details|div|em|font|h[1-6]|hr|i|iframe|img|ins|kbd|li|mark|ol|p|picture|pre|s|small|source|span|strike|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|tr|u|ul|video)\b[^>]*>/gi
const BLOCK_END =
	/<\/(blockquote|details|div|h[1-6]|li|ol|p|pre|summary|table|tr|ul)>|<br\s*\/?>|<hr\b[^>]*>/gi
const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&nbsp;': ' ',
}

// Strips real HTML down to its text, leaving placeholders like `<player>` alone
function htmlToText(html: string): string {
	return html
		.replace(/<!--[\s\S]*?(-->|$)/g, '')
		.replace(/<(iframe|video)\b[\s\S]*?<\/\1>/gi, '')
		.replace(/<li\b[^>]*>\s*/gi, '- ')
		.replace(BLOCK_END, '\n')
		.replace(KNOWN_TAG, '')
		.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
		.split('\n')
		.map((line) => line.trim())
		.join('\n')
		.replace(/\n{2,}/g, '\n')
		.trim()
}

function imageText(alt: string | null | undefined, url: string): string {
	return alt?.trim() || url
}

function transform(tree: Root, source: string): void {
	visit(tree, (node: Nodes, index, parent: Parents | undefined) => {
		if (node.type === 'heading') node.depth = Math.min(node.depth, 3) as 1 | 2 | 3
		if (node.type === 'list' || node.type === 'listItem') node.spread = false
		if (!parent || index === undefined) return

		if (node.type === 'thematicBreak') {
			parent.children.splice(index, 1)
			return [SKIP, index]
		}

		if (node.type === 'html') {
			if (/^<br\s*\/?>$/i.test(node.value.trim()) && parent.type !== 'root') {
				parent.children[index] = { type: 'break' }
				return SKIP
			}
			const value = htmlToText(node.value)
			if (value) {
				;(node as Html).value = value
				return SKIP
			}
			parent.children.splice(index, 1)
			return [SKIP, index]
		}

		if (node.type === 'image') {
			const text = { type: 'text', value: imageText(node.alt, node.url) } as const
			parent.children[index] =
				parent.type === 'link' ? text : { type: 'link', url: node.url, children: [text] }
			return SKIP
		}

		if (node.type === 'table' && node.position) {
			const value = source.slice(node.position.start.offset, node.position.end.offset)
			parent.children[index] = { type: 'code', value }
			return SKIP
		}
	})
}

function isBareLink(node: Link): boolean {
	const [child] = node.children as PhrasingContent[]
	return (
		node.children.length === 1 &&
		child.type === 'text' &&
		!node.title &&
		(child.value === node.url || `mailto:${child.value}` === node.url)
	)
}

// Discord renders blank lines literally and headings already carry their own spacing
const join: Join[] = [
	(left, right) => {
		if (left.type === 'heading' || right.type === 'heading') return 0
		if (right.type === 'list' && (left.type === 'paragraph' || left.type === 'list')) return 0
		return undefined
	},
]

export function normalizeChangelog(changelog: string): string {
	try {
		const source = changelog.replace(/\r\n?/g, '\n')
		const tree = fromMarkdown(source, {
			extensions: [gfm()],
			mdastExtensions: [gfmFromMarkdown()],
		})
		transform(tree, source)
		return toMarkdown(tree, {
			extensions: [gfmToMarkdown()],
			bullet: '-',
			rule: '-',
			fences: true,
			join,
			handlers: {
				break: () => '\n',
				link: (node: Link, parent, state, info) =>
					isBareLink(node) ? node.url : defaultHandlers.link(node, parent, state, info),
			},
		}).trim()
	} catch (err) {
		log.warn({ err }, 'Failed to normalize changelog')
		return changelog.trim()
	}
}

export function truncateChangelog(changelog: string, maxLength: number): string {
	if (changelog.length <= maxLength) return changelog
	const cut = changelog.lastIndexOf('\n', maxLength)
	let truncated = changelog.slice(0, cut > 0 ? cut : maxLength).trimEnd()
	let openFence: string | undefined
	for (const line of truncated.split('\n')) {
		const marker = FENCE.exec(line)?.[1]
		if (marker) openFence = openFence ? undefined : marker
	}
	if (openFence) truncated += `\n${openFence}`
	return truncated + '\n...'
}
