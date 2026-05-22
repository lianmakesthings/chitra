# Chitra — Architecture

Chitra is a [Model Context Protocol](https://modelcontextprotocol.io/) server that gives an LLM natural-language access to [YNAB](https://ynab.com). The primary use case is posting transactions from bank screenshots without touching the YNAB UI.

---

## Tools

### Read / discovery

| Tool | Purpose |
|---|---|
| `list_budgets` | Returns all YNAB budgets accessible with the configured PAT. Entry point for multi-budget setup. |
| `list_accounts` | Lists accounts in a budget (balances in euros). Accepts optional `budget_id`; defaults to the configured default. |
| `list_categories` | Lists YNAB categories grouped by group, skipping hidden/deleted ones. Budget-scoped — categories from one budget must not be used when posting to another. |
| `list_payees` | Lists all existing payee names in a budget, sorted. The LLM is instructed to call this before every posting session to enable payee normalization. |
| `list_account_aliases` | Returns the full alias map: `alias → { budget_id, account_name }`. |
| `list_flags` | Returns all configured flag presets: `alias → { color, name }`. |
| `get_recent_transactions` | Fetches recent transactions for a given account (default: 14 days). Used to cross-check before posting — catches near-duplicates that would slip past import_id dedup. |
| `get_merchants` | Returns the full `merchants.md` blob. Empty string if never set. |
| `get_config` | Returns the full `config.yaml` blob: account aliases, budget mappings, flag definitions. |

### Write

| Tool | Purpose |
|---|---|
| `add_transactions` | Bulk-posts transactions to one YNAB account. Accepts alias or account name. Handles category resolution, flag resolution, dedup via `import_id`. Amounts in signed euros (negative = outflow). Posts as cleared. |
| `set_account_alias` | Maps a short human alias (`checking`, `business`) to a YNAB account + budget. Validates that the account exists before writing. |
| `set_flag` | Maps a short alias (`shared`) to a YNAB flag color and display name. |
| `update_merchants` | Replaces the full `merchants.md` blob. Requires reading first (`get_merchants`) then writing back the merged version. |

---

## Storage layer

The server's persistence needs are minimal but real: it needs to store the merchant mapping and user-defined config (aliases, flags) across sessions.

The storage contract is a minimal key-value interface:

```typescript
interface Storage {
  get(key: string): Promise<string | null>
  set(key, value: string): Promise<void>
}
```

All tools go through this interface. The backing implementation is swapped at startup based on the deployment target.

### Backends

**Local filesystem** — the development/self-hosted backend. Reads and writes files in a configurable data directory (default: `./data/`). Functionally identical to KV from the tools' perspective. Useful for development, inspection, and for users who want to run the server on their own machine without a Cloudflare account.

**Cloudflare Workers KV** — the production backend. KV is the natural persistence layer for Workers; no extra infrastructure needed. Values are strings, so the markdown and YAML files are stored as raw text under fixed keys.

Adding a new backend (e.g. Durable Objects, R2, a database) means implementing two methods.

---

## Deployment targets

### Local server

A Node (or Bun) HTTP server running the same handler, swapping in the filesystem storage backend. Useful for development and for users who prefer self-hosting.

Config is read from a `.env` file. Run with `npm run dev` or equivalent.

### Cloudflare Workers (v1)

The primary deployment target. The server is a Workers-compatible HTTP handler serving the MCP protocol. KV is the storage backend. Deployment is via `wrangler deploy`.

Config (YNAB PAT, budget ID) is set as Worker secrets/environment variables. See the setup guide.

The same MCP handler code runs in both targets — only the startup wiring differs.

---

## Configuration files

Two files live in storage. They have different characters and are managed differently.

### `config.yaml` — structured, set-and-forget config

Stores account aliases, budget mappings, and flag definitions. Set up once during onboarding, rarely touched after that. Exposed via the `get_config` tool.

```yaml
budgets:
  default: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # YNAB budget ID
  business: yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy

accounts:
  checking:
    budget: default
    ynab_name: Checking
  business:
    budget: business
    ynab_name: Checking

flags:
  shared:
    color: red
    name: Shared
```

### `merchants.md` — living normalization data

Stores two things that grow organically through conversation: the strings to strip from raw bank payee names, and the accumulated merchant-to-category mapping. Both are discovered at runtime and confirmed by the user, which is why they live here rather than in static config.

```markdown
# Merchants

## Strip from all payee names
- CCV*
- Zettle_*
- SQ *
- TST*

## Groceries
- Whole Foods
- Corner Deli → payee: City Market
- Fresh Catch → payee: City Market
- The Spice Shop → payee: The Spice Shop Co

## Eating Out
- Local Bistro
- Venue Group → payee: The Rooftop

## Drinks
- Wine Bar
```

The `Strip from all payee names` section is a plain list of strings to remove before any other processing. New entries are appended when the user instructs the LLM to strip a new prefix. Category sections follow — section headings are YNAB category names (exact spelling, case-insensitive match). A `→ payee: X` annotation means the canonical YNAB payee name differs from the raw bank string.

---

## Pre-posting workflow

The intended sequence before calling `add_transactions`:

1. `get_merchants` — load stripping rules and merchant mapping
2. `get_config` — load account aliases and flag definitions
3. `list_payees` — load existing YNAB payees to match against
4. Parse the bank input (screenshot, CSV, statement)
5. For each raw payee: apply normalization rules → look up in merchants.md → fuzzy-match against YNAB payees → resolve to canonical name + category
6. Confirm the full batch with the user (show a table)
7. `add_transactions`
8. If new merchant→category mappings were confirmed: `update_merchants`

---

## Design decisions

### Alias system instead of raw IDs

The LLM never handles YNAB UUIDs directly. Accounts are referenced by short human aliases (`checking`, `business`) and flags by semantic names (`shared`). Aliases are budget-anchored — `add_transactions` and `list_categories` are automatically routed to the correct budget when an alias is used.

### Payee normalization as an LLM responsibility

The server does not normalize payees server-side. Normalization logic lives in `merchants.md` and is applied by the LLM during pre-posting reasoning. This keeps the server stateless about domain knowledge, makes the mapping fully transparent and user-editable, and lets rules evolve through conversation without deploying server changes.

### Payee matching against existing YNAB payees

Before posting, the LLM always fetches the existing YNAB payee list (`list_payees`) and matches each resolved payee against it. If a close fit exists, it uses the canonical YNAB spelling rather than creating a new payee entry. A new payee is only introduced when no reasonable match exists and the user confirms it. This keeps the YNAB payee list clean and prevents near-duplicate entries accumulating over time.

A match is considered close enough if the difference is a suffix or prefix that the stripping rules would already remove — store numbers, terminal IDs, payment processor codes, and similar noise (e.g. `Whole Foods 1234` → `Whole Foods`). A match is not considered close enough if the root words differ, even slightly. When in doubt, present both options to the user rather than guessing.

### Payee remapping

A merchant entry can map not just to a category but to a different YNAB payee name entirely, using the `→ payee: X` annotation in `merchants.md`. This handles the common case where multiple physical vendors share a single card terminal or market stall — the bank sees `Corner Deli` but the correct YNAB payee is `City Market`. Without this, each vendor would accumulate its own payee entry and category history in YNAB, making the data less useful.

When a remapping is defined, the LLM uses the remapped payee name for both the YNAB payee field and for matching against the existing payee list.

The LLM never calls `add_transactions` without first presenting the full transaction batch to the user as a table — date, payee, amount, category, flag, and memo for every row. The user must explicitly confirm before anything is posted. No exceptions, even for a single transaction. This is the primary safeguard against misclassification and the moment where the user can catch a wrong category, a missing flag, or a payee that resolved incorrectly.

### Amounts in signed euros

YNAB's API uses milli-units. The server converts to/from signed euros so the LLM works in human numbers. Negative = outflow, positive = inflow.

### Idempotent posting

Every transaction gets a deterministic `import_id`. Submitting the same transaction twice is safe — duplicates are rejected and returned in the response.

### Posts as cleared

All transactions post as cleared. For the screenshot-import use case, the user has already seen the transaction in their bank app — it is by definition not pending.

### Category resolution is budget-scoped

Categories are per-budget. The tools enforce this: when posting via alias, the server resolves categories against the alias's budget, not the default. The `list_categories` tool description warns explicitly against cross-budget use.

### Auth (v1)

For v1, auth is handled entirely through setup documentation. Users provide their YNAB Personal Access Token via environment variables or Worker secrets, depending on deployment target. No OAuth flow, no token management in the server.

---

## What's explicitly out of scope for v1

- Automatic transaction import (bank integrations, open banking)
- Splitting transactions
- Multi-user / multi-tenant deployments
- Token management or OAuth
- Any UI beyond the MCP tool surface
