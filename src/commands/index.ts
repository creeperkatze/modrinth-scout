import { usesDonatorPerks } from '../config/donatorPerks.js'
import { usesLinking } from '../config/linking.js'
import type { ChatInputCommand, ContextMenuCommand } from '../types/index.js'
import { accountCommand } from './account.js'
import { collectionCommand } from './collection.js'
import { donateCommand } from './donate.js'
import { helpCommand } from './help.js'
import { identifyCommand, identifyContextMenu } from './identify.js'
import { lookupContextMenu } from './lookup.js'
import { optionsCommand } from './options.js'
import { organizationCommand } from './organization.js'
import { pingCommand } from './ping.js'
import { profileContextMenu } from './profile.js'
import { projectCommand } from './project.js'
import { randomCommand } from './random.js'
import { rolesCommand } from './roles.js'
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
	...(usesLinking ? [accountCommand, rolesCommand] : []),
	...(usesDonatorPerks ? [donateCommand] : []),
	trackingCommand,
	optionsCommand,
	statisticsCommand,
	voteCommand,
	helpCommand,
]

export const contextMenuCommands: ContextMenuCommand[] = [
	...(usesLinking ? [profileContextMenu] : []),
	lookupContextMenu,
	identifyContextMenu,
]
