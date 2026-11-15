import type { Definition, Link, Nodes, Parents, PhrasingContent, Root, Text } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown, type Info, type Join, type State } from 'mdast-util-to-markdown'
import { gfm } from 'micromark-extension-gfm'
import { parseEntities } from 'parse-entities'
import { SKIP, visit } from 'unist-util-visit'

import { createModuleLogger } from './logger.js'

const log = createModuleLogger('changelog')

// Code blocks can also open inside list items or quotes
const FENCE = /^[\s>]*(?:(?:[-*+]|\d+[.)])\s+)?```/
// Only real tags are stripped, so placeholders like `<player>` survive
const HTML_TAG =
	/<\/?(a|b|br|center|code|details|div|em|font|h[1-6]|hr|i|iframe|img|li|ol|p|pre|span|strong|summary|table|tbody|td|th|thead|tr|u|ul)\b[^>]*>/gi
const HTML_BREAK = /<br\s*\/?>|<\/(div|h[1-6]|li|p|tr)>/gi

function parse(markdown: string): Root {
	return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
}

function htmlToText(html: string): string {
	const text = html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(HTML_BREAK, '\n')
		.replace(HTML_TAG, '')
	return parseEntities(text, { nonTerminated: false })
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join('\n')
}

function imageToLink(alt: string | null | undefined, url: string, parent: Parents): Link | Text {
	const text: Text = { type: 'text', value: alt?.trim() || 'Image' }
	return parent.type === 'link' || parent.type === 'linkReference'
		? text
		: { type: 'link', url, children: [text] }
}

function transform(tree: Root, source: string): void {
	const definitions = new Map<string, Definition>()
	visit(tree, 'definition', (node) => {
		definitions.set(node.identifier, node)
	})

	visit(tree, (node: Nodes, index, parent: Parents | undefined) => {
		// Discord only has h1-h3 and tight lists
		if (node.type === 'heading') node.depth = Math.min(node.depth, 3) as 1 | 2 | 3
		if (node.type === 'list' || node.type === 'listItem') node.spread = false
		if (!parent || index === undefined) return

		switch (node.type) {
			case 'thematicBreak':
			case 'definition':
				parent.children.splice(index, 1)
				return [SKIP, index]
			case 'linkReference':
				parent.children[index] = {
					type: 'link',
					url: definitions.get(node.identifier)?.url ?? '',
					children: node.children,
				}
				return
			case 'imageReference':
				parent.children[index] = imageToLink(
					node.alt,
					definitions.get(node.identifier)?.url ?? '',
					parent,
				)
				return SKIP
			case 'image':
				parent.children[index] = imageToLink(node.alt, node.url, parent)
				return SKIP
			case 'table':
				parent.children[index] = {
					type: 'code',
					value: source.slice(node.position?.start.offset, node.position?.end.offset),
				}
				return SKIP
			case 'html': {
				if (/^<br\s*\/?>$/i.test(node.value.trim()) && parent.type === 'paragraph') {
					parent.children[index] = { type: 'break' }
					return SKIP
				}
				const value = htmlToText(node.value)
				if (!value) {
					parent.children.splice(index, 1)
					return [SKIP, index]
				}
				// Block HTML swallows following Markdown like headings, so parse what is left once the tags are gone
				if (
					value !== node.value &&
					(parent.type === 'root' || parent.type === 'listItem' || parent.type === 'blockquote')
				) {
					parent.children.splice(index, 1, ...(parse(value).children as typeof parent.children))
					return index
				}
				node.value = value
				return SKIP
			}
		}
	})

	// Trailing `<br>`s and paragraphs emptied by stripped HTML would add extra blank lines
	visit(tree, 'paragraph', (node, index, parent) => {
		while (node.children.at(-1)?.type === 'break') node.children.pop()
		if (node.children.length > 0 || !parent || index === undefined) return
		parent.children.splice(index, 1)
		return [SKIP, index]
	})
}

// Discord does not unescape link urls, so write them raw and only percent-encode what ends the link
function link(node: Link, _: Parents | undefined, state: State, info: Info): string {
	const [child] = node.children as PhrasingContent[]
	if (node.children.length === 1 && child.type === 'text' && child.value === node.url)
		return node.url

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
		(char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
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

// Outside code: decode the `&#x..;` the serializer writes next to `*` and collapse repeated blank lines
function cleanUp(markdown: string): string {
	let inFence = false
	const decoded = markdown
		.split('\n')
		.map((line) => {
			if (FENCE.test(line)) inFence = !inFence
			else if (!inFence)
				return line.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
					String.fromCodePoint(parseInt(hex, 16)),
				)
			return line
		})
		.join('\n')

	inFence = false
	const lines: string[] = []
	for (const line of decoded.split('\n')) {
		if (FENCE.test(line)) inFence = !inFence
		const blank = !inFence && line.trim() === ''
		if (blank && lines.at(-1) === '') continue
		lines.push(blank ? '' : line)
	}
	return lines.join('\n').trim()
}

export function normalizeChangelog(changelog: string): string {
	try {
		const source = changelog.replace(/\r\n?/g, '\n')
		const tree = parse(source)
		transform(tree, source)
		return cleanUp(
			toMarkdown(tree, {
				extensions: [gfmToMarkdown()],
				bullet: '-',
				// Discord reads `__` as underline, so keep `*` free for bold
				emphasis: '_',
				strong: '*',
				fences: true,
				join,
				handlers: { break: () => '\n', link },
			}),
		)
	} catch (err) {
		log.warn({ err }, 'Failed to normalize changelog')
		return changelog.trim()
	}
}

export function truncateChangelog(changelog: string, maxLength: number): string {
	if (changelog.length <= maxLength) return changelog
	const cut = changelog.lastIndexOf('\n', maxLength)
	const lines = changelog
		.slice(0, cut > 0 ? cut : maxLength)
		.trimEnd()
		.split('\n')
	let inFence = false
	for (const line of lines) if (FENCE.test(line)) inFence = !inFence
	// Drop a fence opened on the last line instead of leaving an empty code block
	if (inFence && FENCE.test(lines.at(-1) ?? '')) {
		lines.pop()
		inFence = false
	}
	return `${lines.join('\n').trimEnd()}${inFence ? '\n```' : ''}\n...`
}
