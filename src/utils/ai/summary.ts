import { aiSummariesEnabled } from '../../config/ai.js'
import { prompt } from '../api/openrouter.js'

const MIN_CHANGELOG_LENGTH = 40
const MAX_CHANGELOG_INPUT_LENGTH = 4000

const SYSTEM_PROMPT =
	'You summarize Minecraft mod/plugin changelogs for a Discord update notification. ' +
	'Reply with a single plain-English sentence (max 25 words) describing what changed. ' +
	'No markdown, no preamble, no quotes. If the changelog has no meaningful content, reply with exactly: NONE'

export async function summarizeChangelog(
	projectName: string,
	changelog: string | null | undefined,
): Promise<string | null> {
	if (!aiSummariesEnabled) return null

	const trimmed = changelog?.trim()
	if (!trimmed || trimmed.length < MIN_CHANGELOG_LENGTH) return null

	const summary = await prompt(
		SYSTEM_PROMPT,
		`Project: ${projectName}\n\nChangelog:\n${trimmed.slice(0, MAX_CHANGELOG_INPUT_LENGTH)}`,
		80,
	)

	if (!summary || summary.toUpperCase() === 'NONE') return null
	return summary
}
