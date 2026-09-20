# Tracking system

Projects and authors are rows in one `tracking` collection, discriminated by `kind` (`project` | `user` | `organization`).

Notification settings resolve nearest-first through `entry.overrides` → the author entry it was discovered through (`sourceAuthorId`) → `server.tracking` → code defaults, so author-discovered projects deliberately store no overrides of their own. In `overrides`, a missing key means inherit and an explicit `null` `roleId` means never ping.

`notifiedThrough` is a per-guild delivery cursor advanced only after a notification actually goes out.

See [Architecture](architecture.md) for the `src/utils/tracking/` file breakdown.
