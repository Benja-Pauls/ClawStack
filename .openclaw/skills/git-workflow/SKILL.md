# Skill: Git Workflow

Standard git practices for ClawStack development.

## Branch Naming

Use prefixed branch names:

- `feature/short-description` -- new functionality
- `fix/short-description` -- bug fixes
- `chore/short-description` -- tooling, dependencies, config
- `docs/short-description` -- documentation only
- `refactor/short-description` -- code restructuring without behavior change

Keep branch names lowercase, use hyphens, keep under 50 characters.

## Creating a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/add-projects-endpoint
```

## Commit Messages

Follow Conventional Commits format:

```
<type>: <short summary>

<optional body explaining why>
```

Types:

- `feat:` -- new feature visible to users
- `fix:` -- bug fix
- `chore:` -- build, deps, CI changes
- `docs:` -- documentation
- `test:` -- adding or updating tests
- `refactor:` -- code change that doesn't fix a bug or add a feature
- `style:` -- formatting, whitespace (no logic change)

Examples:

```
feat: add project listing endpoint
fix: handle null description in project schema
chore: upgrade FastAPI to 0.115
test: add integration tests for project CRUD
refactor: extract database session into dependency
```

Keep the summary line under 72 characters. Use the body for context on _why_ the change was made.

## Staging and Committing

Stage specific files rather than using `git add .`:

```bash
git add backend/app/routes/projects.py backend/app/schemas/projects.py
git commit -m "feat: add project listing endpoint"
```

For multiple related changes, make separate commits:

```bash
git add backend/app/models/project.py backend/app/models/__init__.py
git commit -m "feat: add Project database model"

git add backend/migrations/versions/abc123_add_projects.py
git commit -m "chore: add migration for projects table"
```

## Opening a Pull Request

Push the branch and create a PR:

```bash
git push -u origin feature/add-projects-endpoint

gh pr create \
  --title "feat: add projects endpoint" \
  --body "## Summary
- Add CRUD endpoints for projects resource
- Add Project model and migration
- Add React Query hooks for project data

## Changes
- backend/app/routes/projects.py (new)
- backend/app/models/project.py (new)
- frontend/src/hooks/useProjects.ts (new)

## Testing
- Added pytest tests for all CRUD operations
- Added vitest tests for useProjects hook
- Manually tested via dev server"
```

## PR Description Format

Every PR body should contain:

- **Summary**: 1-3 bullet points on what changed and why.
- **Changes**: list of key files added or modified.
- **Testing**: how the changes were verified.

## Code Review Response

When review comments are received:

1. Read each comment carefully.
2. Make the requested changes in a new commit (do not amend or force-push unless asked).
3. Push and reply to each comment explaining what was changed.

## Keeping Up to Date

If `main` has advanced while your branch is open:

```bash
git fetch origin
git rebase origin/main
```

If there are conflicts, resolve them file by file, then `git rebase --continue`.

## After Merge

Clean up the local branch:

```bash
git checkout main
git pull origin main
git branch -d feature/add-projects-endpoint
```
