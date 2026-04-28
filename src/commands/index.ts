import type { ChatInputCommand } from '../types/index.js'
import { collectionCommand } from './collection.js'
import { helpCommand } from './help.js'
import { organizationCommand } from './organization.js'
import { pingCommand } from './ping.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { searchCommand } from './search.js'
import { statisticsCommand } from './statistics.js'
import { supportCommand } from './support.js'
import { trackingCommand } from './tracking.js'
import { userCommand } from './user.js'
import { versionCommand } from './version.js'

export const commands: ChatInputCommand[] = [
	pingCommand,
	randomCommand,
	searchCommand,
	projectCommand,
	versionCommand,
	userCommand,
	organizationCommand,
	collectionCommand,
	supportCommand,
	trackingCommand,
	statisticsCommand,
	helpCommand,
]
