# Tracking system

Projects and authors are rows in one `tracking` collection, discriminated by `kind` (`project` | `user` | `organization`).

Notification settings resolve nearest-first through `entry.overrides` → the author entry it was discovered through (`sourceAuthorId`) → `server.tracking` → code defaults, so author-discovered projects deliberately store no overrides of their own. In `overrides`, a missing key means inherit and an explicit `null` `roleId` means never ping.

`notifiedThrough` is a per-guild delivery cursor advanced only after a notification actually goes out.

See [Architecture](architecture.md) for the `src/utils/tracking/` file breakdown.

Unless a guild turns off the `groupVersions` setting (on by default, so lean reads go through `isSettingEnabled`), new versions found in one run are grouped into releases (`src/utils/versionGroups.ts`): versions with the same author, changelog and release type, uploaded within 15 minutes and never targeting the same loader and game version twice, become one card. Its "View version" select menu replies with that build's version card ephemerally, routed by the `version:` value prefix in `src/utils/commands.ts`. A project is skipped for a tick while its newest pending version is under 2 minutes old (for at most 10 minutes), so builds still uploading land in the same card.
