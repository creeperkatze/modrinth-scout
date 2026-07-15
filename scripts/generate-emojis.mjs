import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_DIR = join(__dirname, 'svgs')
const OUT_DIR = join(__dirname, '..', 'src', 'assets')

for (const group of readdirSync(SVG_DIR, { withFileTypes: true })) {
	if (!group.isDirectory()) continue

	const groupDir = join(SVG_DIR, group.name)
	const outDir = join(OUT_DIR, group.name)
	mkdirSync(outDir, { recursive: true })

	for (const file of readdirSync(groupDir)) {
		if (!file.endsWith('.svg')) continue

		const name = file.slice(0, -'.svg'.length)
		const svg = readFileSync(join(groupDir, file), 'utf8')
		const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 128 } })
		const png = resvg.render().asPng()
		writeFileSync(join(outDir, `${name}.png`), png)
		console.log(`✓ ${group.name}/${name}.png`)
	}
}
