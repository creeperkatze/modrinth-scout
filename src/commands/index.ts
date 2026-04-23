import type { ChatInputCommand } from '../types/index.js'
import { helpCommand } from './help.js'
import { pingCommand } from './ping.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { searchCommand } from './search.js'
import { supportCommand } from './support.js'
import { userCommand } from './user.js'

export const commands: ChatInputCommand[] = [
	pingCommand,
	randomCommand,
	searchCommand,
	projectCommand,
	userCommand,
	supportCommand,
	helpCommand,
]
