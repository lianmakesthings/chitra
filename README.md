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
