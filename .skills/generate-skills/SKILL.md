---
name: generate-skills
description: "Generate project-specific Agent Skills for any codebase by interviewing the developer about their conventions. Use when: the user wants to add skills to an existing project, asks 'how do I make my agents understand my codebase,' wants to create a .skills/ directory, or says 'generate skills for my project.'"
---

# Generate Project-Specific Skills

Analyze an existing codebase and interview the developer to produce project-specific Agent Skills (SKILL.md files) that teach IDE agents how to write code matching the project's conventions.

This skill works for ANY codebase — not just SerpentStack. The output is a `.skills/` directory following the Agent Skills open standard (agentskills.io).

## When to Use

- The user has an existing project and wants agents to understand their conventions
- The user says "generate skills," "create skills for my project," or "make my agent understand my codebase"
- The user wants a `.skills/` directory for a project that doesn't have one

## Phase 1: Codebase Discovery

Before asking questions, read the codebase to come prepared. Reduce burden on the developer by finding answers yourself first.

1. **Read project structure**: `ls -R` or `find . -type f -name "*.py" -o -name "*.ts" -o -name "*.js" | head -50`
2. **Read config files**: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`, `docker-compose.yml`
3. **Read existing context files**: `.cursorrules`, `CLAUDE.md`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`
4. **Read 2-3 representative source files**: a model/entity, a service/controller, a test file, a route/handler
5. **Read the test setup**: `conftest.py`, `jest.config`, `vitest.config`, test fixtures

From this, form hypotheses about:
- Language, framework, and major dependencies
- Project structure (where models, services, routes, tests live)
- Transaction/database patterns
- Auth approach
- Test infrastructure
- API patterns (REST, GraphQL, RPC)
- Frontend patterns (if applicable)

## Phase 2: Developer Interview

Use AskUserQuestion to confirm hypotheses and uncover conventions that aren't visible in code. Ask 5-8 rounds of questions. **Do not ask obvious questions** — you already read the code. Ask about the WHY and the EDGE CASES.

### Round 1: Confirm Architecture

Present what you found and ask for corrections:

"I've read your codebase. Here's what I see:
- [framework] with [database] and [test framework]
- Services in `[path]`, routes in `[path]`, models in `[path]`
- Auth via [approach]
- Tests use [infrastructure]

Is this accurate? What am I missing?"

### Round 2: Transaction & Data Patterns

Ask about the patterns agents most commonly get wrong:

- "Who owns the transaction boundary — the service layer, the route/controller, or a middleware?"
- "Do services raise HTTP exceptions, or do they return domain values that the route layer translates?"
- "How do you handle not-found vs. not-authorized in service returns?"

### Round 3: Auth & Authorization

- "How does a route know who the current user is? Dependency injection, middleware, decorator?"
- "How is ownership enforced on update/delete? Per-route check, service layer, or policy object?"
- "What's the shape of your user/identity object that protected routes receive?"

### Round 4: Testing Conventions

- "Do tests hit a real database or use mocks? If real, how is isolation handled?"
- "Are there shared fixtures or test helpers? What do they provide?"
- "What's the pattern for authenticated test requests?"

### Round 5: Frontend (if applicable)

- "How do frontend components call the API? Raw fetch, typed client, generated SDK?"
- "How are types kept in sync with the backend? Manual, codegen, shared schema?"
- "What state management pattern do you use? Context, Redux, Zustand, signals?"

### Round 6: Deploy & CI

- "What does your deploy pipeline look like? Docker, serverless, PaaS?"
- "What checks run in CI? Lint, typecheck, test, build?"
- "Is there a single command to verify everything locally before pushing?"

### Round 7: Conventions Agents Get Wrong

This is the most important question:

"When you've used AI agents to write code, what do they consistently get wrong? What do you find yourself correcting repeatedly?"

This directly identifies what the skills need to encode.

### Round 8: Priorities

"Which of these would be most valuable as skills for your project?"
- Scaffold (adding new resources/features end-to-end)
- Auth (protecting routes, understanding the auth system)
- Test (writing and running tests correctly)
- Database (migrations, schema changes)
- Deploy (build, push, deploy workflow)
- Dev server (error detection, common fixes)
- Git workflow (branches, commits, PRs)
- [Other based on what you've learned]

## Phase 3: Generate Skills

Based on the interview, generate SKILL.md files. Each skill must:

### Follow the Agent Skills Standard

```yaml
---
name: skill-name-matching-directory
description: "What it does and when to use it. Be specific about trigger conditions."
---
```

- `name`: lowercase, hyphens, matches parent directory name, max 64 chars
- `description`: max 1024 chars, include both purpose AND trigger conditions

### Be Project-Specific, Not Generic

Bad (generic):
```markdown
Services should handle business logic and return appropriate values.
```

Good (project-specific):
```markdown
Services call `await db.flush()` but never `db.commit()`. Return values:
- Domain object: success
- `None`: not found
- `False`: not authorized
The route handler calls `await db.commit()` after successful mutations.
```

### Include Complete Templates

For scaffold skills, include the actual file templates with:
- Real import paths from this project
- Real type signatures
- Real test patterns matching existing tests
- Placeholders only for the resource name (`{Name}`, `{name}`)

### Include Verification Steps

Every skill ends with how to verify the work:
```markdown
## Verification
[Specific commands to run, expected outputs]
```

## Phase 4: Write Files

Create the `.skills/` directory with the generated skills:

```
.skills/
  scaffold/SKILL.md      # if prioritized
  auth/SKILL.md          # if prioritized
  test/SKILL.md          # if prioritized
  db-migrate/SKILL.md    # if prioritized
  deploy/SKILL.md        # if prioritized
  dev-server/SKILL.md    # if prioritized
  git-workflow/SKILL.md  # if prioritized
  find-skills/SKILL.md   # always include — teaches agents to discover and create new skills
```

## Phase 5: Verify with Developer

Present the generated skills for review. Use AskUserQuestion:

"I've generated [N] skills for your project. Here's a summary of each:
- `scaffold/SKILL.md`: [one-line summary]
- `auth/SKILL.md`: [one-line summary]
- ...

Would you like to review any of these in detail before I write them? Or should I write them all and you can edit afterward?"

## Reference

For detailed guidance on writing effective project-specific skills, see SKILL-AUTHORING.md in the SerpentStack repository. Key principles:

- Encode conventions agents get wrong, skip things linters catch
- Complete templates beat descriptions
- Show the full chain (model -> service -> route -> test), not just parts
- Skills should compose — reference each other, don't duplicate
- Test by starting a fresh agent session and asking it to do the task
