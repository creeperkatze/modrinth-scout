export const LOADER_EMOJIS: Record<string, string> = {
	fabric: '<:fabric:1497892889932337182>',
	babric: '<:babric:1497892908806832158>',
	'bta-babric': '<:btababric:1497892915903598612>',
	forge: '<:forge:1497892941031542875>',
	'java-agent': '<:javaagent:1497892948849856592>',
	'legacy-fabric': '<:legacyfabric:1497892956915630133>',
	liteloader: '<:liteloader:1497892966092771459>',
	modloader: '<:modloader:1497892982160883762>',
	neoforge: '<:neoforge:1497892990281056386>',
	nilloader: '<:nilloader:1497892997751111740>',
	ornithe: '<:ornithe:1497893006668337233>',
	quilt: '<:quilt:1497893017745358879>',
	rift: '<:rift:1497893025236389888>',
}

export function formatTags(tags: string[]): string {
	return tags
		.map((t) => {
			const emoji = LOADER_EMOJIS[t.toLowerCase()]
			const label = `\`${t.charAt(0).toUpperCase() + t.slice(1)}\``
			return emoji ? `${emoji} ${label}` : label
		})
		.join(' ')
}
