# Chitra

An MCP server that gives an LLM natural-language access to [YNAB](https://ynab.com). Primary use case: posting transactions from bank screenshots without touching the YNAB UI.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and [ROADMAP.md](./ROADMAP.md) for the build plan. Pre-v1; Phase 0 (foundation) in progress.

## Setup

```sh
bun install
cp .env.example .env
# fill in YNAB_PERSONAL_ACCESS_TOKEN
```

[Bun](https://bun.sh) ≥ 1.3 is the dev runtime. Node ≥ 20.10 works via the `:node` script variants for contributors who prefer not to install Bun.

## Commands

```sh
bun run dev        # local MCP server (Streamable HTTP)
bun run test       # vitest
bun run typecheck  # tsc --noEmit
bun run lint       # eslint + prettier
bun run format     # prettier --write
```

Node-only equivalents: `bun run dev:node`, `bun run smoke:node`.

## Configuration

User-defined aliases live in storage as `config.yaml` — set up once during onboarding via MCP tools, rarely touched after. The full shape and rules are in [ARCHITECTURE.md](./ARCHITECTURE.md#configyaml--structured-set-and-forget-config); the essentials:

- A `default` budget is required.
- Aliases for budgets, accounts, and flags must be lowercase, start with a letter, and contain only letters, numbers, `_`, or `-` (e.g. `checking`, `business`, `shared`).
- Flag colors must be one of YNAB's six: `red`, `orange`, `yellow`, `green`, `blue`, `purple`.
- Account references to budgets must use defined budget aliases (cross-references are checked at parse time).
