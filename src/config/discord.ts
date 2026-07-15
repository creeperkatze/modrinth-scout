import { ApplicationIntegrationType, InteractionContextType } from 'discord.js'

// For commands usable anywhere (servers, DMs, user install). Guild-scoped commands shouldn't use these.
export const ANYWHERE_CONTEXTS = [
	InteractionContextType.Guild,
	InteractionContextType.BotDM,
	InteractionContextType.PrivateChannel,
]

export const ANYWHERE_INTEGRATION_TYPES = [
	ApplicationIntegrationType.GuildInstall,
	ApplicationIntegrationType.UserInstall,
]
