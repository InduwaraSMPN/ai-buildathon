# Status files

One file per session, written by that session only, so they never conflict.

- `chat-p.md` — preflight: behaviour tests, Drizzle reconciliation, tool-limit mismatch; runs first
- `chat-0.md` — domain refactor of contracts and routers; runs second, alone
- `chat-a.md` — identity, authorization, admin, database hygiene
- `chat-b.md` — status as data, SLA, breach, pending
- `chat-c.md` — problems, changes, knowledge, forms
- `chat-d.md` — rules, vocabulary, CMDB, workflows
- `chat-e.md` — mail, inventory, origins, dead tables
- `chat-f.md` — one ticket-creation service across five intake paths; runs last

Each session creates its own file on first run and updates it as it goes, not only at the end. Suggested
shape:

```markdown
# Chat <X> — <scope>

Last updated: <date>
Branch: <branch>

## Done
- <task id> — <what landed, and where>

## Blocked
- <task id> — blocked on <what>. Already done toward it: <...>. Unblocks when: <...>

## Handed off
- <defect found that belongs to another brief> — <file:line> — <which brief>

## Decisions taken
- <choice made without the user, and the assumption behind it>

## Gates
- api / agent / cli / dashboard / portal — <pass or the failing line>
```

The point of *Blocked* is that nobody waits. Record it, move on, and the user decides what to unblock and
when to re-run.
