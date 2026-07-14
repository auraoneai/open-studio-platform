# Platform Template Sync Procedure

Open Studio Platform releases block flagship releases when template sync is overdue.

## Tauri Stability Procedure

The platform template pins every `@tauri-apps/*` npm package and every Tauri Rust crate to an exact patch version. `scripts/verify-platform-contracts.mjs` fails if a Tauri dependency uses a range, caret, tilde, workspace wildcard, or unpinned version.

The Platform owner reviews Tauri releases once per quarter:

1. Open a platform PR that bumps all Tauri npm and Rust crate pins together.
2. Run the template verification command, platform contract verifier, Rust workspace tests, and release workflow lint.
3. Open canary sync PRs for Rubric Studio Open, Robotics Studio Open, and Agent Studio Open.
4. Monitor Tauri upstream release notes, advisories, and issue regressions for seven days after the canary sync.
5. If a Tauri regression blocks a flagship release, revert the platform bump and pin the previous known-good patch. If upstream cannot provide a fix inside one release cycle, open a platform RFC to maintain a private fork until the next quarterly review.

1. Tag the platform release as `platform-vX.Y.Z`.
2. Open sync PRs against `rubric-studio-open`, `robotics-studio-open`, and `agent-studio-open`.
3. Each PR updates copied template files, extension crate versions, intake schema version, and migration notes.
4. Flagship owners merge within five business days.
5. Flagship release workflows run `scripts/check-template-sync.sh` before publishing.

The gate accepts a `.open-studio-platform-sync.json` file at the flagship repo root:

```json
{
  "platform_version": "0.3.0",
  "platform_tag": "platform-v0.3.0",
  "synced_at": "2026-05-13T00:00:00Z",
  "template_commit": "REPLACE_WITH_PLATFORM_COMMIT",
  "flagship": "agent-studio-open"
}
```

`synced_at` must be no more than five business days older than the release date unless the release is marked as an emergency security hotfix by the Platform owner.
