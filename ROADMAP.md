# Chitra — Roadmap

This roadmap sequences development of the v1 MCP server described in [ARCHITECTURE.md](./ARCHITECTURE.md).

Ordering reflects two choices:

- **Horizontal slicing.** Build all read tools first, then config, then writes. The most consequential tool (`add_transactions`) lands last, against a fully exercised read surface.
- **Local-first.** The filesystem storage backend and a local dev server come before the Cloudflare Workers target. Same MCP handler runs in both; only startup wiring differs.

A prior end-to-end spike validated the protocol shape, tool set, and posting workflow. Decisions carried forward from that work are noted inline.

---

## Phase 0 — Foundation

- TypeScript project scaffold; target Node and Bun
- MCP server entry point using `@modelcontextprotocol/sdk` over Streamable HTTP
- `Storage` interface as specified in ARCHITECTURE.md, with the filesystem backend behind it
- Zod schemas for the two stored documents:
  - `config.yaml` (budgets, accounts, flags)
  - `merchants.md` (strip-rules section + category sections), with parser and serializer
- Thin YNAB API client; PAT loaded from env, errors mapped to typed exceptions
- Vitest harness; tests parameterized over the storage backend so the Workers KV backend inherits coverage later
- Local HTTP dev server runnable with `npm run dev`

**Done when:**
- `npm run dev` boots a local MCP server that an MCP client (e.g. inspector) can initialize against
- `npm test` passes with the storage backend exercised through its interface
- A throwaway script using the YNAB client returns a real budget list when given a valid PAT
- Malformed `config.yaml` and `merchants.md` inputs surface typed Zod errors with useful messages
- No MCP tools exposed yet — the surface is intentionally empty

## Phase 1 — Read tools

YNAB read surface, no writes to YNAB or to storage:

- `list_budgets`
- `list_accounts` (optional `budget_id`)
- `list_categories` (grouped, hidden/deleted filtered out)
- `list_payees`
- `get_recent_transactions` (default 14-day window)

A shared budget/account resolver is introduced here so Phase 2 can layer alias support on top without changing tool surfaces.

**Done when:**
- From an MCP client connected to the local server, the LLM can answer "what budgets do I have?", "what accounts are in budget X?", "what categories?", "what payees?", and "what transactions hit account Y in the last two weeks?" — all against real YNAB data
- All five tools accept raw `budget_id` / account name arguments; alias support is deferred to Phase 2
- Hidden and deleted YNAB entities are filtered out of responses

## Phase 2 — Config layer

Backed by `config.yaml` in storage:

- `get_config` returns the full YAML text
- `list_account_aliases`, `list_flags` (derived views)
- `set_account_alias` — validates the target account exists in the target budget before writing
- `set_flag`
- Alias resolution wired into the Phase 1 read tools so `list_categories` and `get_recent_transactions` accept aliases

**Done when:**
- A first-time setup conversation works: the LLM can register an account alias and a flag alias, and they persist across server restarts
- `get_config` returns the current YAML text; `list_account_aliases` and `list_flags` return structured views of the same data
- Phase 1 tools accept aliases (`list_categories` with a budget alias, `get_recent_transactions` with an account alias)
- Setting an alias to a nonexistent account fails loudly with a useful error

## Phase 3 — Posting

`add_transactions` end-to-end:

- Alias → `{ budget_id, account_id }` resolution
- Category lookup, budget-scoped, case-insensitive
- Flag alias → color/name resolution
- Signed euros ↔ YNAB milli-units conversion
- Deterministic `import_id` with a `CHITRA:` namespace prefix to avoid collisions with YNAB's own bank-feed importer (which uses `YNAB:`)
- Within-batch occurrence counter so duplicate (date, amount) pairs in the same submission get distinct `import_id`s
- Posts as cleared
- Returns per-row success / duplicate status

Test weight concentrates here: alias misses, unknown categories, unknown flags, cross-budget rejection, duplicate handling, and milli-unit edge cases.

**Done when:**
- The primary use case works end-to-end locally: paste a bank screenshot into a chat with an MCP-connected LLM, confirm the parsed table, post, and see the transactions appear in YNAB
- Re-running the same batch returns duplicates rather than double-posting
- A batch mixing valid and invalid rows reports per-row status without losing the valid ones
- Cross-budget contamination (category from budget A while posting to budget B) is rejected before any YNAB call
- All amounts round-trip through milli-units without drift

## Phase 4 — Merchants surface

- `get_merchants` (empty string when unset)
- `update_merchants` (full-replacement write)

The server does not normalize payees. The `merchants.md` parser from Phase 0 is used only to validate inbound writes — the LLM applies the rules at posting time.

**Done when:**
- The full pre-posting workflow from ARCHITECTURE.md is usable locally: load merchants, parse a screenshot, apply strip rules and category mappings, match against existing YNAB payees, confirm, post, then write back any new merchant mappings
- `get_merchants` returns an empty string on first call against fresh storage
- `update_merchants` rejects writes that fail the markdown schema (e.g. category sections referencing categories that don't exist in any configured budget — or at least surface a warning)

## Phase 5 — Cloudflare target

- Cloudflare KV backend implementing the `Storage` interface
- Workers entry point sharing the MCP handler
- `wrangler.toml` with KV bindings and observability enabled
- Secrets: YNAB PAT, default budget ID
- CI: typecheck and tests on every PR; deploy `main` via `wrangler-action`

Auth stays as PAT-via-env per ARCHITECTURE.md. No OAuth gate, no per-user allowlist in v1.

**Done when:**
- `wrangler deploy` ships the same MCP handler to a Workers endpoint
- An MCP client connected to the deployed URL exercises all 12 tools successfully against real YNAB
- Storage operations hit KV instead of the filesystem; documents written locally and uploaded via a sync script (or recreated from scratch) behave identically
- CI runs typecheck and tests on every PR; merges to `main` deploy automatically

## Phase 6 — Polish

- README with both setup paths (local and Workers)
- Example session walkthrough (screenshot → posted batch)
- `LICENSE`, `CONTRIBUTING.md`
- Structured logging; optional debug tracing toggled by env

**Done when:**
- A first-time reader of the repo can go from clone to a posted test transaction in either deployment mode by following the README
- The repo is ready to make public: no personal identifiers in code, config, or examples; LICENSE present; contribution flow documented

---

## Future / explicitly post-v1

In rough priority order:

- **YNAB rate-limit handling.** Retry with backoff on 429. Current design assumes serial tool calls stay well under 200 req/hour; safe but fragile under burst.
- **OAuth flow.** Replace PAT setup to enable hosted multi-user deployments.
- **Transaction splits.** Each row is a single category in v1.
- **Additional storage backends.** Durable Objects, R2, sqlite.
- **Export / backup tooling.** For `merchants.md` and `config.yaml`.

---

## Open questions

- Storage values are strings in the interface. YAML and markdown blobs fit cleanly; if Phase 5 surfaces KV size or atomicity issues with full-document rewrites, the interface may need a typed variant or optimistic-concurrency support.
- Whether to ship the local server as a standalone CLI (`chitra dev`) or just `npm run dev` in the repo. Deferred until Phase 6.
- Whether `import_id` should hash the payee/memo as well as date+amount. Spike's `(date, amount, occurrence)` scheme worked in practice; revisit only if real-world duplicates slip through.
