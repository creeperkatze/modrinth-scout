import { EmbedBuilder } from 'discord.js'

export function buildRolesHelp(limit: number) {
	return new EmbedBuilder()
		.setColor(0x1bd96a)
		.setTitle('How roles work')
		.setDescription(
			[
				'Roles are given to members based on their linked Modrinth account.',
				'### Setup',
				"`/roles add` sets up a role. I need the **Manage Roles** permission, and my role has to be above it in the server's role list. `/roles manage` shows every role and lets you remove them.",
				'### Conditions',
				'Every condition on `/roles add` is optional, and members need to meet **all** the ones you set. Without any, the role goes to anyone with a linked account.',
				"- `project` / `organization`: on the project's team or a member of the organization",
				'- `min_downloads`, `min_followers`: totals across all their projects',
				'- `min_projects`: how many projects they are a team member of',
				'- `project_type`: has at least one project of that type',
				'- `badge`: has that Modrinth badge',
				'- `min_account_age`: Modrinth account age in days',
				'### Getting roles',
				'Members link their account with `/account link`, which updates their roles in every server they share with me. Anyone who joined later, or whose Modrinth stats or teams changed, can run `/roles get` to refresh their roles here. `/roles list` shows what each role requires.',
				'### Managed roles',
				"A role set up here always matches the member's Modrinth account. Anyone who no longer meets its conditions loses it the next time their roles update, and unlinking removes all of them. Roles given out by hand are included, so use a separate role for anything you want to assign yourself.",
				'### Limits',
				`This server can set up **${limit}** roles.`,
			].join('\n'),
		)
}
