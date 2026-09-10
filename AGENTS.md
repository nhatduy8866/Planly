# Planly Agent Instructions

Before doing any work in this repository, read
`Git Workflow Guideline for Coding Agents.md` completely and treat it as the
mandatory source of truth for all Git operations.

## Required Git Workflow

- Inspect `git status`, the current branch, and recent commits before making
  changes.
- Never modify files, commit, or push directly on `main`.
- Before starting a new task, update `main` with
  `git pull --ff-only origin main`, then create one dedicated task branch using
  the naming convention in the workflow guideline.
- Preserve existing uncommitted work. Never reset, restore, clean, stash, or
  overwrite work automatically when its ownership is uncertain.
- Keep each branch and commit focused on one logical task.
- Review unstaged and staged diffs, check for secrets and unrelated changes,
  and run the appropriate tests before committing.
- Push the task branch and create a Pull Request according to the repository
  workflow. Do not push directly to `main`.
- Never merge a Pull Request unless the user explicitly authorizes the merge.
- Never force-push or use destructive Git commands without explicit user
  authorization.
- Finish every Git task with the final report required by the workflow
  guideline, accurately stating branch, tests, commit, push, Pull Request, and
  merge status.

## Minimal Testing Policy

Apply this policy to every task in this repository unless the user explicitly
requests deeper testing:

- Use the minimum verification needed for the requested change.
- For documentation, instructions, or other non-executable changes, do not run
  automated tests unless the change can affect executable behavior.
- For code changes, run only the narrowest directly relevant test, type check,
  or lint command. Prefer a specific test file or affected file over a full
  project command.
- Do not run the full Jest suite, repository-wide lint, Expo Doctor, native
  builds, end-to-end tests, or broad regression checks by default.
- Run deeper or broader testing only when the user explicitly asks for it.
- If minimal verification cannot provide reasonable confidence, report the
  unverified risk instead of silently expanding the test scope.
- The workflow guideline's requirement to run appropriate tests means the
  minimal, targeted verification defined here; it does not require every
  quality command after every request.

If these instructions conflict with an ad hoc shortcut, follow the repository
workflow unless the user explicitly supplies a valid exception that does not
risk other developers' work or repository stability.
