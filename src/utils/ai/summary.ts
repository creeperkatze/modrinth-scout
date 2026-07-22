import type { Labrinth } from '@modrinth/api-client'

import { aiSummariesEnabled } from '../../config/ai.js'
import { prompt } from '../api/openrouter.js'

const MIN_CHANGELOG_LENGTH = 80
const MAX_CHANGELOG_INPUT_LENGTH = 4000

const SYSTEM_PROMPT =
	'You summarize changelogs of Minecraft mods, resource packs, data packs, shaders, plugins or modpacks for a Discord update notification. ' +
	'Reply with a single plain-English sentence (max 25 words) describing what changed. ' +
	'Do not mention the project name, version number, or version type, the user already sees those elsewhere. ' +
	'Start directly with the change, e.g. "Adds ...", "Fixes ...", "Improves ...". ' +
	'No markdown, no preamble, no quotes. If the changelog has no meaningful content, reply with exactly: NONE'

export async function summarizeChangelog(
	project: Labrinth.Projects.v3.Project,
	version: Labrinth.Versions.v3.Version,
): Promise<string | null> {
	if (!aiSummariesEnabled) return null

	const trimmed = version.changelog?.trim()
	if (!trimmed || trimmed.length < MIN_CHANGELOG_LENGTH) return null

	const context = [
		`Project: ${project.name} (${project.project_types.join(', ')})`,
		`Version: ${version.version_number} (${version.version_type})`,
		version.loaders.length > 0 ? `Loaders: ${version.loaders.join(', ')}` : null,
		version.game_versions.length > 0 ? `Game versions: ${version.game_versions.join(', ')}` : null,
	]
		.filter(Boolean)
		.join('\n')

	const summary = await prompt(
		SYSTEM_PROMPT,
		`${context}\n\nChangelog:\n${trimmed.slice(0, MAX_CHANGELOG_INPUT_LENGTH)}`,
		80,
	)

	if (!summary || summary.toUpperCase() === 'NONE') return null
	return summary
}
