# Contributing

## Workflow

1. Start from an up-to-date `main`: `git switch main && git pull --ff-only`
2. Branch: `git switch -c <type>/<short-description>`, for example `feat/attendance-tool`
3. Make small commits (see below). Run `npm run check` before pushing.
4. Open a pull request; merge with **squash** once checks pass and a teammate has reviewed.
5. Delete the branch after merging.

Never commit directly to `main`. Never force-push `main`.

## Branch prefixes

`feat/` new feature · `fix/` bug fix · `refactor/` no behaviour change · `style/` CSS only ·
`docs/` documentation · `test/` tests · `chore/` tooling and dependencies

## Commit messages (Conventional Commits)

```
<type>(<scope>): <imperative summary, lowercase, no full stop>
```

Examples:

```
feat(mcp): add get_attendance tool with canMiss calculation
fix(approvals): reject approve when action already decided
docs(readme): add Claude connector steps
```

Scopes: `mcp`, `api`, `domain`, `data`, `auth`, `web`, `shared`, `docs`, `deps`.

## Before every push

- [ ] `npm run check` passes (lint, format, typecheck, tests, build)
- [ ] No `.env`, tokens or passcodes staged (`git diff --staged`)
- [ ] UI changes checked at mobile and desktop widths
- [ ] New logic has a test; bug fixes include a test that would have caught the bug

## Merge conflicts

Rebase onto `main` (`git fetch origin && git rebase origin/main`), resolve each file, `git add`,
then `git rebase --continue`. Run `npm run check` afterwards.

Lockfile conflict during a rebase: take `main`'s version with
`git checkout --ours package-lock.json` (during a rebase, `--ours` is the branch you are rebasing
onto), then run `npm install` and commit the regenerated lockfile.

## If a secret is committed

Revoke and replace it immediately, then remove it from the code. Rotating the secret is what
protects you; rewriting history is only cleanup.
