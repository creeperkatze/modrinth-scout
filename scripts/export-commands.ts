import 'dotenv/config'

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { commands } from '../src/commands/index.js'
import { getSlashCommandsData } from '../src/utils/commands.js'

const data = getSlashCommandsData(commands)

const out = fileURLToPath(new URL('commands.json', import.meta.url))
writeFileSync(out, JSON.stringify(data, null, 2))

console.log(`Wrote ${data.length} commands to ${out}`)
