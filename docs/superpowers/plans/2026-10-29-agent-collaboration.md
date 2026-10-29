# Agent collaboration safety plan

Goal: Claude Code and Codex collaborate through isolated branches, evidence-backed reviews and existing test gates. Deadshot89 alone approves merges and production; no new AI spend.

Architecture: Shared AGENTS.md policy, CLAUDE.md entrypoint, read-only PR risk summary and offline safety contract tests. Retain existing application tests. Harden existing production jobs with owner-only manual dispatch, exact commit and explicit confirmation. No new model/API workflow is enabled.

Alternatives: Unbounded agent-to-agent comment loops and API-backed automatic fixes were rejected because cost approval and account configuration are unverified. Existing Claude diagnostic fixes remain a separate cost-controlled opt-in.

Steps:
- Audit existing workflows, PRs, rulesets, tests and deployment triggers.
- Add safety regression tests and verify that the existing production workflows fail them.
- Add shared instructions, PR review summary and production approval gates; retain application behavior.
- Parse modified YAML, run offline safety tests and inspect diffs.
- Commit only to a dedicated branch and open a draft PR. Do not merge or dispatch production.

Review focus: fork PRs receive no secrets or self-hosted runner; workflow text never interpolates user confirmation into shell; reruns must also be started by owner; skipped checks are not green evidence; instruction files and CODEOWNERS require GitHub settings for enforcement.
