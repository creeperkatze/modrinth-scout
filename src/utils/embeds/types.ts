import type { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js'

export interface CardPayload {
	embeds: EmbedBuilder[]
	components: ActionRowBuilder<ButtonBuilder>[]
}

export const TYPE_LABELS: Record<string, string> = {
	minecraft_java_server: 'Server',
}
