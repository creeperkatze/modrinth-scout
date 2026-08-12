import { usesDonatorPerks } from '../config/donatorPerks.js'
import type { ChatInputCommand } from '../types/index.js'
import { collectionCommand } from './collection.js'
import { donateCommand } from './donate.js'
import { helpCommand } from './help.js'
import { identifyCommand } from './identify.js'
import { optionsCommand } from './options.js'
import { organizationCommand } from './organization.js'
import { pingCommand } from './ping.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { searchCommand } from './search.js'
import { statisticsCommand } from './statistics.js'
import { trackingCommand } from './tracking.js'
import { userCommand } from './user.js'
import { versionCommand } from './version.js'
import { voteCommand } from './vote.js'

export const commands: ChatInputCommand[] = [
	pingCommand,
	randomCommand,
	searchCommand,
	identifyCommand,
	projectCommand,
	versionCommand,
	userCommand,
	organizationCommand,
	collectionCommand,
	...(usesDonatorPerks ? [donateCommand] : []),
	trackingCommand,
	optionsCommand,
	statisticsCommand,
	voteCommand,
	helpCommand,
]
