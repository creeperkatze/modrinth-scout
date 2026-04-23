import type {
	ChatInputCommandInteraction,
	PermissionResolvable,
	SlashCommandBuilder,
} from 'discord.js'

export type CommandCategory = 'general' | 'moderation' | 'utility'

export interface CommandMeta {
	name: string
	description: string
	category?: CommandCategory
	guildOnly?: boolean
	dmOnly?: boolean
	allowedGuilds?: string[]
	allowedUsers?: string[]
	cooldownSeconds?: number
	defaultMemberPermissions?: PermissionResolvable
}

export interface ChatInputCommand {
	data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>
	meta: CommandMeta
	execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void
}

export type CommandMap = Map<string, ChatInputCommand>
