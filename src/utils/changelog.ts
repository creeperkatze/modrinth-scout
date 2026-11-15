import type {
	Definition,
	Heading,
	Html,
	Link,
	Nodes,
	Parents,
	PhrasingContent,
	Root,
	Text,
} from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown, type Info, type Join, type State } from 'mdast-util-to-markdown'
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
		.replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
			const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
			return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
		})
		.split('\n')
		.map((line) => line.trim())
		.join('\n')
		.replace(/\n{2,}/g, '\n')
		.trim()
}

function imageToPhrasing(
	alt: string | null | undefined,
	url: string,
	parent: Parents,
): Link | Text {
	const text: Text = { type: 'text', value: alt?.trim() || url }
	return parent.type === 'link' || parent.type === 'linkReference'
		? text
		: { type: 'link', url, children: [text] }
}

function spansLines(node: Heading): boolean {
	let found = false
	visit(node, (child) => {
		if (child.type === 'break' || (child.type === 'text' && child.value.includes('\n')))
			found = true
	})
	return found
}

function transform(tree: Root, source: string): void {
	const definitions = new Map<string, Definition>()
	visit(tree, 'definition', (node) => {
		definitions.set(node.identifier, node)
	})

	visit(tree, (node: Nodes, index, parent: Parents | undefined) => {
		if (node.type === 'heading') node.depth = Math.min(node.depth, 3) as 1 | 2 | 3
		if (node.type === 'list' || node.type === 'listItem') node.spread = false
		if (!parent || index === undefined) return

		// Multi-line setext headings are usually text above a `---` divider and Discord can't render them
		if (node.type === 'heading' && spansLines(node)) {
			parent.children[index] = { type: 'paragraph', children: node.children }
			return
		}

		if (node.type === 'thematicBreak' || node.type === 'definition') {
			parent.children.splice(index, 1)
			return [SKIP, index]
		}

		// Discord has no reference links, so inline the definition's url
		if (node.type === 'linkReference') {
			const url = definitions.get(node.identifier)?.url ?? ''
			parent.children[index] = { type: 'link', url, children: node.children }
			return
		}
		if (node.type === 'imageReference') {
			const url = definitions.get(node.identifier)?.url ?? ''
			parent.children[index] = imageToPhrasing(node.alt, url, parent)
			return SKIP
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
			parent.children[index] = imageToPhrasing(node.alt, node.url, parent)
			return SKIP
		}

		if (node.type === 'table' && node.position) {
			const value = source.slice(node.position.start.offset, node.position.end.offset)
			parent.children[index] = { type: 'code', value }
			return SKIP
		}
	})

	// Whitespace at a line edge would be written as `&#x20;`, which Discord shows literally
	visit(tree, 'text', (node, index, parent) => {
		if (!parent || index === undefined) return
		if (parent.type !== 'paragraph' && parent.type !== 'heading') return
		const prev = parent.children[index - 1]
		const next = parent.children[index + 1]
		if (!next || next.type === 'break') node.value = node.value.trimEnd()
		if (!prev || prev.type === 'break') node.value = node.value.trimStart()
	})

	visit(tree, 'paragraph', (node, index, parent) => {
		if (!parent || index === undefined) return
		if (node.children.some((child) => child.type !== 'text' || child.value !== '')) return
		parent.children.splice(index, 1)
		return [SKIP, index]
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

// Discord does not unescape link urls, so write them raw and only percent-encode what ends the link
function link(node: Link, _: Parents | undefined, state: State, info: Info): string {
	if (isBareLink(node)) return node.url
	const exitLink = state.enter('link')
	const exitLabel = state.enter('label')
	const tracker = state.createTracker(info)
	let value = tracker.move('[')
	value += tracker.move(
		state.containerPhrasing(node, { before: value, after: '](', ...tracker.current() }),
	)
	exitLabel()
	exitLink()
	const url = node.url.replace(
		/[\s()<>]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
	)
	return `${value}](${url})`
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
			// Discord reads `__` as underline, so keep `*` free for bold
			emphasis: '_',
			strong: '*',
			fences: true,
			join,
			handlers: {
				break: () => '\n',
				link,
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
