import { describe, expect, it } from 'vitest'

import { normalizeChangelog, truncateChangelog } from '../src/utils/changelog.js'

describe('normalizeChangelog', () => {
	it('removes blank lines around headings', () => {
		const input =
			'### Added\n\n- Backported to Minecraft 1.21.1.\n- German translation.\n\n### Changed\n\n- Works with older loaders.'
		expect(normalizeChangelog(input)).toBe(
			'### Added\n- Backported to Minecraft 1.21.1.\n- German translation.\n### Changed\n- Works with older loaders.',
		)
	})

	it('normalizes windows line endings and trailing whitespace', () => {
		expect(normalizeChangelog('## Fixed   \r\n\r\n- Crash   \r\n')).toBe('## Fixed\n- Crash')
	})

	it('tightens loose lists and lists after a paragraph', () => {
		expect(normalizeChangelog('**New Additions:**\n\n- One\n\n- Two\n\n* Three')).toBe(
			'**New Additions:**\n- One\n- Two\n* Three',
		)
	})

	it('keeps paragraph breaks', () => {
		expect(normalizeChangelog('First paragraph.\n\nSecond paragraph.')).toBe(
			'First paragraph.\n\nSecond paragraph.',
		)
	})

	it('leaves code blocks untouched', () => {
		const input = '```yaml\n# Comment\n\nkey: value\n```'
		expect(normalizeChangelog(input)).toBe(input)
	})

	it('clamps headings Discord cannot render', () => {
		expect(normalizeChangelog('#### Fixes\n\n- Crash')).toBe('### Fixes\n- Crash')
	})

	it('never writes bold as underscores', () => {
		expect(normalizeChangelog('*__Note:__ Looking for addons*')).toBe(
			'_**Note:** Looking for addons_',
		)
		expect(normalizeChangelog('__bold__ and *em*')).toBe('**bold** and _em_')
	})

	it('turns multi-line setext headings back into text', () => {
		expect(normalizeChangelog('New mods:\nCant Breathe\n------------\nMore')).toBe(
			'New mods:\nCant Breathe\n\nMore',
		)
		expect(normalizeChangelog('Title\n=====\n- Item')).toBe('# Title\n- Item')
	})

	it('removes thematic breaks', () => {
		expect(normalizeChangelog('## Added\n- One\n\n---\n\n## Fixed\n- Two')).toBe(
			'## Added\n- One\n## Fixed\n- Two',
		)
	})

	it('turns images into links', () => {
		expect(normalizeChangelog('![Banner](https://example.com/banner.png)')).toBe(
			'[Banner](https://example.com/banner.png)',
		)
		expect(normalizeChangelog('[![Discord](https://img.shields.io/x)](https://discord.gg/x)')).toBe(
			'[Discord](https://discord.gg/x)',
		)
	})

	it('writes link urls without escapes', () => {
		expect(normalizeChangelog('[Picture](https://cdn.example.com/a.png?ex=1&is=2&)')).toBe(
			'[Picture](https://cdn.example.com/a.png?ex=1&is=2&)',
		)
		expect(normalizeChangelog('[Wiki](<https://example.com/Foo (bar)>)')).toBe(
			'[Wiki](https://example.com/Foo%20%28bar%29)',
		)
	})

	it('inlines reference links', () => {
		expect(normalizeChangelog('See [the docs][docs].\n\n[docs]: https://example.com/docs')).toBe(
			'See [the docs](https://example.com/docs).',
		)
	})

	it('keeps bare urls bare', () => {
		expect(normalizeChangelog('Changelog: https://example.com/changelog')).toBe(
			'Changelog: https://example.com/changelog',
		)
	})

	it('strips html but keeps placeholders', () => {
		expect(
			normalizeChangelog(
				'<p><strong>Requirements:</strong></p>\n<ul>\n  <li>Java 17</li>\n  <li>Fabric</li>\n</ul>',
			),
		).toBe('Requirements:\n- Java 17\n- Fabric')
		expect(
			normalizeChangelog('<img src="https://example.com/a.png" alt="Header">\n\n- Fixed'),
		).toBe('- Fixed')
		expect(normalizeChangelog('Usage: /<command> <action>')).toBe('Usage: /<command> <action>')
	})

	it('turns inline br into a newline', () => {
		expect(normalizeChangelog('Line one<br>Line two')).toBe('Line one\nLine two')
	})

	it('never writes whitespace as character references', () => {
		expect(normalizeChangelog('Updated textures \n<br>\nMore')).toBe('Updated textures\nMore')
		expect(normalizeChangelog('<p>&#9888;&#65039; Before you update</p>')).toBe(
			'⚠️ Before you update',
		)
		expect(normalizeChangelog('First\n\n \n\n#### **Added:**')).toBe('First\n### **Added:**')
	})

	it('wraps tables in a code block', () => {
		expect(normalizeChangelog('| Mod | Version |\n| --- | --- |\n| Sodium | 0.6 |')).toBe(
			'```\n| Mod | Version |\n| --- | --- |\n| Sodium | 0.6 |\n```',
		)
	})
})

describe('truncateChangelog', () => {
	it('returns short changelogs unchanged', () => {
		expect(truncateChangelog('- Fixed', 100)).toBe('- Fixed')
	})

	it('cuts on a line boundary', () => {
		expect(truncateChangelog('- First line\n- Second line', 18)).toBe('- First line\n...')
	})

	it('closes a code block cut in half', () => {
		expect(truncateChangelog('Config:\n```yaml\na: 1\nb: 2\n```', 20)).toBe(
			'Config:\n```yaml\na: 1\n```\n...',
		)
	})
})
