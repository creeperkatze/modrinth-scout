import 'dotenv/config'

import { writeFileSync } from 'node:fs'

import { commands } from '../src/commands/index.js'
import { createCommandRegistry } from '../src/utils/commands.js'

const { getAllSlashCommandData } = createCommandRegistry(commands)
const data = getAllSlashCommandData()

const out = 'commands.json'
writeFileSync(out, JSON.stringify(data, null, 2))

console.log(`Wrote ${data.length} commands to ${out}`)
