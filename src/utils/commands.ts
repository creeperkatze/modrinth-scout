import { Collection, Interaction, REST, Routes, SlashCommandBuilder } from 'discord.js'

import type { ChatInputCommand } from '../types/index.js'

type CooldownKey = `${string}:${string}`

export function createCommandRegistry(
	commands: ChatInputCommand[],
	opts: { defaultCooldownSeconds?: number } = {},
) {
	const { defaultCooldownSeconds = 3 } = opts
	const map: Map<string, ChatInputCommand> = new Map(commands.map((c) => [c.meta.name, c]))
	const cooldowns = new Collection<CooldownKey, number>()

	function checkCooldown(userId: string, name: string, seconds: number) {
		const key: CooldownKey = `${userId}:${name}`
		const now = Date.now()
		const until = cooldowns.get(key)
		if (until && until > now) return Math.ceil((until - now) / 1000)
		cooldowns.set(key, now + seconds * 1000)
		return 0
	}

	async function onInteractionCreate(interaction: Interaction) {
		if (!interaction.isChatInputCommand()) return

		const cmd = map.get(interaction.commandName)
		if (!cmd) return

		if (cmd.meta.guildOnly && !interaction.inGuild()) return
		if (cmd.meta.dmOnly && interaction.inGuild()) return

		const cd = cmd.meta.cooldownSeconds ?? defaultCooldownSeconds
		if (cd > 0) {
			const remain = checkCooldown(interaction.user.id, cmd.meta.name, cd)
			if (remain > 0) {
				await interaction.reply({
					content: `Please wait ${remain}s before using /${cmd.meta.name} again.`,
					flags: 'Ephemeral',
				})
				return
			}
		}

		try {
			await Promise.resolve(cmd.execute(interaction))
		} catch (error) {
			console.error(error)
			const reply = {
				content: 'There was an error while executing this command!',
				flags: 'Ephemeral' as const,
			}
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(reply)
			} else {
				await interaction.reply(reply)
			}
		}
	}

	function getAllSlashCommandData() {
		return Array.from(map.values()).map((c) => {
			const builder = c.data as SlashCommandBuilder
			if (c.meta.defaultMemberPermissions !== undefined) {
				builder.setDefaultMemberPermissions(c.meta.defaultMemberPermissions)
			}
			if (c.meta.dmPermission !== undefined) {
				builder.setDMPermission(c.meta.dmPermission)
			}
			return builder.toJSON()
		})
	}

	return { onInteractionCreate, getAllSlashCommandData }
}

export async function deployCommands(commands: ChatInputCommand[]) {
	const { CLIENT_ID, DISCORD_TOKEN, GUILD_ID } = process.env

	if (!CLIENT_ID || !DISCORD_TOKEN || !GUILD_ID) {
		throw new Error('Missing CLIENT_ID, DISCORD_TOKEN, or GUILD_ID in environment')
	}

	const rest = new REST().setToken(DISCORD_TOKEN)
	const data = commands.map((c) => c.data.toJSON())

	await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: data })
	console.log('Successfully registered application commands.')
}
