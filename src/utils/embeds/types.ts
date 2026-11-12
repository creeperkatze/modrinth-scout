import type { ActionRowBuilder, EmbedBuilder, MessageActionRowComponentBuilder } from 'discord.js'

export interface CardPayload {
	embeds: EmbedBuilder[]
	components: ActionRowBuilder<MessageActionRowComponentBuilder>[]
}

export const TYPE_LABELS: Record<string, string> = {
	minecraft_java_server: 'Server',
}
