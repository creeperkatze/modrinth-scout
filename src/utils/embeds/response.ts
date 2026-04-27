import { EmbedBuilder } from 'discord.js'

export function success(description: string) {
	return new EmbedBuilder().setDescription(description).setColor(0x1bd96a)
}

export function error(description: string) {
	return new EmbedBuilder().setDescription(description).setColor(0xd83c3e)
}

export function info(description: string) {
	return new EmbedBuilder().setDescription(description).setColor(0xff5e5b)
}
