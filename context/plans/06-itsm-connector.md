# Phase 6 — ITSM Connector

**Document role:** Research brief followed by an implementation plan, executed in its own chat session.
**Read first:** [00-overview.md](00-overview.md) for the program and cross-phase contracts · [idea.md](../idea/idea.md) and [architecture.md](../idea/architecture.md) in full · this document's Progress Log at the end.
**Depends on:** Phase 1, hard — see Sequencing.
**Deliverable of the first session:** research findings plus a written plan appended to this document. **Do not write production code in the research session.**

## The idea to evaluate

Axiōma currently *is* the ticketing system. It owns the `tickets` table, the employee portal, and the IT dashboard. A prospective customer already runs ServiceNow, Jira Service Management, Freshservice, or similar, and will not replace it to trial an unproven product.

The proposal: build an ITSM connector so Axiōma runs *behind* the customer's existing system. Their portal stays the front door; Axel becomes the resolution engine. Tickets sync inbound, results are written back as work notes and state changes. Low-friction trial. If the customer later wants Axiōma's own portal and dashboard, the same mapping layer feeds a migration path.

A refinement worth researching seriously: a **shadow mode** where Axel diagnoses and posts what it *would* do as a work note, without taking any action. Intended to pass a customer security review in a single meeting, and to turn every real ticket into an evaluation sample comparing Axel's proposal against what the human actually did.

## Constraints — treat these as given

Verify each against the tree as you go, and correct this document if any has changed.

**Shadow mode already has a home.** Phase 1 adds a `mode` column to `environments` with values `act` and `shadow`, and a single guard in `executeTool` that refuses write-effect tools when the environment is in shadow mode. Two properties of that placement are load-bearing and must not be redesigned here:

- **The agent must not know.** Suppression happens at the API tool layer, so the transcript still records what Axel intended to do. That is exactly the artefact shadow mode needs — a proposal produced by the same code path that would have acted, not a separate reasoning mode that has to be trusted to predict the real one.
- **Shadow is per environment, not per connector.** A customer can run production in shadow while staging acts. The "graduation from comment-only to infrastructure writes" this brief asks for is therefore a configuration change, not a code change.

**Multi-tenancy is decided and is not an open question.** The deployment model is one stack per customer, inside that customer's own infrastructure. That is the per-prospect-stack option, chosen for reasons unrelated to this connector. No `tenant_id` exists on any table and none should be added speculatively. The retrofit only returns as a question if the deployment model ever becomes vendor-hosted across prospects; state that condition and move on. Do not spend research effort costing a retrofit that current strategy rules out.

**Duplicate suppression exists; durability does not.** A repeated tool call within a run returns its recorded result from `agent_tool_calls`, keyed by run and call id, and a device rejects a sequence it has already accepted. But that device rejection reports the outcome as *indeterminate* rather than replaying it, and in-flight device commands are lost if the API restarts. Any polling or webhook sync design has to address duplicate delivery on its own terms, and a work note that silently fails to post is worse than one that never existed.

**The device channel is unauthenticated and plaintext** until Phase 3 lands, and the device ID in the client hello is client-asserted. Until then, a customer trial must be infrastructure-path only — no device actions on real employee laptops.

**Axel does not post into the human conversation and holds no credentials.** Write-back to a customer's ITSM is therefore work for the API, not a new Axel tool. Confirm this reading against the invariants section of `architecture.md` and say so explicitly in the plan.

**Behaviour never keys off a status name.** `ticket_statuses` carries `state_type`, `is_closed`, and `pauses_sla`, and behaviour reads those flags. Status mapping from a foreign vocabulary is configuration, not code.

**Elapsed working time, never stored deadlines.** Stopwatches accumulate against a business-hours calendar in `ticket_stopwatches`; there is no deadline column and one must not be added. A customer's SLA model will not map cleanly onto this. The plan needs to say how that is handled.

**Environment must not come from a foreign field unvalidated.** Phase 1 resolves the target environment server-side, in the order ticket, then CMDB, then configured default, because ticket text is chosen by whoever files the ticket. A synced ticket sharpens this: its fields originate in a system Axiōma does not control and are mapped by configuration. State whether a foreign field may supply an environment at all, and if so how it is validated against the `environments` table. The safe default is that it may not, and environment comes from CMDB or configuration only.

**Ingestion is a third door.** `startTicketRun` has exactly two callers today: the `startRun` procedure in `api/src/server/routers/agent-runs.ts`, and `createTicket` in `api/src/server/routers/tickets.ts` behind the `AXIOMA_AUTO_DISPATCH` flag and a rules-engine check for a settled `route_human` action. A synced foreign ticket is a third ingestion source and needs its own trigger path carrying the same guards. Do not assume ticket creation is one door.

**Claim discipline.** The project supports no performance, savings, accuracy, or production-readiness claim. "One-click migration" is not a supportable claim and must not appear. Co-existence with a phased cutover is the honest framing.

## What already exists that this brief must account for

Kubernetes is **not** the only external connector any more. Recalibrate the cost of a connector against these, since directory sync in particular is the closest existing precedent for the shape being proposed.

| Existing integration | Where |
|---|---|
| HTTP directory source with a 40-percent shrink safety brake | `api/src/server/directory/` |
| Inbound and outbound mail, with threading by retained ticket reference | `api/src/server/mail/`, six tables in `db/schema/mail.ts` |
| Messaging channels and threads | `db/schema/channels.ts` |
| Workflows and webhook deliveries | `db/schema/workflows.ts` |
| API keys and per-key rate limits | `db/schema/api-keys.ts`, `db/schema/api-rate-limits.ts` |

The tool registry is ten tools, not the seven the older architecture table listed. `ticket_read_messages` already exists as the agent's read path into the case log — write-back design should account for it rather than duplicating it.

Shared UI primitives live in `axioma/ui/src/components` and are mirrored into `portal/` and `dashboard/` by `ui/scripts/publish-ui.mjs`, the same pattern as `pnpm contracts:publish`. Plan UI work against the shared package, never against the mirrored copies.

## Sequencing

**Run this after Phase 1 lands.** Not because the research depends on the code, but because the integration-shape deliverable maps a foreign ticket schema onto ours, and Phase 1 changes ours — environment becomes part of how a ticket resolves, and a foreign ticket has to carry that mapping too. Mapping onto a shape that is about to change means doing it twice.

The UI half of the deliverable has no overlap with Phases 1 through 5 and can be researched at any time.

## Research questions

Use web search and fetch. Prefer primary sources — vendor engineering documentation, public API references, published architecture write-ups — over listicles and marketing pages. Where a library or SDK is involved, use Context7 for its documentation rather than guessing.

**Integration architecture.** How do established products integrate with a customer's existing service-management system? Compare polling against webhooks, and look at what the major platforms actually offer: ServiceNow Table and Business Rule APIs plus its integration hub, Jira Service Management webhooks and its Forge and Connect app models, Zendesk, Freshservice. What authentication models are standard, what rate limits apply, and how is duplicate delivery handled in practice?

**Ingestion and duplicate runs.** How do comparable products trigger their agent from a foreign ticket, and how do they avoid starting a second run when the same ticket updates repeatedly? Nothing in Axiōma is idempotent, so this is where that bites hardest. Look for concrete mechanisms — dedupe keys, watermarks, state machines — not descriptions.

**Agentic support products specifically.** Moveworks, Aisera, Atera, Siena, and comparable vendors run agents behind an incumbent ITSM. How do they position that? What does their permission model look like, what do they write back, and how do they handle the boundary between suggesting and acting? Public documentation and case studies are more useful here than press releases.

**Shadow and suggestion modes.** Find prior art for an agent that proposes rather than acts — in ITSM, in code review, in security tooling, anywhere the pattern appears. How is the proposal surfaced to the human, how is agreement measured afterwards, and how do teams graduate a system from suggesting to acting? This is the part of the research most likely to change the design, so give it weight.

**Field and status mapping.** How do integration platforms model the mapping between two systems' ticket schemas? Look for concrete schema and configuration formats rather than descriptions. Also look at how CMDB reconciliation is handled when the customer's CMDB is the source of truth and ours is an observation store — ServiceNow's Identification and Reconciliation Engine is the obvious reference point. Coordinate the answer with Phase 4, which faces a version of the same question when it decides whether CMDB write-back is discretionary, model-driven, or API-driven on terminal state. Answer it once.

**Migration and co-existence.** How are ITSM migrations actually run? What is typically left behind, how long does co-existence last, what regulatory retention obligations keep the old system alive, and what does a realistic phased cutover look like?

**UI patterns.** The second deliverable, so research it properly. How do products present an agent's reasoning, evidence, and proposed action to a human reviewer? Look at agent transcript and trace interfaces, diff-style proposals with approve and reject affordances, confidence and provenance display, and the pattern where a ticket exists in a foreign system but is being worked here. Also look at how integration and sync status is surfaced to an administrator — connection health, last sync, mapping errors, replay controls.

## Plan deliverable

Append the plan to this document, below the research findings. Match the tone of `context/idea/` — declarative, honest about gaps, no marketing register, tables where a table genuinely helps.

1. **Findings.** What the research established, sources cited as links. Call out anything that contradicts a constraint above.
2. **Recommended integration shape.** One design, argued, not a survey of options. Where it lands in the tree — which files under `api/src/server` and `api/src/contracts`, whether a new sync worker is needed, what changes in the data model, what stays untouched. Respect the rule that the API owns every write and every credential.
3. **Trial mode.** What shadow mode means concretely on top of the per-environment `mode` column, what permissions it asks of a customer, what it writes back, and how proposal-versus-actual is captured for evaluation. Then the graduation path from comment-only to infrastructure writes to device writes, with the precondition for each step stated. Device writes require Phase 3.
4. **UI changes.** The substantial second half. For both portal and dashboard: what screens change, what is added, what becomes conditional on a connector being active. At minimum — how a ticket originating in a foreign system is displayed and what actions are disabled on it; how a shadow-mode proposal is presented for a human to accept or reject; where connector health and sync status live; how mapping configuration is administered; and what the employee portal looks like when the customer's own portal is the front door and ours is not in use. Reference existing components by path so the plan is actionable, using `axioma/ui/src/components` for shared primitives.
5. **Sequencing and scope.** What ships first, what is deliberately deferred, what is out of scope. Migration tooling comes after the connector; say what would make it worth starting.
6. **Open questions.** In the table form the `context/idea/` documents use.

## Open questions carried in

| Question | Why it matters |
|---|---|
| Does a customer running Axiōma behind their ITSM deploy our portal at all? | If not, Phase 2's Helm chart needs each component independently optional |
| Is shadow mode a trial posture or a permanent mode for high-risk environments? | Trial posture can be crude. Permanent means the proposal artefact needs to be as reviewable as a change record, and should probably reuse that vocabulary |
| Who owns the CMDB when the customer already has one? | Phase 4 and this phase both need the answer; give it once |
| Does write-back need to survive an API restart? | Command dispatch is not durable today, and a silently dropped work note is worse than none |

## Working rules

PowerShell-compatible commands. Prefer `rg` for search. No Git or GitHub write actions without explicit approval — inspection commands are fine. Use Context7 for library and API documentation without being asked. Read before you write, verify every architectural claim against the tree rather than trusting a summary, and say plainly if something here turns out to be wrong.

## Findings

Research ran on 2026-08-30. Every claim below carries a source; every claim about the tree carries a `file:line` verified in the same session.

### The deployment model decides the integration mechanism

Axiōma installs inside the customer's own infrastructure. A cloud ITSM therefore has nowhere to deliver a webhook — there is no public inbound URL, and there will not be one.

This is not a novel problem and the incumbent's own answer is instructive. ServiceNow's MID Server exists precisely for work inside a customer network: it is a Java process that makes **outbound** HTTPS connections to the instance and waits for work on the ECC Queue, and ServiceNow never initiates a connection inward ([MID Server architecture](https://www.nowspectrum.com/blog/mid-server-guide)). It cannot serve inbound requests at all ([inbound via MID Server is not possible](https://www.servicenow.com/community/itsm-forum/inbound-web-services-mid-server/td-p/755610)). The same shape already appears twice in our own tree, for the same reason — both axel-cli and Axel dial out and hold a stream, because neither a laptop behind NAT nor a worker on someone else's network can be dialled.

So the connector polls. That is a consequence of the deployment posture, not a preference, and it removes what would otherwise be the phase's largest open question.

Every platform supports the query that makes polling correct:

| Platform | Watermark query | Rate limit | On limit |
|---|---|---|---|
| ServiceNow | `sys_updated_on>` on the Table API; keyset pagination on an indexed unique field beats `sysparm_offset` | No out-of-box limit; `sys_rate_limit_rules` is opt-in, per hour, per user or role | 429, exponential backoff |
| Jira Cloud | `updated >= ` in JQL | Per-app, published per endpoint | 429 |
| Zendesk | `/api/v2/incremental/tickets/cursor.json`, cursor-paginated, purpose-built for bulk sync | Its own tighter budget: 10/min, 30/min with High Volume | 429 with `Retry-After`; `Zendesk-RateLimit-incremental-exports-cursor` header carries total/remaining/resets |
| Freshservice | `updated_since` on the v2 tickets endpoint | Per account, 50/min Starter to 400/min Enterprise | 429 with `Retry-After` |

Sources: [ServiceNow rate limit rules](https://www.servicenow.com/community/developer-articles/understanding-servicenow-rest-api-rate-limits-key-concepts-amp/ta-p/3407367), [ServiceNow Table API pagination](https://www.servicenow.com/community/developer-forum/best-practice-for-iterating-through-a-table-with-the-table-api/td-p/3387123), [Databricks ServiceNow ingestion limits](https://docs.databricks.com/gcp/ingestion/lakeflow-connect/servicenow-limits), [Zendesk incremental exports](https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/), [Zendesk rate limits](https://developer.zendesk.com/api-reference/introduction/rate-limits/), [Freshservice API](https://api.freshservice.com/), [Freshservice rate limits by plan](https://support.freshservice.com/support/solutions/articles/50000000293-what-is-the-rate-limit-for-apis-across-all-plans-).

Freshservice's filter endpoint is additionally capped at 300 results per query (30 per page, ten pages), which is a hard reason to sync on a watermark rather than a filter.

### Authentication

The standard for machine-to-machine integration is OAuth 2.0 **client credentials**, and it is the right fit here for a reason beyond convention: it is the one grant type with no human in the flow, which is what a scheduled poll needs. Basic auth is legacy — it sends the credential on every request and cannot be scoped or revoked independently of the user.

On ServiceNow the shape is concrete. Client credentials has been available since the Washington DC release; the integration is registered under System OAuth → Application Registry with the grant type set on both the main profile and the entity profile; and the client must be **confidential**, not public, per RFC 6749 §4.4. The service user is a real `sys_user` row scoped with `snc_platform_rest_api_access` plus the role its work needs ([all four grant types explained](https://www.nowspectrum.com/blog/oauth2-servicenow-guide), [inbound client credentials](https://www.servicenow.com/community/developer-blog/up-your-oauth2-0-game-inbound-client-credentials-with-washington/ba-p/2816891), [a worked third-party setup](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-managed-servicenow-oauth2-setup.html)).

Two consequences for us. The stored credential is a client id and secret rather than a long-lived token, so the connector needs an in-memory access-token cache with expiry and a refresh path — a runtime concern the directory and mail connectors never had, because both use a static bearer. And the secret goes through the existing AES-256-GCM scheme rather than a second one: `v1:iv:ciphertext:tag`, base64url segments, key from `AXIOMA_PROVIDER_ENCRYPTION_KEY` (`api/src/auth/providers.ts:9-30`). Note that only the *decrypt* half exists in the tree today; Phase 1 is already scoped to add the encrypt side, and this phase depends on it rather than duplicating it.

### Webhooks would not have been reliable anyway

Worth recording, because it removes the temptation to add a receiver later for a hosted deployment. Jira Cloud states plainly that webhook delivery is **not guaranteed** — it is best effort, some webhooks are delivered more than once, and retries run up to five times with randomized 5–15 minute backoff on 408, 409, 425, 429 and 5xx. Duplicate delivery is expected, and `X-Atlassian-Webhook-Identifier` is stable across retries so the consumer can deduplicate. Jira Service Management on server does not retry at all ([Jira Cloud webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/), [JSM webhooks](https://developer.atlassian.com/server/jira/platform/jira-service-desk-webhooks/)).

A webhook-driven design would therefore have needed a watermark reconciliation pass regardless. Polling is that pass without the receiver.

One platform fact with a deadline attached: Atlassian Connect is deprecated and apps must migrate to Forge by the end of 2026 ([Connect deprecation](https://www.forge-apps.com/blog/deprecation-of-atlassian-connect-and-the-migration-to-forge)). Any Jira work should target Forge, or — better for our posture — target the REST API with a customer-issued credential and no installed app at all.

### What comparable products ask a customer for

Moveworks and Aisera both run behind an incumbent ServiceNow, and both publish their access requirements. The requirement is the same in each case: the service account needs write permission on the `Incident` and `Request` tables, on `sysapproval_approver`, and on **`sys_journal_field`** — the journal table that holds work notes ([Moveworks ServiceNow access requirements](https://help.moveworks.com/docs/servicenow-access-requirements), [Aisera ServiceNow connector](https://docs.aisera.com/aisera-platform/adding-data-to-your-tenant/integrations-and-data-sources/connectors/servicenow-connector)).

Two further patterns are worth taking:

- Moveworks ships **update sets** that add a named `moveworks_user` role, and does *permission mirroring* — importing ServiceNow User Criteria, entitlements and roles so its own access follows the incumbent's ACLs rather than diverging from them ([permission mirroring](https://help.moveworks.com/docs/access-control-platform-permissions)).
- Aisera runs autonomous and semi-autonomous modes selected by a **confidence threshold** ([Aisera agentic ITSM](https://docs.aisera.com/aisera-platform/llm-operations/understanding-llm-capabilities/aiseras-agentic-ai-for-itsm)).

The confidence-threshold tier is the one to decline. `architecture.md` records that no verdict is taken from model confidence, and that is a better rule than the one the market uses. Our graduation axis is the environment and the effect class, not a number the model produced about itself.

### Shadow mode: the prior art is good, and it is a warning

The pattern is well established outside ITSM and the strongest documented version is the WAF one, because it is explicit about the mechanics of graduation rather than the idea of it. AWS's own guidance is to run a rule in Count mode, analyse the counted matches, create exceptions for the false positives, and **transition one rule at a time** to Block ([AWS re:Post, Count to Block](https://repost.aws/knowledge-center/waf-managed-rules-count-to-block)). Practitioner write-ups put a one-to-two-week soak on it and describe the sequence as count → log analysis → block migration ([COUNT-then-BLOCK promotion pattern](https://stackharbor.com/en/knowledge-base/awsops-waf-on-alb-managed-rules/)).

Two things transfer directly. Graduation is **per rule**, not global. And it is gated on someone having actually reviewed the shadow output — the soak period is where the review happens, not a timer that expires on its own.

The ML literature adds the limit of the technique. Shadow deployment validates system behaviour but not user behaviour: metrics that depend on human interaction cannot be assessed from shadow output ([Microsoft Engineering Playbook, shadow testing](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/shadow-testing/), [deploying ML models in shadow mode](https://christophergs.com/machine%20learning/2019/03/30/deploying-machine-learning-applications-in-shadow-mode/), [shadow deployment](https://distilledpatterns.org/patterns/shadow-deployment/)). Applied here: a shadow run tells us what Axel would have proposed. It does not tell us the fix would have worked, and it does not tell us the employee would have accepted it. A proposal that matches what the human did is evidence about agreement, not about correctness — and the human's action is not ground truth either.

**This is the finding most likely to change the design**, and it is not the encouraging half. The human-factors literature on machine proposals is consistent and unflattering:

| Effect | Measurement |
|---|---|
| Alert dismissal | Clinicians dismiss between 49% and 96% of safety alerts |
| Automation bias | Erroneous automated advice was followed at a 26% higher rate |
| Skill does not protect | With an incorrect AI suggestion, inexperienced radiologists' accuracy fell from roughly 80% to under 20%; radiologists with 15+ years fell from 82% to 45.5% |
| Commission errors | Participants accepted false-positive alerts at rates of 51.7% to 65.8% |

Sources: [MIT Sloan, avoiding rubber-stamping](https://sloanreview.mit.edu/article/ai-explainability-how-to-avoid-rubber-stamping-recommendations/), [automation bias in electronic prescribing](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5356416/), [Stuck on Suggestions](https://arxiv.org/pdf/2603.11821), [approval fatigue](https://tianpan.co/blog/2026/06/25/approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps).

The design consequences are specific rather than atmospheric: show evidence rather than a summary, spend the reviewer's attention sparingly rather than on every ticket, and **instrument the reviewer** — track review latency, rejection rate, and per-reviewer agreement over time, so a reviewer whose approval rate is climbing toward 100% is visible. A shadow mode that produces agreement statistics without measuring whether anyone read the proposal is measuring its own reflection.

**And the agreement statistic itself needs choosing carefully, because the obvious one will lie.** Axel's action space is heavily imbalanced by design — an agent that correctly refuses is the third of the three flagship scenarios, so "escalate" is expected to dominate the distribution. Raw percentage agreement is misleading exactly when base rates are imbalanced, because a rater that says the common thing every time scores well.

Cohen's kappa is the standard correction for chance agreement, and it fails here for a different reason. The **kappa paradox** is documented in two directions: when the probability of chance agreement is high, even high observed agreement produces a low kappa; and imbalanced marginal distributions inflate it. With a highly imbalanced rating distribution kappa reports poor reliability even when the raters agree closely, which makes it not meaningful in that regime. The published recommendation is to report kappa *alongside* raw percentage agreement rather than instead of it, and to add a paradox-resistant coefficient — Gwet's AC1 is the one named, and is measurably less affected by prevalence and marginal probability ([kappa considerations, BMC Cancer](https://bmccancer.biomedcentral.com/articles/10.1186/s12885-023-11325-z), [why Cohen's kappa should be avoided as a performance measure, PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0222916), [kappa overview and pitfalls](https://www.knime.com/blog/cohens-kappa-an-overview), [Gwet's AC1 compared](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3643869/)).

So the evaluation surface reports raw agreement, kappa and AC1 together, stratified by action class rather than pooled. Pooling is what lets a system that only ever escalates look like a system that agrees with its technicians.

### Triggering an agent without triggering it twice

The brief asks for concrete mechanisms rather than descriptions, and the vendors supply three that compose. They are worth taking together because each covers a case the others miss.

**Trigger on transitions, not on states.** This is ServiceNow's own guidance and the distinction is exact: a condition of `State = Resolved` fires on *every subsequent save* while the state is Resolved, whereas `State changes to Resolved` fires only on the transition. For high-frequency tables the recommendation is "For each unique change" rather than "Always", which prevents repeated execution when a condition stays true across saves ([Flow Designer triggers](https://www.nowspectrum.com/blog/flow-designer-triggers), [state-change trigger conditions](https://www.servicenow.com/community/itom-forum/flow-trigger-condition-when-incident-state-changes-from-resolved/m-p/2869940), [trigger conditions gone wrong](https://www.servicenow.com/community/developer-forum/flow-designer-trigger-conditions-gone-wrong/td-p/2622443)).

**Write a marker and exclude on it.** Zendesk's documented pattern is a tag: the trigger adds `AI_classified_v1` when it processes a ticket, and its own condition excludes tickets already carrying that tag. The reasoning given for why a tag rather than something else is the useful part — it is *persistent*, so the "already processed" signal does not disappear, and it is *checkable*, so the trigger condition can test it directly. The same source names two supporting mechanisms: a debounce setting that keeps an agent from firing on its own replies, and choosing the most specific trigger available ("Ticket Created" rather than every update) so the agent does not catch its own actions ([stopping an AI agent looping on Zendesk tickets](https://www.getmacha.com/blog/stop-zendesk-ai-agent-infinite-looping), [about Zendesk triggers](https://support.zendesk.com/hc/en-us/articles/4408822236058-About-Zendesk-triggers-and-how-they-work), [triggers versus automations](https://swifteq.com/post/best-practices-zendesk-triggers-and-automations)).

**Keep a hard backstop.** Zendesk has built-in limits that stop a trigger cycle that keeps firing regardless of configuration. The distinction that matters most is stated plainly in the same write-up: an **iteration limit per run stops single-run internal loops but does not prevent cross-run re-triggering**. Those are different failure modes and a ceiling on one does nothing for the other.

The generic form of the marker is the **inbox pattern**: insert the incoming message's unique id into a table with a unique constraint, in the same transaction as the business change, and silently ignore the conflict. Since at-least-once delivery is all any broker or poller guarantees, the consumer is where idempotence has to live ([outbox, inbox and delivery guarantees](https://event-driven.io/en/outbox_inbox_patterns_and_delivery_guarantees_explained/), [implementing the inbox pattern](https://milanjovanovic.tech/blog/implementing-the-inbox-pattern-for-reliable-message-consumption), [AWS on the transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)).

Mapped onto the tree, we have the first mechanism in a better form than the vendors do, the second only for creation, and **the third not at all**.

The first is better because our transitions are already data. `ticket_status_transitions` is keyed `(from_status, action)` and `ticket_transitions` records every transition that happened, so "did this change state" is a query rather than a diff. The second exists for creation — the unique index proposed below is exactly an inbox table — but says nothing about whether an *update* should start a run.

The third is the gap, and it is more specific than "there is no cap". Reading `startTicketRun` against the seeded vocabulary:

| From status | `state_type` | Rerun gate applies? | Effect |
|---|---|---|---|
| `open` | `new` | **No** | `startRun` is permitted and `canRerun` is never consulted |
| `escalated` | `open` | Yes | Requires the previous run to be `failed` or `exhausted` |
| everything else | — | n/a | No `startRun` transition exists; `resolveTicketStatus` throws |

The gate at `api/src/server/routers/shared.ts:95-107` is wrapped in `if (ticketState === "open")`, and `open` is the *state type*, not the status key. The seeded status whose key is `open` has state type `new` (`migrations/0008_tier1_core.sql:16`), so a ticket sitting in `open` is dispatchable without the `canRerun` check ever running. `startRun` is permitted from exactly two statuses — `open` and `escalated` (`0008_tier1_core.sql:22,27`).

For the portal this is invisible, because a human presses the button once and the first run moves the ticket to `routing`. For a connector it is a live loop: a dispatch failure rolls the ticket status back to `open` (`shared.ts:171-196`), and the next poll that decides to dispatch will be allowed to. The two guards that remain — no concurrently running run, and a permitted transition — do not bound how many times that can happen.

This is the one design question in this phase that prior art answers better than our primitives do, and the answer is that all three mechanisms are needed rather than any one of them.

### Field and status mapping

The deepest prior art is ServiceNow's own, and the useful part is the CMDB half rather than the ticket half.

Import-set **coalesce** matches on a field. The **Identification and Reconciliation Engine** replaces it with identifier entries — attribute sets that define what makes a CI unique, tried in priority order, lowest number first. Service Graph Connectors use IRE rather than coalesce because coalesce cannot express multi-attribute identity. The mechanism that matters most for us is `sys_object_source`: it holds each discovery source's native key, and when that key is present IRE bypasses identification entirely and updates directly ([Flexera on IRE](https://docs.flexera.com/flexera-integration-servicenow-app/sn-integration-with-data-platform/service-now-identification-and-reconciliation-engine-ire-rule), [IRE versus coalesce](https://www.servicenow.com/community/itom-forum/identification-and-reconciliation-rules-versus-coalesce/m-p/986797), [verifying identification rules](https://www.servicenow.com/community/itom-articles/how-to-verify-identification-rules-for-service-graph-connectors/ta-p/3417132)).

Our CMDB already has the shape: `cmdb_objects.external_id` scoped by `classId` is a per-source native key. What it lacks is a source discriminator, which is exactly what `sys_object_source` supplies.

The ticket half has a simpler and more directly useful convention, and it validates the design below from the other side. **Every ServiceNow table carries `correlation_id` and `correlation_display`.** `correlation_id` holds the external system's identifier for the record and is explicitly documented as the field to use to prevent duplication; `correlation_display` is a free-form label naming *which* third-party system the record is tied to. The documented practice for write-back is to gate the outbound business rule on `current.correlation_display == "<system>"`, so an update is only sent to the system that owns the link ([the correlation ID and display fields](https://servicenowguru.com/integration/correlation-id-display-fields/), [use of correlation id and correlation display](https://www.servicenow.com/community/itsm-forum/use-of-correlation-id-and-correlation-disaply/td-p/687578)).

That is the same `(source, external id)` pair proposed below as `itsm_ticket_origins`, arrived at independently by the incumbent. It also means the link can be made bidirectional at no cost: our write-back can populate their `correlation_id` with our ticket reference and `correlation_display` with `Axioma`, which gives their technicians a back-link and gives us a second, platform-native echo-suppression signal.

For bidirectional ticket sync, the products built for the job — Exalate, Unito — converge on three mechanisms ([two-way synchronization](https://exalate.com/blog/two-way-synchronization/), [Jira issue sync](https://exalate.com/blog/jira-issue-sync/), [bidirectional sync tools](https://exalate.com/blog/bidirectional-sync-tools-for-enterprise-teams/)):

1. **Mark writes as sync-originated** and skip them on the next inbound pass.
2. **Compare before writing** — read the current value, skip if identical. A second layer, because the first fails whenever the marker is lost.
3. **Resolve conflicts per field**, by configuration, not by a global last-writer-wins policy.

Identity mapping is email match, default-user fallback, or a custom script. That one is load-bearing for us and is covered under Ingestion below.

### The affected-CI problem

The brief asks how CMDB reconciliation is handled when the customer's CMDB is the source of truth. Answering it turned up a prior question that matters more for this phase: **how does a ticket get linked to a service or a CI at all?**

In ServiceNow the answer is that it frequently does not. Blank `business_service` and `cmdb_ci` on incidents is a named CMDB-health failure that breaks impact analysis, and completeness — what fraction of records have the required fields populated — is tracked as an explicit KPI precisely because it cannot be assumed ([CMDB health and data quality KPIs](https://quantivetech.com/servicenow-cmdb-health-data-quality-kpis/), [why the CMDB keeps breaking](https://www.nowspectrum.com/blog/cmdb-guide), [improving CMDB data quality](https://milicmedia.com/servicenow-cmdb-data-quality/)).

The incumbent's own workaround is instructive and, for us, alarming. Predictive Intelligence classifies category, subcategory and assignment group from the **free-text description**, using a model trained on historical incidents, resolutions and CI data — the worked example is "VPN not connecting in office" being matched against historical descriptions ([multi-method assignment group prediction](https://www.servicenow.com/community/now-assist-articles/multi-method-assignment-group-prediction-with-now-assist/ta-p/3562536), [Predictive Intelligence use cases](https://www.servicenow.com/community/platform-analytics-forum/predictive-intelligence-in-servicenow-20-real-time-use-cases/m-p/3444290)). Text is what actually carries the routing signal, because the structured field is empty.

Our tree has the same shape, verified: `ticket_cmdb_objects` is written only by a manual dashboard link (`api/src/server/routers/cmdb.ts:145`) and by `recordObservation` during a run (`api/src/server/tools/cmdb.ts:208`). A ticket that has not been worked has no CI link, so `readContextForTicket` returns nothing for it. And `tickets.service_id` is `NOT NULL` with a default of `svc-general` (`api/src/db/migrations/0011_tier2_service_management.sql:51`), so an unmapped ticket does not fail — it silently lands on one service.

Both facts land on the same conclusion, worked through under Environment resolution: for a synced ticket, service and environment must be decoupled, because the only signal reliable enough to choose a service is the one least safe to choose an environment with.

### Prompt injection, and why the connector should not add a filter

A synced ticket's body is attacker-chosen text that reaches the model verbatim, exactly as a portal ticket's is. What a connector changes is not the mechanism but the **population**: a ticket in our portal was filed by an authenticated employee, whereas a foreign queue may be fed by a customer-facing portal, an inbound integration, or a monitoring system, under access controls we do not administer.

The research is unusually clear that the instinctive response — filter the text — is the wrong one. Prompt injection is an attack against instruction-following, which is the behaviour the model exists to have, and there is no reliable way to distinguish a valid instruction from a malicious one inside the text itself. Detection by classifier does not close it: as the framing goes, 99% is a failing grade in application security. The defences that do work are architectural — least-privilege tool scopes, structured prompts that mark provenance, and human approval on destructive actions — with the dual-LLM pattern, in which the model holding the tools never reads untrusted content directly, as the strongest and most expensive form ([OWASP LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [OWASP prompt injection prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html), [design patterns for securing LLM agents](https://arxiv.org/html/2506.08837v2), [Simon Willison's prompt-injection series](https://simonwillison.net/series/prompt-injection/)).

Read against the tree, Axiōma already holds the strong version of that. Axel selects a tool by name from a registry of ten and supplies parameters validated by a pydantic schema before anything leaves the process; it cannot compose a command, a shell string, or an API call; and the entire cluster write surface is a tag or digest change on the same image name (`assertStandardImageChange`). That is action-space restriction, and it is what the literature says actually holds. **Adding an injection classifier to the connector would be adding the weak defence to a system that already has the strong one**, and would create the impression of a guarantee the classifier cannot give.

Two things the connector should do instead, both cheap:

**Spotlight the foreign text.** The documented lightweight defence is to make provenance salient — delimit untrusted content, label it, and instruct the model to treat it as data rather than instructions. `build_user_prompt` already separates ticket fields from prior observations and already labels the latter as "prior observations, not established fact". A synced body should get the same treatment rather than being interpolated as though it were trusted.

**Fix the origin label, which is currently wrong in both directions.** `agent/axel/prompt.py:63-64` renders exactly two branches: `portal` yields "this ticket was submitted by an employee", and everything else yields "treat alert/channel evidence as system-sourced, not an employee claim". A synced ticket is neither. Its body is written by a person, so calling it system-sourced is false; and it arrives through a system whose filer population we cannot vouch for, so calling it an employee submission is worse. The connector adds a third branch that says what is actually known: the text was written by someone in the customer's system, and the identity behind it has not been verified by us.

This also sharpens a graduation precondition. Step 2 moves a slice of traffic to an environment that acts on it, and the question of *who can file into that slice* is part of the evidence for that step — not a separate security review. A queue fed only by the customer's own service desk is a different risk from one fed by an external customer portal, and the connector's filter is what distinguishes them.

### Migration and co-existence

The practitioner literature contradicts the comfortable version of co-existence. A firm end date for the source platform should be set before go-live and communicated, because open-ended parallel operation hurts adoption — agents default to the familiar platform when there is no cutover date ([ITSM migration mistakes](https://itsm.tools/itsm-tool-migration-strategy/), [five-phase framework](https://www.siit.io/blog/itsm-tool-migration)).

What is actually migrated is selective: recent and compliance-relevant records, with historical and active data separated deliberately to reduce risk. Attachments dominate the cost — the same volume takes hours without them and one to three days with them. Retention is satisfied by an independent read-only archive rather than by keeping the retired platform alive ([ticket data migration](https://klickflow.io/itsm-ticket-data-migration/), [ITSM and ticket system archiving](https://avendata.ca/itsm-ticket-system-archiving)).

On retention, the brief asks what keeps a decommissioned system alive, and the honest answer is narrower than the question implies. The obligations are real and specific:

| Regime | Requirement | Applies to a service desk record… |
|---|---|---|
| HIPAA, 45 CFR 164.316(b)(2) | Six years from creation or last effective date, whichever is later | …only derivatively. It names policies, procedures, access logs and security incident records. A ticket documenting a PHI-system incident may *be* such a record |
| SOX | Seven years for audit and review documents, after the audit concludes | …only derivatively, through IT general controls. A change record evidencing a control on a financial system may qualify; a password reset does not |
| PCI DSS, Req. 10.7 | Twelve months of audit trail, three months immediately available | …only within the cardholder data environment |

Sources: [HIPAA retention requirements](https://www.hipaajournal.com/hipaa-retention-requirements/), [45 CFR 164.316 documentation retention](https://watchdogsecurity.io/hipaa/data-retention-and-time-limit), [log retention by regulation](https://logcentral.io/en/blog/log-retention-rules-industry-compliance).

**No regime found names IT service desk tickets as a retained record class.** A ticket falls in scope because of what it evidences, not because it is a ticket, and the resulting retention period is usually organisation-defined policy written to satisfy an obligation that is indirect. That matters for scoping: "regulatory retention keeps the old system alive" is generally false as stated. What keeps it alive is a retention *policy*, and a read-only archive satisfies a policy more cheaply than a licensed platform does.

Nothing found supports "one-click migration" and the brief is right to forbid the phrase. Co-existence with a dated cutover is the honest framing, and the date is part of the framing rather than an afterthought.

### UI patterns

**Agent traces.** LangSmith and Langfuse both present a run as a hierarchical tree with per-node inputs, outputs, latency, errors, token usage and cost ([LangSmith tracing](https://langchain-ai-lca-reliable-agents.mintlify.app/concepts/tracing), [Langfuse best practices](https://langfuse.com/docs/observability/best-practices), [comparison](https://www.analyticsvidhya.com/blog/2026/06/agent-observability-with-langsmith-langfuse-arize/)). Our transcript is a flat ordered list with per-step timestamps, tool input always expanded and tool output collapsed — `features/agent-runs/components/step-card.tsx`. That is a reasonable shape for a ten-tool agent and this phase should not rebuild it.

**Connector administration.** GitHub's webhook UI is the model worth copying: deliveries listed by GUID under "Recent deliveries", each one openable, each one with a **Redeliver** button; three days of history in the UI, thirty via the API; and no automatic redelivery ([viewing deliveries](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries), [redelivering](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks), [deliveries API](https://github.blog/changelog/2021-06-30-webhook-deliveries-api/)). Stripe adds the failure-mode ending: retry with exponential backoff for about three days, then **automatically disable the endpoint and email the owner** ([retry schedules compared](https://eventdock.app/tools/webhook-retry-schedule/)).

That auto-disable is the part most easily left out. A connector that has failed for a day should be disabled and surfaced, not retried silently forever against a credential that has been revoked.

**Proposals and partial acceptance.** GitHub's suggested-change model treats partial acceptance as first class rather than as an escape hatch: a reviewer commits one suggestion on its own, or adds several to a batch and commits them together ([incorporating feedback](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/incorporating-feedback-in-your-pull-request), [batch apply](https://github.blog/changelog/2026-03-17-github-code-quality-batch-apply-quality-suggestions-on-pull-requests/)). The unit of judgement is the individual suggestion, not the review.

That transfers. A run may have several suppressed tool calls, and a reviewer may agree with the diagnosis and disagree with one step of the fix. Capturing a single verdict per proposal would throw that away and would flatter the agreement statistics — a mostly-right proposal marked "rejected" and a mostly-wrong one marked "accepted" are both mislabelled.

**Uncertainty and explanation.** Microsoft's Guidelines for Human-AI Interaction, validated in a CHI 2019 study, put three of the eighteen in the "when wrong" group, and all three bear on the proposal card ([HAX guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/), [CHI 2019 paper](https://dl.acm.org/doi/10.1145/3290605.3300233)):

| Guideline | Wording |
|---|---|
| G8 | *Support efficient dismissal.* Make it easy to dismiss or ignore undesired AI system services ([G8](https://www.microsoft.com/en-us/haxtoolkit/guideline/support-efficient-dismissal/)) |
| G9 | *Support efficient correction.* Make it easy to edit, refine, or recover when the AI system is wrong |
| G11 | *Make clear why the system did what it did.* Enable the user to access an explanation of why the AI system behaved as it did |

G11 is where this design is already strong and should say so plainly: the explanation is not generated alongside the proposal, it *is* the proposal — the transcript produced by the code path that would have acted. G8 argues against a confirmation dialog on reject; dismissal that costs a click and a modal is dismissal that stops happening. G9 is the one this phase does not satisfy and should not pretend to — a reviewer cannot edit Axel's proposed patch, only agree or disagree with it.

### Corrections to this document

The brief asks that its constraints be verified against the tree and corrected where they have changed. Four are wrong or incomplete.

| Stated | Verified |
|---|---|
| `startTicketRun` is gated by `AXIOMA_AUTO_DISPATCH` and a rules-engine check for a settled `route_human` | Four conditions, not two. `createdCore.created && env.AXIOMA_AUTO_DISPATCH && grpcGateway.hasWorker() && !settledActions.includes("route_human")` — `routers/tickets.ts:229-238`. The `hasWorker()` term matters here more than anywhere else, and is treated separately below |
| "The tool registry is ten tools, not the seven the older architecture table listed" | `architecture.md`'s tool table already lists all ten. The sentence describes a correction that has already been made |
| Phase 1's shadow guard is "three lines of work" and reads `mode` in `executeTool` | The API registry has no effect classifier. `ToolHandler` is `{input, verifiedBy?, run}` — `tools/index.ts:34-38`. Read/write effect exists only on the Python side, as `Effect.READ`/`Effect.WRITE` in `agent/axel/tools.py:27-29`. The guard needs an `effect` field added to the API registry first, and the closest thing that exists today is an ad-hoc name-prefix heuristic used for the progress marker at `tools/index.ts:136-146`. Phase 1 should widen its own scope by that much |
| Phase 1 and Phase 3 both cite `connector-plan.md` | No such file exists. It is a stale name for this document — `01-multi-environment.md:48`, `03-device-channel-auth.md:12` |

A fifth finding is a tree fact the brief could not have known, and it is the reason the ingestion design below carries a backstop. **`startTicketRun`'s rerun gate does not apply to a ticket in the `open` status.** The gate at `routers/shared.ts:95-107` is wrapped in `if (ticketState === "open")`, where `open` is the *state type*; the seeded status whose key is `open` has state type `new` (`migrations/0008_tier1_core.sql:16`). So `canRerun` is never consulted for it. `startRun` is permitted from exactly `open` and `escalated` (`0008_tier1_core.sql:22,27`), and a failed dispatch rolls the status back to `open` (`shared.ts:171-196`). A human pressing a button once never notices; a poller can re-dispatch the same ticket indefinitely.

A sixth item is not a contradiction but is the single most consequential fact for this phase, and the brief does not mention it: **when no agent worker is connected, `startTicketRun` throws `SERVICE_UNAVAILABLE` and nothing is queued or persisted** — `routers/shared.ts:84-87`. For a portal ticket that surfaces as an error to the person clicking the button. For a synced ticket there is nobody clicking, so the run is simply never started and the failure is invisible. Any ingestion path must treat dispatch as a separate, retryable step rather than an inline call.

Everything else in the constraints section verified as written: duplicate suppression is keyed `(run_id, call_id)` at `db/schema/agent.ts:101`; a device replay reports `outcome: "indeterminate"` at `cli/internal/device/daemon.go:309-317`; both gRPC channels bind `createInsecure()` at `grpc.ts:114-123` and the device ID is taken from the hello unverified at `grpc.ts:685-689`; no tool writes into the ticket conversation, and `ticket_read_messages` is read-only and public-only at `tools/messages.ts:10-30`; `ticket_statuses` carries `state_type`, `is_closed` and `pauses_sla` at `db/schema/vocabulary.ts:12-26`; there is no deadline column anywhere in the schema directory; and no `tenant_id` exists in the tree.

**The API owns every write and every credential, and write-back is API work rather than a new Axel tool.** Confirmed directly: the agent's dependency set is `pydantic`, `pydantic-settings`, `python-dotenv` and `litellm`, with `grpcio` and `protobuf` in the server extra (`agent/pyproject.toml:10-24`), and its only credential is `AXIOMA_LLM_KEY` (`agent/axel/config.py:24`). Every write to `ticket_messages` in the tree happens outside the tool path. Adding an ITSM tool to the registry would put a customer's ITSM credential behind a model's tool selection, which is the one thing the architecture is arranged to prevent.

---

## Recommended integration shape

**One design: the connector is a fourth ticket-creation adapter with a durable outbound work-note queue, polling on a per-connector watermark.** No webhook receiver. No new Axel tool. No column added to `tickets`.

The shape is not invented. `server/tickets/create.ts:85` already says what it expects of a caller — *"Adapters keep their own parsing, authorization and deduplication; this function owns every shared creation invariant."* Mail is one such adapter, channels another. This is the third, and the deliberate design of the existing two is what makes it cheap.

### Layering

Copy the directory-sync split exactly, because it is the closest precedent and it is the one that has a pure planner:

| Layer | File | Job |
|---|---|---|
| Planner | `api/src/server/connectors/plan.ts` | Pure. Given foreign records, a mapping configuration and the last watermark, return a `ConnectorSyncPlan` of `create`/`update`/`skip` decisions, each with a reason. No database, no fetch |
| Store | `api/src/server/connectors/store.ts` | The `ConnectorStore` interface and its database implementation. Advisory-locked per connector, as `directory/store.ts:72-74` does |
| Transport | `api/src/server/connectors/servicenow.ts` | Fetch only. `AbortSignal.timeout`, keyset pagination, 429 with `Retry-After` honoured, and an in-process access-token cache with expiry. The token cache is new work — directory and mail both use a static bearer, so nothing in the tree refreshes a credential |
| Mapping | `api/src/server/connectors/mapping.ts` | Applies a declarative mapping and validates the result against our closed enums |
| Runtime | `api/src/server/connectors/runtime.ts` | The self-rescheduling sweep, started from `index.ts` and closed in the signal handler, exactly as `startRecurrenceSweep` is at `index.ts:50` and `index.ts:71` |
| Write-back | `api/src/server/connectors/writeback.ts` | The durable outbound queue. Modelled on `workflows/webhooks.ts`, not on `mail/send.ts` |

`syncConnector(store, incoming, mode)` takes a `"preview" | "apply"` discriminant so the administration screen and the sweep run the same code, as `directory/sync.ts:137-149` does.

The safety brake carries over with a different meaning. Directory's brake refuses a sync that loses more than 40 percent of the directory (`directory/sync.ts:95-97`). Ours refuses a sync that would create more than a configured number of tickets in one pass — the failure being a mapping that matches every record rather than the changed ones. Throw a typed error carrying both counts, as `DirectoryShrinkError` does.

One gap in the precedent must not be copied. `directory_sync_runs` declares `rejected` and `failed` in its status enum and **never writes either** — a refused sync leaves no audit row at all, because the brake throws before `apply()` is reached. Write the row on every path.

### Data model

Nine new tables. None of them touches `tickets`, which follows the rule the mail schema states outright at `db/schema/mail.ts:128` — *"Isolated ticket provenance avoids modifying the concurrently-owned tickets table."*

| Table | Carries | Modelled on |
|---|---|---|
| `itsm_connectors` | `key`, `vendor`, `label`, `baseUrl`, `authType`, `clientId`, `clientSecretEncrypted`, `enabled`, `disabledReason`, `pollIntervalSeconds`, `watermark`, `cursor`, `lastSuccessfulSyncAt` | `auth_providers` for the encrypted client secret — same column shape, same AES-256-GCM scheme; `mailboxes` for the enabled-and-configured shape |
| `itsm_connector_runs` | `mode`, `status`, counts, `summary` jsonb, `error` | `directory_sync_runs`, with the failure paths actually written |
| `itsm_ticket_origins` | `ticketId` primary key, `connectorId`, `externalId`, `externalKey`, `externalUrl`, `foreignUpdatedAt`, `lastWrittenAt`, `dispatchCount` | `ticket_mail_origins` — one row per ticket, PK on the ticket |
| `itsm_dispatch_ledger` | `ticketId`, `triggerKey`, `dispatchedAt`, `outcome` | New. The inbox pattern with a domain key — unique on `(ticketId, triggerKey)`, claimed by `onConflictDoNothing` in the same transaction as the dispatch decision |
| `itsm_environment_routes` | `connectorId`, `sourceField`, `sourceValue`, `environmentKey`, `position` | New. An administrator-maintained allowlist mapping a foreign field value to an `environments.key`. Ordered, first match wins, falls through to the connector default |
| `itsm_field_mappings` | `connectorId`, `sourceField`, `targetField`, `valueMap` jsonb, `onUnmapped`, `defaultValue` | New; shaped by IRE's identifier-entry priority idea |
| `itsm_writebacks` | `status`, `attemptCount`, `maxAttempts`, `nextAttemptAt`, `lastError`, `claimedAt`, `payload` jsonb, `externalReceiptId` | `webhook_deliveries`, copied structurally including the three CHECK constraints |
| `itsm_proposals` | `runId`, `ticketId`, `connectorId`, `suppressedCalls` jsonb, `postedAt`, `openedAt`, plus nullable outcome columns filled by a later sync pass | New; discussed under Trial mode |
| `itsm_proposal_verdicts` | `proposalId`, `callOrdinal`, `verdict`, `reviewerId`, `decidedAt` | New. One row per suppressed call rather than per proposal, so a reviewer can accept the diagnosis and reject one step — GitHub's suggested-change model |

`itsm_ticket_origins` gets a unique index on `(connectorId, externalId)`. That index is the ingestion idempotency key, and it is the same mechanism as `inbound_emails`' unique `(mailbox_id, provider_message_id)` at `db/schema/mail.ts:75-78` — the insert *is* the claim, via `onConflictDoNothing().returning()`.

One further addition is a row per connector in the existing `ticket_origins` vocabulary table, not a new enum. Origin is already runtime vocabulary (`db/schema/channels.ts:11-20`) and already a matchable rule field.

### Ingestion

Four things need care, and three of them are not obvious.

**Dispatch is gated in three layers, because no one of them is sufficient.** The vendors converge on this and the reasons are in Findings; the mapping onto our primitives is:

| Layer | Mechanism here | Covers |
|---|---|---|
| Transition, not state | The trigger predicate reads the *delta* between the stored `foreignUpdatedAt` snapshot and the polled record, not the record's current values. A field that is still equal to what it was is not a change | A ticket saved repeatedly while sitting in one state |
| Marker | `itsm_dispatch_ledger`, keyed `(ticketId, triggerKey)` where `triggerKey` names the transition that justified the dispatch. Insert-as-claim with `onConflictDoNothing`, in the same transaction as the decision | The same transition being observed twice — a duplicate poll, an overlapping sweep, a restart mid-pass |
| Backstop | `itsm_ticket_origins.dispatchCount`, with a per-connector ceiling. On breach: stop dispatching, mark the ticket for human attention, surface it on the connector detail screen | Everything the first two got wrong |

The ledger is the inbox pattern with a domain-specific key. The key is deliberately not the foreign record's version — the same version can legitimately justify one dispatch and no more, and naming the transition rather than the revision is what makes the claim idempotent rather than merely deduplicated.

The backstop is not defensive padding, and this is the part worth stating plainly because the tree does not currently protect against it. `startTicketRun`'s rerun gate is wrapped in `if (ticketState === "open")` at `routers/shared.ts:95-107`, and that is the *state type*, not the status key. The seeded status keyed `open` has state type `new`, so a ticket sitting in `open` is dispatchable without `canRerun` ever being consulted. A failed dispatch rolls the status back to `open` (`shared.ts:171-196`). A connector that keeps polling a ticket that keeps updating therefore has a live re-dispatch loop, and the per-run ceilings in `agent/axel/loop.py` do nothing about it — they bound a run, not the number of runs.

The existing guards stay in force underneath: no concurrently running run (`routers/shared.ts:67-83`), and a permitted `startRun` transition, which exists only from `open` and `escalated`.

**Dispatch must be decoupled from creation.** `startTicketRun` throws when no worker is connected and persists nothing. The connector therefore ingests inside the transaction and enqueues dispatch outside it; the sweep retries. This is a small change and it is not optional — without it, every synced ticket that arrives while the agent is restarting is silently never worked.

**The reporter must resolve to a real user row.** `tickets.reporter_id` is `NOT NULL` with a foreign key to `user.id`. A foreign ticket's requester is a foreign identity. Resolve by email against the directory-synced identities first — `directory_identities.external_id` already exists at `db/schema/identity-providers.ts:53` — and fall back to a configured connector service user, recording which path was taken. Collapsing every synced ticket onto one service account is the wrong default for a second reason beyond context quality: `ticket_creation_claims` is keyed `(reporter_id, idempotency_key)`, so a shared reporter narrows the dedupe key's discriminating power.

**Echo suppression.** Our own work note changes `sys_updated_on`, and the next poll will see the ticket as changed. Suppress on all three layers available: record the `foreignUpdatedAt` returned by our own write in `itsm_ticket_origins.lastWrittenAt`; skip an inbound change whose only delta is one we wrote; and filter changes made by our own service account, which client-credentials auth makes identifiable because the integration user is a distinct `sys_user` row rather than a shared human login.

Write-back also populates the platform's own link fields where they exist — `correlation_id` with our ticket reference and `correlation_display` with `Axioma`. That is what ServiceNow's convention is for, it gives the customer's technicians a back-link without a custom field, and it makes the ownership of a record legible from their side during co-existence.

### Mapping

Status mapping is configuration and needs no code, because status keys are open vocabulary — `shared/index.ts:58-59` says so directly, and behaviour reads `state_type`, `is_closed` and `pauses_sla` rather than the key. A customer's status names become rows in `ticket_statuses` with our flags set, and the connector maps foreign key to local key.

The closed enums are where mapping actually costs something, and one of them is worse than it looks:

| Our field | Vocabulary | Mapping note |
|---|---|---|
| `status` | Open | Configuration. Add the customer's names as rows |
| `record_type` | Closed: `incident`, `service_request` | Everything foreign must land on one of two values |
| `impact`, `urgency` | Closed: `high`, `medium`, `low` | Direct enum-to-enum map |
| `priority` | Closed `P1`–`P4`, and **derived** | Cannot be mapped. `derivePriority(impact, urgency)` at `shared/index.ts:93-101` is a fixed 3×3 matrix. A foreign priority must be mapped *into* impact and urgency and re-derived, and the result will not always equal the foreign priority. Say so in the mapping UI rather than letting an administrator discover it |
| `resolution_code` | Closed, six values | Outbound only |

Unmapped values take a per-field policy — reject the record, apply a default, or quarantine it into the run summary for an administrator. Default to quarantine: rejecting loses the ticket, defaulting lies about it.

### Environment resolution

**Environment is a property of the connector, not of the ticket.** For a synced ticket the order is: the connector's environment routing table, then the connector's default environment. The ticket and CMDB steps of Phase 1's order are deliberately skipped, and the reason is not caution — it is that neither works here.

The CMDB step is empty. `ticket_cmdb_objects` is written in exactly two places: a manual link from the dashboard (`routers/cmdb.ts:145`) and `recordObservation` (`tools/cmdb.ts:208`), which runs *during* a run. A ticket that has not been worked yet has no CI link, so `readContextForTicket` returns nothing for it and the CMDB step cannot resolve anything for a first-time ticket. This is true of portal tickets too; it is simply invisible there because the default is usually right.

The ticket step is worse than empty — it is unsafe, and the reason is sharper than "foreign data is untrusted". Phase 1's rule permits a structured ticket field validated against the `environments` table, which is sound inside our own system because our RBAC decides who may write that field. Across the boundary, **the write-authorization for every foreign field is configured in a system we do not administer and cannot introspect.** ServiceNow ACLs are deny-first and field-level, and restricting even `assignment_group` requires explicit ACL configuration — by default an `itil` user can edit it, and description, impact, urgency and caller stay editable unless deliberately locked ([restricting assignment group updates](https://www.servicenow.com/community/developer-forum/restricting-assignment-group-updates-on-incident-form-based-on/td-p/3341800), [ACLs are deny-first](https://www.servicenow.com/community/service-management-forum/how-to-create-acl-for-assignment-group/m-p/406631)). We cannot know which foreign fields are filer-writable, and the answer differs per customer and changes without telling us.

The service field cannot stand in for it either, and this is the part most easily got wrong. Service looks like a safe proxy because Phase 1 hangs environment off it. But the incumbent's own answer to the chronically-unpopulated CI problem is to **classify the service from the free-text description** using a model trained on historical records ([multi-method assignment group prediction](https://www.servicenow.com/community/now-assist-articles/multi-method-assignment-group-prediction-with-now-assist/ta-p/3562536), [Predictive Intelligence use cases](https://www.servicenow.com/community/platform-analytics-forum/predictive-intelligence-in-servicenow-20-real-time-use-cases/m-p/3444290)). If service is derived from text and environment is derived from service, then ticket prose selects the cluster — which is exactly the path Phase 1 exists to close, reintroduced one indirection further out.

So the two are decoupled for synced tickets. **Service is mapped freely** — it drives routing, SLA policy, and display, and classifying it from text is fine for those. **Environment never follows from service on a synced ticket.**

What resolves it instead is `itsm_environment_routes`: an administrator-configured table on the connector mapping a foreign field value to an `environments.key`. It is an allowlist, not a trust decision. A foreign value that is not in the table falls through to the connector's default; a foreign value cannot name an environment an administrator did not already list; and the blast radius of a compromised or mis-ACL'd foreign field is bounded by the set the administrator chose for that connector. Point the default at the most restricted environment and the failure mode of every unmapped case is "too little access", not "too much".

This also removes a design hazard in the obvious alternative. Running one connector per environment, each scoped to a foreign filter, would mean the same foreign ticket could match two connectors' filters and be ingested twice — the unique index is `(connectorId, externalId)`, so it would not stop that. One connector per foreign instance, with routing inside it, makes double ingestion unrepresentable.

### SLA

The customer's SLA model will not map onto ours, and the plan does not attempt to map it.

`ticket_stopwatches` accumulates elapsed working time against a business-hours calendar and there is no deadline column — deliberately, because a deadline cannot express a pause. A foreign SLA is a commitment made in the customer's system, computed by their calendar, reported by their tooling. It is theirs.

So: `attachTicketStopwatches` keeps running on a synced ticket, because elapsed working time is true regardless of whose commitment governs, and our escalation sweeps need it. But on a synced ticket it is presented as Axiōma's own working-time measure rather than as *the* SLA, and **no stopwatch value is ever written back**. Writing our computed `dueAt` into a customer's SLA field would be asserting a commitment we are not party to.

### What stays untouched

`tickets` and every column on it. `assertStandardImageChange` and the one-field cluster write surface. The ten-tool registry. `agent_tool_calls` duplicate suppression. The device channel, entirely — see Trial mode. `ticket_read_messages`, which already gives the agent its read path into the case log and should not be duplicated by a connector-specific reader.

### Contracts and capabilities

`api/src/contracts/connectors.ts`, mirrored by `pnpm contracts:publish`. Procedures: list, create, update, delete, test connection, preview sync, trigger sync, list runs, list write-backs, retry write-back, get and set mappings, list proposals.

Two capability keys in the existing `noun.verb` vocabulary: `connector.read` and `connector.manage`. Not `admin.settings` — a connector holds a credential into the customer's system of record, which is a narrower grant than the one that also covers mail templates and suppliers.

---

## Trial mode

### What shadow mode is, concretely

Phase 1 puts `mode` on `environments` with values `act` and `shadow`, and a guard in `executeTool` that refuses write-effect tools when the environment is in shadow. Two properties of that placement are load-bearing and this phase does not redesign them: the agent is not told, so the transcript records what Axel intended; and the mode is per environment, so production can run shadow while staging acts.

On top of that, this phase adds exactly one thing: **when a run in a shadow environment reaches a terminal state, the API composes the suppressed intent into a work note and posts it to the foreign ticket.** The proposal is not generated. It is the transcript, rendered.

That is the whole point of suppressing at the tool layer rather than adding a "propose" mode to the agent. The proposal came from the same code path that would have acted, so it needs no separate trust argument.

The correction recorded above applies here: Phase 1 cannot implement that guard in three lines, because the API registry has no effect classifier. `ToolHandler` needs an `effect` field before the guard has anything to read.

### What it asks of the customer

Read on incidents and their journal, and write on the journal only.

For ServiceNow that is read on `incident` plus `sys_journal_field`, and write on `sys_journal_field` — a subset of what Moveworks and Aisera ask for, which adds write on `incident`, `sc_request` and `sysapproval_approver` ([Moveworks](https://help.moveworks.com/docs/servicenow-access-requirements), [Aisera](https://docs.aisera.com/aisera-platform/adding-data-to-your-tenant/integrations-and-data-sources/connectors/servicenow-connector)). Asking for less than the market asks for is the point of the trial posture, and it is a claim that can be made without qualification because it is a statement about a grant rather than about performance.

Concretely, what a customer is asked to create is: a `sys_user` service account holding `snc_platform_rest_api_access` and read on the incident table; an OAuth application registry entry with the client-credentials grant, registered as a confidential client; and one ACL permitting insert on `sys_journal_field` for that user. Nothing installed, no update set, no scoped application. That is a smaller ask than the incumbent-side integrations and it is deliberately the whole ask — a security review that has to reason about an installed application is a longer review than one that has to reason about a service account and two grants.

Step 2 of the graduation ladder adds write on `incident` for state and `correlation_id`, and nothing beyond that at any step. Device access is never requested by this connector at all.

No inbound firewall change, because the connector dials out.

No device access at all. The device channel is unauthenticated and plaintext and the device ID is client-asserted (`grpc.ts:114-123`, `grpc.ts:685-689`), so a trial is infrastructure-path only until Phase 3 lands. This is a gate, not a preference.

### What it writes back

One work note per terminal run, internal visibility only, never a public comment.

The distinction matters for the invariant. `architecture.md` records that Axel does not post into the human conversation. A work note is an internal annotation read by IT staff; the employee-facing thread in the customer's portal is untouched. And the write is performed by the API, not by Axel, which is what keeps the credential out of the agent.

Contents, all of which already exist on `RunUpdate` and `agent_steps`: the diagnosis, the evidence, the resolution code, the tools Axel would have called with their validated parameters, and a deep link back to our run. `evidence_tone` is already in the tree as uncommitted work and gives the note a rendered severity.

Delivery is durable. `itsm_writebacks` copies `webhook_deliveries` — `attemptCount`, `maxAttempts`, `nextAttemptAt`, `lastError`, `claimedAt`, exponential backoff via `retryDelayMs` returning `null` to terminate, and an atomic claim by conditional `UPDATE … RETURNING` with lease reclaim (`workflows/webhooks.ts:77-141`, `workflows/core.ts:56-71`). It explicitly does not copy `mail/send.ts`, which logs one row per attempt and never retries.

That answers the carried-in question directly: **yes, write-back must survive an API restart**, and the mechanism to do it already exists in the tree and is already swept from `grpc.ts:1231`.

### Capturing proposal versus actual

`itsm_proposals` records the proposal at post time, and `openedAt` when a human first expands it. A later sync pass fills the outcome columns from the foreign ticket once it closes: the foreign resolution, who closed it, and the work notes added in between. Reviewer judgement lands in `itsm_proposal_verdicts`, one row per suppressed call, so agreement is computed over decisions rather than over documents.

Agreement is then computed rather than asserted, and reported with its limits attached. Three of those limits are documented rather than hypothetical.

The first is that the human's action is not ground truth. A proposal that differs from what the technician did may be better. Shadow-mode research is explicit that shadow validates system behaviour and not user behaviour, and none of the four remedies for that is cheap.

The second is that agreement statistics are worthless if nobody read the proposal, and the base rates say that is the likely case — 49% to 96% alert dismissal, 51.7% to 65.8% commission errors on false positives, and an automation-bias effect that gets worse rather than better with reviewer experience in at least one measured setting. So the evaluation surface reports two things side by side: agreement, and whether the proposal was opened at all. Review latency, rejection rate, and per-reviewer agreement over time are recorded per reviewer, and a reviewer whose approval rate is climbing toward 100% is surfaced rather than averaged away.

The third limit is the metric. Axel's action distribution is imbalanced by design — correct refusal is one of the three flagship scenarios, so escalation is expected to dominate — and raw percentage agreement rewards a system that always says the common thing. Cohen's kappa is the standard correction and is the wrong instrument here for its own reason: under a highly imbalanced distribution the kappa paradox makes it report poor reliability even when the raters agree closely. The surface therefore reports **raw agreement, kappa and Gwet's AC1 together, stratified by action class**, never pooled. Pooling is precisely what would let a system that only ever escalates look like a system that agrees with its technicians.

An honest trial reports "of 200 proposals, 34 were opened, and of those 21 matched what the technician did" — not "89% agreement".

### Graduation

Per the WAF pattern: one class at a time, gated on review having happened, not on time having passed.

| Step | What changes | Precondition |
|---|---|---|
| 1. Comment-only | Connector ingests; environment is `shadow`; work notes post | Read on incidents and their journal, write on the journal. No firewall change |
| 2. Infrastructure writes, one slice | One row added to `itsm_environment_routes` pointing a single foreign value — an assignment group, a support queue — at an environment whose `mode` is `act`. Everything unmatched keeps falling through to the shadow default | A soak over that slice's tickets with proposals actually opened and reviewed; a false-positive review completed, in the WAF sense of examining every counted match; a stated answer to who can file into that slice, since the ticket body reaches the model verbatim; Phase 1 landed, since `mode` and per-environment resolution are its output |
| 3. Infrastructure writes, wider | Further rows added, or the connector default repointed | Each slice repeats step 2's evidence on its own tickets. Repointing the *default* is the last step, not the first, because it is the only change that alters behaviour for traffic nobody has reviewed |
| 4. Device writes | `device_run_action` permitted on synced tickets | **Phase 3, hard.** Device identity is client-asserted and the stream is plaintext; a synced ticket is text from a system we do not control, which is the same prompt-injection surface Phase 5 gates on. Phase 5 Stage A widens the typed action set and does not change this precondition |

Graduation is a configuration change at every step — a row in `itsm_environment_routes`, or a `mode` flip on one environment. That is the property Phase 1's placement of `mode` was chosen for, and the routing table is what makes it reachable from a synced ticket without letting the ticket choose. Neither step is a code change.

Step 4 has a second precondition that is worth stating even though it is outside this phase: nothing in the tree constrains blast radius, and no agent action is approved before it runs. Both are recorded as deliberate scope decisions in `architecture.md`. A customer graduating to device writes should be told that, not left to infer it.

---

## UI changes

Shared primitives come from `axioma/ui/src/components`, listed in `ui/manifest.json`, mirrored by `ui/scripts/publish-ui.mjs`. `dashboard/src/components/ui/` and `portal/src/components/ui/` are the mirror output and carry a `// GENERATED — do not edit.` banner; `--check` byte-compares them in CI. Nothing below edits a mirrored file.

Three primitives need a change at the source, and one needs adding:

| Primitive | Change |
|---|---|
| `ui/src/lib/status-tone.ts` | Add a connector sync-status tone map, keyed by the status union so an added status fails to compile until it is given a tone — the discipline `stateTones` already uses |
| `ui/src/components/ui/badge.tsx` | No change. The `tone` prop already carries `info`/`warning`/`success`/`destructive` |
| `ui/src/components/ui/item.tsx`, `collapsible.tsx`, `table.tsx`, `alert.tsx`, `tabs.tsx` | No change. The connector screens compose from these |
| `ui/src/components/ui/` — new | A `SourceBadge` is *not* needed. A `Badge tone="info"` with the vendor label and foreign key is the whole component, and a one-off wrapper in the dashboard's `support-ui.tsx` is the right home |

Portal's manifest excludes `table`, `tabs`, `sheet` and `sidebar`. Nothing proposed for the portal needs them.

### Dashboard — a ticket that lives elsewhere

**Queue** — `features/tickets/components/ticket-queue.tsx`, `queue-columns.tsx`, `queue-facet.tsx`.

A source column showing a `Badge tone="info"` with the vendor and the foreign key (`INC0010023`), and a queue facet to filter by connector. Both are additive; `queue-facet.tsx` already models facets generically.

**Ticket detail** — `features/tickets/components/ticket-detail.tsx`.

A banner above the tabbed `Card`, using `Alert` with `AlertTitle`, `AlertDescription` and the `AlertAction` slot the primitive already provides: the foreign key, a deep link out, and one sentence saying the record is owned there and worked here. This is the "linked issue / synced from" pattern, and the important part is that it explains rather than merely marks.

Actions that would diverge the two systems are disabled: close, reopen, reassign, reclassify. That is `features/tickets/components/ticket-actions.tsx` and the `allowed-actions.ts` predicate beside it — the predicate is the right place, because it is already the single source of what a ticket permits. A disabled control gets a `Tooltip` naming the reason; a greyed button with no explanation reads as a bug rather than a boundary.

`SlaCountdown` in the right aside is relabelled on a synced ticket — Axiōma working time, not the SLA. Same component, different caption, because the number is still true.

**Transcript** — `features/agent-runs/components/agent-transcript.tsx`, `step-card.tsx`.

Unchanged in `act` mode. In `shadow`, a proposal card renders above the step list, before the reviewer has scrolled through twenty steps.

The rendering already exists in the repo. `EscalationProposal` at `agent-transcript.tsx:320-388` renders a verbatim quoted message and a patch as a `<pre>` where each line is a `<span className="block">` toned by its first character, with the parsing in `escalation.ts`. That is the only diff UI in the tree and it should be generalised rather than duplicated — the suppressed tool calls render through the same path.

Four additions, driven by the automation-bias findings and by the HAX guidelines:

- **Accept and reject record agreement; they do not execute.** In shadow mode the environment forbids the write, so a button that acted would contradict the mode. The affordance captures the reviewer's judgement into `itsm_proposals` and nothing else. The label says so. If the environment is in `act`, the existing `Rerun` control is the execution path and is already there.
- **Evidence before verdict.** `EvidenceBlock` and the tool inputs render above the accept/reject controls, not beside them. Tool output stays collapsed, as it is today.
- **Agreement is per suppressed call, not per proposal.** GitHub's suggested-change model is the precedent: the unit of judgement is the suggestion, not the review. A reviewer who accepts the diagnosis and rejects one step of the fix should be able to say that, and a single verdict per proposal would both lose the signal and flatter the statistics.
- **Reject costs one click.** No confirmation dialog. HAX G8 is *support efficient dismissal*, and the failure mode it guards against is exactly the one the base rates predict — dismissal that costs a modal is dismissal that stops happening, after which every proposal reads as accepted.

One thing this phase does **not** provide, stated rather than glossed: HAX G9 is *support efficient correction*, and a reviewer cannot edit Axel's proposed patch here — only agree or disagree with it. Editing a proposal into an executable action is a different feature with a different approval story, and it belongs with the approval-before-action work that `architecture.md` records as out of scope. G11, by contrast, is where this design is unusually strong and the UI should lean on it: the explanation is the transcript, not a summary written next to it.

**Proposal review** is a facet on the existing queue rather than a new screen. A separate review inbox is the shape that produces approval fatigue, and the research on reserving review for high-stakes catchable actions argues against giving every proposal its own queue row.

### Dashboard — connector administration

A second `/admin/*` route, joining `/admin/roles` as the only other one:

| Route | Screen |
|---|---|
| `routes/_auth/admin.connectors.index.tsx` | Connection list |
| `routes/_auth/admin.connectors.$connectorId.tsx` | Connection detail |

Nav goes in the `navigation` array at `components/layout/app-sidebar.tsx:34`, which `components/layout/command-menu.tsx:17` re-imports, so the entry appears in the ⌘K palette without a second edit. It is gated on `connector.read` by the same inline filter that already hides `/workflows` and `/mailboxes`. `/admin/roles` is currently appended as a separate `SidebarMenuItem` outside the one `SidebarGroup`; two admin entries is the point at which a second group labelled "Administration" earns itself.

**Connection list.** A `Table` of connectors: vendor, label, an enabled dot, last successful sync, records in the last sync, error count. The dot reuses the device pattern at `features/devices/components/devices-table.tsx:35-44` — `size-2 rounded-full` toned `bg-success` or `bg-muted-foreground/50` with an `sr-only` label — because it already exists and already handles the accessibility half.

**Connection detail.** `Tabs variant="line"`, matching ticket detail:

- *Overview* — credential status, watermark position, poll interval, and a sync-history strip. The strip is the portal status page's 90-day uptime bar (`portal/src/features/status/components/service-status.tsx`) applied to the last N syncs: `flex gap-0.5` of `h-8 flex-1 rounded-sm` spans toned by outcome, each with a `title`, plus the `sr-only <ol>` mirror that component already carries. It is the one existing pattern in the tree for showing a run of outcomes at a glance.
- *Mappings* — field and value mapping, plus the environment routing table, below.
- *Runs* — one row per `itsm_connector_runs`, expandable to the jsonb summary via `Collapsible`, with quarantined unmapped values listed. `Sync now` and `Preview` buttons call the same procedure with different modes, as the directory screen does. This is GitHub's "Recent deliveries" applied to syncs.
- *Write-backs* — status, attempt count, next attempt, last error, and a per-row `Retry`. The retry procedure is a thin wrapper over the sweep, exactly as `retryWebhookDeliveries` at `routers/automation.ts:171-175` is.

A ticket that has breached the dispatch ceiling appears on the *Runs* tab as its own row rather than being buried in a summary. It is the clearest possible signal that the trigger predicate is wrong, and burying it would mean the loop is discovered from a bill rather than from a screen.

A disabled connector shows why, prominently. Stripe's auto-disable-and-email is the behaviour being copied; the notification half goes through the existing `send_notification` workflow action rather than a new mechanism.

**Mapping editor.** Two columns — foreign field on the left, ours on the right. Value maps are a `Table` with `NativeSelect` on our side, which constrains the target to the closed enum and makes an invalid mapping unrepresentable rather than merely invalid. Per-field unmapped-value policy is a second `NativeSelect` — not a `RadioGroup`, which `ui/manifest.json` mirrors into the portal only and which the dashboard therefore does not have.

Priority is a special case and the UI must say so rather than offering a control that cannot work. The foreign priority field maps into `impact` and `urgency`; the resulting `priority` is shown as a derived, read-only preview of the 3×3 matrix.

The same tab carries the **environment routing table**, and it is deliberately separated from field mapping by a `Separator` and its own legend, because the two are not the same kind of configuration. A field mapping that is wrong produces a mislabelled ticket; an environment route that is wrong produces a write against the wrong cluster. The right-hand side is a `NativeSelect` over `environments.key`, so an environment that does not exist cannot be typed. The connector's default environment sits above the table, not inside it, and is shown with its `mode` — an administrator adding the first `act` route should be able to see, without navigating, that everything else still falls through to shadow.

The tab carries a **Preview against the last 20 records** button. It runs the pure planner in `preview` mode and shows what each record would become, which is the payoff for the planner being pure and the reason to keep it that way.

**Logic modules ship a paired test.** `escalation.ts`, `run-polling.ts` and `sla-countdown.ts` each have a `*.validation.mjs` node:test file run by `pnpm validate`. Mapping application and the sync-status tone map are logic modules and follow.

### Portal — when it is not the front door

The carried-in question is whether a customer running Axiōma behind their ITSM deploys our portal at all. **The answer is no, and Phase 2's chart must make each component independently optional.** Two front doors for the same request is a worse experience than either alone, and the employee already has one.

That is the primary configuration. A second one is worth supporting because it is what a phased cutover looks like in month three: the portal is deployed for a pilot group while the incumbent remains the front door for everyone else. In that configuration:

- **Synced tickets do not appear in the portal.** The filter is in the query and in the returned shape, not in the component — the invariant at `architecture.md` is explicit that a page rendering nothing sensitive while fetching it is still a leak, and `getMyTicket` is the precedent. A ticket whose front door is elsewhere is excluded by the absence of a portal-visible origin.
- **Ticket creation is hidden when a connector is the front door for that reporter.** `routes/_auth/tickets/new.tsx` and the header link. Portal nav is hard-coded JSX in `components/header.tsx` and duplicated for desktop and mobile, so hiding a link means editing both — worth converting to a data array while making the change.
- **The status page stays.** `routes/status.tsx` is outside `_auth` and serves a different purpose; a customer's ITSM does not usually replace it.

Nothing else in the portal changes. There is no approve/reject UI in the portal today and none is added — proposals are an IT-facing artefact.

---

## Sequencing and scope

### Ships first

One vendor, one direction, one effect class.

0. **The `effect` field on the API tool registry**, if Phase 1 has not already added it. Nothing else in this list is safe without it, because it is what the shadow guard reads. Cheap, and it belongs to Phase 1 — but this phase does not start until it exists.
1. **ServiceNow inbound.** OAuth client credentials with a token cache. Poll on `sys_updated_on` with keyset pagination. Ticket creation through `createTicketInTransaction` with a new `"itsm"` source. `itsm_ticket_origins` and its unique index. `itsm_dispatch_ledger` and the three-layer dispatch gate. `itsm_environment_routes` with a shadow default. Dispatch decoupled from creation.
2. **Shadow work-note write-back.** Durable queue, modelled on `webhook_deliveries`. One note per terminal run, journal only, with `correlation_id` and `correlation_display` populated on their side.
3. **Connector administration.** Both `/admin/connectors` routes, the mapping editor with preview, run history, write-back retry.
4. **Ticket-origin display and disabled actions** in the dashboard.
5. **`itsm_proposals`, `itsm_proposal_verdicts`, and the agreement surface**, including the opened-versus-agreed distinction and per-call verdicts.

ServiceNow first because it is the platform whose customers are least likely to migrate, whose access model is the best documented, and whose MID Server makes the outbound-only argument for us in a security review.

### Deliberately deferred

| Deferred | Why |
|---|---|
| Additional vendors | The transport layer is the only vendor-specific file. Prove the shape once |
| State and field write-back | Requires the conflict-resolution model and per-field ownership. Comment-only is the trial posture and it is sufficient for it |
| Attachments | Dominates migration cost and is not needed to resolve a ticket |
| Catalogue and request mapping | `record_type` has two values; service requests through a foreign catalogue need the approval model mapped too |
| Bidirectional comment sync | The employee conversation stays in the customer's system. Reading it is enough |
| A webhook receiver | Would only serve a hosted deployment, which is not the deployment model |

### Out of scope

Migration tooling. Device writes, which need Phase 3. Our portal as the front door for synced tickets. CMDB write-back into the customer's CMDB — see below. Multi-tenancy, which is decided against rather than deferred.

### The CMDB question, answered once

Both this phase and Phase 4 need it, and the brief asks for one answer.

**When the customer has a CMDB, it is authoritative and we do not write to it.** Ours stays what it already is: an observation store, insert-only, deduped at read time, with provenance on every row. The customer's CI identity is imported as a `cmdb_objects.external_id` under a source discriminator, which is `sys_object_source`'s idea and costs one column.

Writing back would mean asserting our observations into someone's system of record. IRE exists because that assertion is hard even inside one product — identifier entries, priority ordering, reconciliation rules and de-duplication tasks are the machinery ServiceNow needs to decide which source wins for which attribute, and we would be a new discovery source with no track record arriving in the middle of it.

For Phase 4's version of the question, this argues against its third option — API-driven write-back on terminal state — for the connector case specifically. Inside a deployment where our CMDB is the only one, that option remains open on its own merits.

### What would make migration tooling worth starting

Not a feature request. A customer who has run co-existence through a full SLA reporting period, has their status vocabulary mapped and stable, and has named a cutover date. The literature is consistent that the date is the thing that makes a migration finish — open-ended parallel operation decays because staff default to the familiar system ([ITSM migration mistakes](https://itsm.tools/itsm-tool-migration-strategy/)).

One scoping consequence of the retention findings: migration tooling does not need to carry history. No regime found names service desk tickets as a retained record class, and where retention bites it does so through what a ticket evidences. So the tool that matters first moves open work, and closed history is a separate and lower-priority problem usually better answered by a read-only archive than by import. That is also the cheaper order — attachments are what turn a hours-long migration into a days-long one, and closed tickets are where the attachments are.

Before then, the mapping configuration built for the connector *is* the migration's field-mapping matrix, which is the main reason to build the connector's mapping layer as data rather than code.

---

## Open questions

| Question | Why it matters |
|---|---|
| Is shadow mode a trial posture or a permanent mode for high-risk environments? | Carried in, and still open. This plan builds it as a permanent per-environment posture because that is what the `mode` column already is. If it is permanent, the proposal artefact should probably borrow the change-record vocabulary — implementation plan, rollback plan, verification — which the tree already has and which would make a proposal reviewable in a form IT staff recognise. That is a bigger change than this phase scopes |
| Who reads the work note? | The whole trial rests on it. The base rates say most proposals are never opened. Measuring open rate is cheap and is in scope; changing the outcome if the number is bad is not, and there is no obvious second lever |
| What does the customer's service desk see when Axel is wrong? | A confident, well-evidenced, incorrect work note on a real incident is the failure mode that ends a trial. Nothing in the tree currently constrains it, and the automation-bias findings say a wrong proposal is worse than no proposal |
| Does the run transcript stay employee-visible in a connector deployment? | `SYSTEM_PROMPT` tells the model the transcript is read by IT staff *and* the employee, and the reasoning is written for that audience. If the employee's front door is the customer's portal, they never see it — so the instruction is now false, and the reasoning could be written for IT staff alone. Changing it changes what the model writes |
| How is a foreign ticket's origin described to the model? | `build_user_prompt` renders origin as either "submitted by an employee" (portal) or "treat as system-sourced, not an employee claim" (everything else). A synced ticket is neither: the body is employee-written, but it arrives through a system. Both existing branches mislabel it, and the label is a trust signal |
| Does the connector need its own rate-limit budget against the customer's instance? | Freshservice limits per account, not per key, so our polling competes with the customer's other integrations for the same budget. A poll interval that is fine in a lab can degrade a production instance |
| What happens to a synced ticket when the connector is deleted? | `itsm_ticket_origins` cascades, and the ticket becomes indistinguishable from a native one — with its actions re-enabled and its foreign link gone. Probably wrong, and the answer is likely `restrict` rather than `cascade` |

## Progress Log

Append-only. Date, what was done, what remains, any blocker.

---

**2026-08-30 — Research session. Findings and plan appended above.**

Done: the research half of this document, plus the plan deliverable in its six required sections. Every constraint in the brief was verified against the tree; four were wrong or incomplete and are corrected in Findings.

**Blocker, recorded rather than worked around: Phase 1 has not landed.** `api/src/db/schema/` has no `environments.ts`, `rg "environments"` over the schema directory returns nothing, and Phase 1's own Progress Log is empty. This document's Sequencing section says to run after Phase 1 lands, and the reason given is that the integration-shape deliverable maps a foreign ticket schema onto ours while Phase 1 is changing ours.

That was judged not to warrant stopping, for a specific reason: the brief pre-commits Phase 1's output in its Constraints section and instructs that it be treated as given. The plan is therefore written against Phase 1's *documented* contract rather than observed code. The following assumptions must be re-verified when Phase 1 lands, and the plan corrected if any is wrong:

- `environments` exists with a stable string `key` and a `mode` column taking `act` and `shadow`, defaulting to `act`.
- A single guard in `executeTool` refuses write-effect tools when the environment is in shadow.
- Environment resolution is server-side and authoritative, ordered ticket, then CMDB, then configured default.
- A service-to-environment association exists, so "the environment linked to this ticket's service" is expressible.

One correction for Phase 1 to absorb rather than discover: its shadow guard is not three lines. The API tool registry has no read/write effect classifier — `ToolHandler` is `{input, verifiedBy?, run}` at `api/src/server/tools/index.ts:34-38`, and effect exists only on the Python side as `Effect.READ`/`Effect.WRITE` at `agent/axel/tools.py:27-29`. An `effect` field has to be added to the API registry before the guard has anything to read. The only effect-adjacent logic in the API today is a name-prefix heuristic used for the progress marker at `tools/index.ts:136-146`, which is not a sound basis for a security guard.

Second item for another document's owner: `01-multi-environment.md:48` and `03-device-channel-auth.md:12` both reference `connector-plan.md`, which does not exist. It is a stale name for this file. Left unedited — those are other phases' documents.

Third, and the most consequential fact found: when no agent worker is connected, `startTicketRun` throws `SERVICE_UNAVAILABLE` and persists nothing (`api/src/server/routers/shared.ts:84-87`). For a portal ticket a human sees the error. For a synced ticket nobody is watching, so the run is silently never started. The plan handles this by decoupling dispatch from ingestion, but it is worth knowing outside this phase too.

Remains: no production code, per this document's instruction that the research session writes none. The plan's step 1 is ServiceNow inbound polling; it should not start until Phase 1 has landed and the four assumptions above are checked.

Research note: `context7` and `chrome-devtools` MCP servers failed to connect this session (`CONNECT_TIMEOUT`), so library documentation came from vendor primary sources over web search rather than Context7. Sources are linked inline in Findings. Six parallel research subagents were killed mid-run by an API rate limit; the research was completed sequentially on the main thread instead, which is why the findings are broad rather than exhaustive on any single vendor.

**2026-08-30 — Second pass. Research gaps closed, plan updated.**

The first pass answered the brief's research questions unevenly, because six parallel research subagents were killed by an API rate limit and the work was redone sequentially. Five areas the brief asks for were thin or absent and are now covered:

| Gap | What it changed in the plan |
|---|---|
| Authentication models | New Findings subsection. OAuth 2.0 client credentials, confidential client, `snc_platform_rest_api_access`. `itsm_connectors` now stores `clientId` and `clientSecretEncrypted` rather than a generic credential, and the transport layer gains an access-token cache — new work, since directory and mail both use a static bearer and nothing in the tree refreshes a credential |
| `correlation_id` / `correlation_display` | ServiceNow's own convention is the `(source, external id)` pair this plan proposes, arrived at independently. Write-back now populates their side of the link, which also supplies a third echo-suppression signal |
| Regulatory retention | New table in Findings. HIPAA six years, SOX seven, PCI DSS twelve months — none of which names service desk tickets as a retained class. Migration tooling scope narrowed accordingly: move open work, leave history to an archive |
| HAX guidelines G8, G9, G11 | Reject costs one click and gets no confirmation dialog (G8). G11 is where this design is strong and the UI leans on it. G9 is stated as *not satisfied* rather than glossed — a reviewer cannot edit a proposed patch here |
| Partial acceptance | GitHub's suggested-change model makes the suggestion, not the review, the unit of judgement. Added `itsm_proposal_verdicts`, one row per suppressed call. A single verdict per proposal would have flattered the agreement statistics |

Also added a step 0 to the build order: the `effect` field on the API tool registry. It belongs to Phase 1, it is what the shadow guard reads, and nothing in this phase is safe without it.

Still uneven, and recorded rather than hidden: vendor-documented mechanisms for *suppressing duplicate agent runs* remain thin. Moveworks and Aisera publish their permission models in detail and their trigger and dedupe mechanics not at all. The design in this document is therefore argued from our own primitives — the unique index, the watermark, the existing `canRerun` gate — rather than from prior art, and that is the one place a later session should look for better evidence before building.

**2026-08-30 — Third pass. The flagged gap closed, and it found a real defect.**

The second pass recorded one open gap: vendor-documented mechanisms for suppressing duplicate agent runs. That is now researched, and the answer changed the design rather than merely citing it.

Three mechanisms compose, and the vendors are explicit that none is sufficient alone. Trigger on transitions rather than states — ServiceNow's `State changes to Resolved` versus `State = Resolved`, where the latter fires on every subsequent save. Write a persistent, checkable marker and exclude on it — Zendesk's tag pattern, which is the inbox pattern with a domain-specific key. And keep a hard backstop, because an iteration limit *per run* stops single-run internal loops and does nothing about cross-run re-triggering. That last distinction is exactly our situation: `agent/axel/loop.py` bounds a run and nothing bounds the number of runs.

Checking the third against the tree found a defect that is latent today and live under a connector:

**`startTicketRun`'s rerun gate never applies to a ticket in the `open` status.** The gate at `api/src/server/routers/shared.ts:95-107` is wrapped in `if (ticketState === "open")` — that is the *state type*, not the status key — and the seeded status keyed `open` has state type `new` (`api/src/db/migrations/0008_tier1_core.sql:16`). So `canRerun` is never consulted for it. `startRun` is permitted from exactly `open` and `escalated` (`0008_tier1_core.sql:22,27`), and a failed dispatch rolls the ticket status back to `open` (`shared.ts:171-196`).

A human pressing "Rerun" once never encounters this, because the first run moves the ticket to `routing`. A poller does: a synced ticket that keeps updating while sitting in `open` can be dispatched again on every pass. Whether this is a bug in `shared.ts` or a deliberate allowance for the `new` state is a question for the phase that owns that file; this document does not change it, and instead adds a `dispatchCount` ceiling so that a connector cannot rely on it either way.

Design changes made: `itsm_dispatch_ledger` added (eight tables now, not seven), keyed `(ticketId, triggerKey)` where the key names the transition rather than the revision; `dispatchCount` added to `itsm_ticket_origins`; the ingestion section rewritten around the three layers; and a breached ceiling surfaced on the connector detail screen rather than in a summary, because a dispatch loop should be found on a screen and not on a bill.

Also closed, as the runner-up gap: the agreement metric. Axel's action distribution is imbalanced by design, raw percentage agreement rewards a system that always says the common thing, and Cohen's kappa fails in the other direction under the kappa paradox — reporting poor reliability precisely when the distribution is skewed. The evaluation surface now specifies raw agreement, kappa and Gwet's AC1 reported together and stratified by action class, never pooled.

Remains unchanged: no production code, and Phase 1 is still the hard gate.

**2026-08-30 — Fourth pass. Researched how a foreign ticket reaches a service and a CI. It exposed a hole in this plan's own logic.**

The plan's graduation ladder graduated one service at a time, and its environment resolution read "CMDB, then configured default". Researching how an incoming ticket acquires a service or CI showed that both halves were unsound.

**The CMDB step is empty for exactly the tickets that need it.** `ticket_cmdb_objects` is written in only two places — a manual dashboard link (`api/src/server/routers/cmdb.ts:145`) and `recordObservation` (`api/src/server/tools/cmdb.ts:208`), which runs *during* a run. A ticket that has not been worked has no CI link, so the CMDB step cannot resolve anything for a first-time ticket. True of portal tickets too; invisible there only because the default is usually right.

**Service could not substitute for it.** ServiceNow's answer to chronically-blank `business_service` and `cmdb_ci` — a named CMDB-health failure, tracked as a completeness KPI — is Predictive Intelligence classifying category and assignment group from the **free-text description**. Text is what actually carries the routing signal. Since `tickets.service_id` is `NOT NULL` defaulting to `svc-general`, an unmapped synced ticket does not fail loudly; it silently lands on one service and therefore on one environment.

Put together: if service is derived from text and environment is derived from service, ticket prose selects the cluster. That is precisely the path Phase 1 exists to close, reintroduced one indirection further out. The earlier draft would have shipped it.

**And the argument against trusting a foreign field is stronger than the one first written.** The original text said the value originates in a system whose access controls we do not administer. The sharper statement is that we cannot *know* the controls: ServiceNow ACLs are deny-first and field-level, restricting even `assignment_group` requires deliberate configuration, and description, impact, urgency and caller stay filer-editable unless explicitly locked. Which foreign fields are filer-writable differs per customer and changes without notification.

Changes made:

- Environment is now a property of the **connector**, not the ticket. `itsm_environment_routes` added (nine tables now) — an administrator-maintained, ordered allowlist mapping a foreign field value to an `environments.key`, falling through to the connector default. It is an allowlist rather than a trust decision: an unmapped foreign value cannot name an environment nobody listed, and the blast radius is bounded by the administrator's own choice set.
- Service and environment are explicitly **decoupled** for synced tickets. Service is mapped freely — it drives routing, SLA and display — and never resolves the environment.
- The graduation ladder is rewritten around the routing table: step 2 is one row pointing one foreign queue at an `act` environment while everything else keeps falling through to the shadow default. Repointing the *default* is now the last step rather than an unstated one, because it is the only change that alters behaviour for traffic nobody has reviewed.
- A design hazard removed: one connector per foreign instance, with routing inside it. Running one connector per environment would have let the same foreign ticket match two filters and be ingested twice, which the `(connectorId, externalId)` index does not prevent.
- New Findings subsection, *The affected-CI problem*, carrying the sources.

Runner-up gap, offered and not taken this pass: indirect prompt injection through synced ticket text. It is adjacent — the reasoning above is about which foreign *fields* can steer resolution, not about what the ticket *body* can steer once it reaches the model — and the repository already treats that class of risk as a hard gate elsewhere.

**2026-08-30 — Fifth pass. Prompt-injection research, and the connector implemented.**

Two things this pass, at the user's direction to continue past the research session's own "no production code" rule. That rule is overridden by an explicit instruction, not ignored; the Phase 1 dependency was handled differently, below.

**Research: prompt injection through synced ticket text.** New Findings subsection. A connector does not change the mechanism — a portal ticket body is attacker-chosen text too — it changes the *population* who can write it, since a foreign queue may be fed by a customer-facing portal or an inbound integration under access controls we do not administer. The literature is unusually clear that filtering is the wrong response: prompt injection attacks instruction-following, which is the behaviour the model exists to have, and detection by classifier does not close it. What works is architectural, and Axiōma already has the strong form — ten typed tools, pydantic-validated parameters, no command composition, and a cluster write surface of one field. So the connector adds **no** classifier; it spotlights the foreign body and fixes the origin label, which `prompt.py:63-64` currently gets wrong in both directions for a synced ticket. Graduation step 2 gains a precondition: a stated answer to who can file into that slice.

**Phase 1 landed mid-session.** `environments` with `mode`, `service_environments`, `ticket_environments`, `assertEnvironmentAllowed` with a `WRITE_EFFECT_TOOLS` set, and `aesGcmEncryptSecret` are all now in the tree. The earlier entries recording Phase 1 as a blocker are superseded. Note the shadow guard was solved as a name set rather than the per-handler `effect` field this document proposed — a valid alternative, and step 0 of the build order is therefore done.

**Implemented, all gates green** (`api` and `dashboard`: biome clean, `tsc --noEmit` clean, `contracts:check` verified, dashboard `validate` clean, 37 connector unit tests passing):

| Area | Files |
|---|---|
| Pure core | `api/src/server/connectors/mapping.ts`, `plan.ts`, `core.ts` — no database, no network, no clock |
| Transport | `api/src/server/connectors/servicenow.ts` — client-credentials with a token cache, keyset pagination on `sys_updated_on`, `Retry-After` honoured, work notes with `correlation_id`/`correlation_display` |
| Store and runtime | `store.ts`, `runtime.ts`, `writeback.ts` |
| Schema | `api/src/db/schema/connectors.ts`, nine tables; migration `0043_itsm_connector.sql` |
| Contracts and router | `api/src/contracts/connectors.ts`, `api/src/server/routers/connectors.ts`, capability `admin.connectors` |
| Dashboard | `features/connectors/components/{connectors-page,connector-detail,ticket-origin-banner}.tsx`, routes `admin.connectors.index.tsx` and `admin.connectors.$connectorId.tsx`, sidebar entry |

Decisions taken during implementation that differ from the plan above:

- **Capability is `admin.connectors`, not `connector.read`/`connector.manage`.** Phase 1 established `admin.environments` while this was being written; matching that precedent beats introducing a second shape. `getTicketConnectorOrigin` is gated on `ticket.read.all` instead, because every agent who can see the ticket needs to know the record is owned elsewhere — otherwise the disabled controls read as a bug.
- **`targetField` is typed with the shared vocabulary in the schema**, so a mapping cannot name a field that does not exist. `priority` is absent from that vocabulary, which makes "map a foreign priority" fail to typecheck rather than fail at runtime.
- **The pure/effect split was forced by the test run**, not chosen for elegance: `writeback.ts` imports `@/db`, which loads `env.ts`, which now requires Phase 3's TLS variables — so the pure half moved to `core.ts`, mirroring `workflows/core.ts` beside `workflows/webhooks.ts`.

**Blocker, recorded and not worked around: `0032_multi_environment.sql` is an empty 53-byte placeholder.** Phase 1's schema code and journal entry exist, but its migration was never written, so `environments` does not exist in the development database and `drizzle-kit migrate` fails before reaching `0043`. Writing that migration is Phase 1's work and this session did not do it — the program plan forbids expanding scope into another phase to unblock oneself.

`0043_itsm_connector.sql` was verified independently instead: on a scratch database cloned from the development one, with `environments` stood up from its schema definition, all 44 statements apply and produce 9 tables, 25 indexes, 18 foreign keys and the seeded `itsm` origin row. The scratch database was dropped. The migration is correct and will apply as soon as Phase 1's is written.

Also unverified, and honestly so: nothing has run against a real ServiceNow instance. The transport's request shapes come from the vendor documentation cited in Findings, not from observed responses — in particular `parseJournal`, which reads a flattened display string, is the piece most likely to need correcting against a real instance.

Still not built, deliberately, and listed so the next session does not have to re-derive it: the shadow-mode proposal card and per-call verdicts (`itsm_proposals` and `itsm_proposal_verdicts` exist as tables and are not yet written to or read), the write-back queueing call on terminal state, the field-mapping and environment-route *editors* (both are rendered read-only today), connector create and edit forms, and the portal-side changes. The agreement surface — raw agreement, kappa and AC1 stratified by action class — is designed and unbuilt.

**2026-08-30 — Sixth pass. Work-note research, and the loop closed.**

**Research: what makes a work note get read.** The trial's premise is that a technician reads the note, and the base rates recorded earlier say most will not. The service-desk literature is thin and generic — write for the next technician, the team lead and the auditor; a resolution nobody can find later was not documented. The useful frame is elsewhere: the note is a machine-generated message competing for attention, and SRE alerting has a documented test for those. **If the recipient cannot take a specific action from it, it should not exist**, and the recommended shape leads with what happened and *what to do first*. There is a matching noise rule: alerts that do not result in action 80–90 percent of the time should be tuned or removed ([SRE alerting best practices](https://incident.io/blog/sre-alerting-best-practices), [Google SRE Workbook on alerting](https://sre.google/workbook/alerting-on-slos/), [alert management practices](https://rootly.com/alert-management/alert-management-best-practices), [documenting support incidents](https://www.ituonline.com/blogs/best-practices-for-documenting-support-incidents-and-resolutions/)).

The note written in the fifth pass led with the diagnosis and never said what the human should do. `renderWorkNote` now opens with a `What to do:` line, above everything else, and every branch names something a person can do — including the branch where the answer is that nothing is needed, because "no action" is itself a decision and saying it plainly is what stops the note being re-read. The noise rule is not implemented and is recorded as an open question below.

**Implemented this pass** — 48 connector unit tests passing, `api` and `dashboard` `tsc --noEmit` clean, both biome clean, dashboard `validate` clean, contracts and proto fresh:

| Piece | Where |
|---|---|
| Terminal write-back — the missing link that makes the connector post at all | `connectors/terminal.ts`, called fail-soft from `grpc.ts:1179` |
| Suppressed-call capture | `suppressedCallsForRun` reads the guard's refusals back out of `agent_steps` |
| Proposal recording | `itsm_proposals`, one row per run, `onConflictDoNothing` on `runId` |
| Agreement statistics | `connectors/agreement.ts` — raw, Cohen's kappa and Gwet's AC1, stratified by action class |
| Proposal review UI | `features/connectors/components/proposal-card.tsx`, above the step list in the transcript |
| Agreement UI | Agreement tab on the connector detail screen |

Three details worth recording because they are decisions, not mechanics:

- **The shadow guard's refusals are the proposal.** Nothing new is generated: `assertEnvironmentAllowed` throws before any cluster call, the gateway records the refusal as a step, and `suppressedCallsForRun` reads those steps back. The proposal is therefore the transcript, produced by the code path that would have acted — which is the property the whole design rests on, now actually load-bearing rather than aspirational.
- **`openedAt` is recorded on render, not on a click.** Requiring an interaction to record that someone looked would undercount exactly the cases worth counting.
- **The kappa paradox is a test, not a footnote.** `agreement.test.ts` asserts that on nineteen-of-twenty agreement in a single dominant class, raw agreement exceeds 0.9, Cohen's kappa falls below 0.2, and AC1 stays above 0.8 — the exact skew Axel's action distribution has. It fails if anyone later "simplifies" the surface down to one number.

Still unbuilt, and now a short list: the field-mapping and environment-route **editors** (both render read-only; the upsert and delete procedures exist and are unused by any UI), connector create and edit forms, the foreign-resolution back-fill that fills `itsm_proposals.foreignResolution` on a later sync pass — until that runs, the agreement surface compares against a null and reports everything as `escalate` — and the portal-side changes.

Unchanged from the fifth pass: `0032_multi_environment.sql` is still an empty placeholder, so `0043` cannot be applied by `drizzle-kit migrate`; and nothing has run against a real ServiceNow instance.

| Question | Why it matters |
|---|---|
| Should a note that never results in action stop being posted? | The SRE rule says an alert that does not produce action 80–90% of the time should be tuned or removed. `openedAt` and the verdicts make that measurable per action class. Acting on it means a connector that posts less over time, which is the opposite of what a demo wants and probably right |
| What fills `foreignResolution`? | The agreement surface is inert without it. It needs a sync pass that revisits closed foreign tickets, which is a second read path with its own watermark |

**2026-08-30 — Seventh pass. Verification research, and the remaining gaps closed.**

**Research: how to verify a vendor integration you cannot reach.** The transport had no tests, so "48 tests passing" proved nothing about whether it talks to ServiceNow correctly — the largest honesty gap in the work.

Two findings. First, a free **Personal Developer Instance** is provisioned in minutes, supports REST integration, and hibernates after ten days idle, waking in three to five minutes ([PDI guide](https://developer.servicenow.com/print_page.do?release=xanadu&category=developer-program&identifier=personal-developer-instance-guide-introduction&module=guide), [PDI FAQ](https://developer.servicenow.com/print_page.do?release=yokohama&category=now-platform&identifier=pdi_faq&module=guide)). That is the real path to closing the gap and it needs a human to sign up.

Second, on testing without one: cassettes and hand-written mocks both drift, and neither detects it — "a mock is a fiction you maintain by hand". A cassette's currency is at least visible in git history. The recommended discipline is to keep fixtures **traceable to provider documentation** and route a thin CI slice through the real API ([Pact comparisons](https://docs.pact.io/getting_started/comparisons), [mocking third-party APIs](https://qajobfit.com/resources/mocking-third-party-apis-in-tests), [self-hosted mocking and contract testing](https://www.bigiron.cc/guides/self-hosted-api-mocking-and-contract-testing)).

`servicenow.test.ts` follows that: seventeen tests, each fixture annotated with the field semantics it assumes, and a header stating plainly that these were authored from documentation rather than recorded — so they prove shape-handling, not correctness.

**Writing them found a real defect.** `URLSearchParams` encodes a space as `+`, which means space only under form-encoding rules. A `sys_updated_on` value read literally would have broken the watermark **silently** — returning everything or nothing, with no error. The query is now built with `encodeURIComponent`, which emits `%20` and is unambiguous under both readings. This is exactly the class of bug that survives a green unit suite and dies on first contact with a real instance, and it was found by writing the test rather than by reading the code.

**Also implemented this pass** — 65 connector tests passing, both projects `tsc` clean, both biome clean, dashboard `validate` clean, contracts fresh:

- **Connector create form** (`connector-form.tsx`). The feature was previously unreachable: `createConnector` existed with no UI. The secret is a write-only field, and the default-environment picker states the consequence at the point of choice — selecting an `act` environment changes the description to say that unmatched tickets will be worked for real.
- **Proposal outcome back-fill** (`backfillProposalOutcomes`, `fetchIncidentState`), wired into the connector tick. Without it the agreement surface compared against null and reported every row as the same class. It is a second read path on purpose: the watermark answers "what changed", this asks "what became of the ones we proposed on". A ticket the customer never closes is never scored, which is correct — there is nothing to compare against.

**Remaining, and now genuinely short:**

| Item | Note |
|---|---|
| Phase 1's `0032_multi_environment.sql` | Still an empty 53-byte placeholder. `0043` cannot be applied until it is written. Not this phase's work |
| A real-instance smoke test | Needs a PDI, which needs a human to sign up. `parseJournal` is the assumption most likely to be wrong |
| Mapping and route editors | Read-only; upsert and delete procedures exist and are called by nothing |
| Portal changes | None written |
| DB-level tests | `store.ts`, `runtime.ts`, `writeback.ts`, `terminal.ts` have no coverage below the pure layer |

The last one is worth stating without softening: 65 green tests cover the decisions — the dispatch gate, mapping, backoff, the kappa paradox, the transport's request shapes. They cover none of the code that touches the database. Green here means the reasoning is right if the plumbing is, and the plumbing is unproven.

**2026-08-30 — Eighth pass. Database-level tests, and the Phase 1 blocker resolved elsewhere.**

**Research: isolating Postgres tests.** Three approaches, with a decisive constraint. Transaction rollback is fastest but **breaks when the code under test opens its own connection or commits independently** — which `createConnectorStore` does, one transaction per decision. Cloning a database per test is isolated but slow, and slower still here: the template is 128 tables and is held open by the running dev server, which is exactly how the first attempt failed. Testcontainers is the usual answer at scale and is more machinery than this needs ([Postgres for integration tests](https://gajus.com/blog/setting-up-postgre-sql-for-running-integration-tests), [Testcontainers Postgres in Node](https://qaskills.sh/blog/testcontainers-postgres-node-guide), [database per test](https://qaskills.sh/blog/testcontainers-postgres-per-test-database)).

The resolution is that the limitation does not apply to what actually needed testing. The untested claim was not "the store's control flow works" but "the constraints the design relies on exist in Postgres" — and those are exercised through raw SQL on one connection, which is precisely the case rollback isolation handles. `schema.db.test.ts` follows the repo's own `{ skip: !databaseUrl }` convention, runs in 740ms, and commits nothing.

Seven assertions, each naming an invariant the design depends on: the ingestion idempotency index refuses a second ticket for one foreign record; one transition claims at most one dispatch while a different transition on the same ticket claims separately; `attempt_count <= max_attempts` is enforced by the database and not only by the sweep; a connector owning synced tickets cannot be deleted out from under them; one proposal per run, so a replayed terminal cannot double-count; and the `itsm` origin vocabulary row exists.

**The Phase 1 blocker is resolved, by another session rather than by this one.** The migration files were renumbered while this work was in progress: `0032_multi_environment.sql` is gone, Phase 1's is now `0034_multi_environment.sql` at 4862 bytes and is real, Phase 3's is `0044_device_channel_auth.sql`, and a `0045_device_command_proposals.sql` has appeared. `0043_itsm_connector.sql` survived the renumbering, the journal is consistent at 37 entries, and 39 migrations are applied to the development database — including this one. `environments` exists, all nine `itsm_*` tables exist, and the `itsm` origin row is seeded. **The entries in the fifth and seventh passes recording that migration as unapplicable are superseded.**

**Also implemented:** the environment **route editor** (`route-editor.tsx`), replacing the read-only table. Adding a route pointing at an acting environment is what graduates one slice of traffic, so the editor states that at the point of the action and shows every environment with its mode beside it.

Gate state: 72 connector tests passing with and without `DATABASE_URL`, `api` and `dashboard` `tsc` clean, both biome clean, dashboard `validate` clean, contracts and proto fresh.

**Remaining:**

| Item | Note |
|---|---|
| Real-instance smoke test | Needs a ServiceNow PDI, which needs a human to sign up. `parseJournal` is the assumption most likely to be wrong |
| Field-mapping editor | The route editor is writable; the field-mapping table is still read-only. `upsertFieldMapping` and `deleteFieldMapping` exist and are called by nothing |
| Portal changes | None written. The carried-in question was answered — the portal is optional in a connector deployment — but the conditional hiding is not implemented |
| Store and runtime control flow | The constraints are now tested; the code paths that drive them are not. `store.ts`, `runtime.ts` and `writeback.ts` have no test that exercises their sequencing |

**2026-08-30 — Ninth pass. A defect found by being asked whether the work was done.**

`TicketOriginBanner` told the reader that closing, reopening, reassigning and reclassifying were disabled on a synced ticket. They were not. `useForeignOwned` was written, exported, and called by nothing, so the banner stated something false — worse than the unexplained disabled state the plan set out to avoid, because a reader had no reason to doubt it.

Now wired into `ticket-actions.tsx` through a `FOREIGN_WITHHELD` set covering `resolve`, `close`, `reopen`, `assign` and `reclassify`. Reading, commenting and running the agent stay available: the ticket is worked here and merely owned there.

Worth recording as a pattern rather than a one-off. The predicate and the explanation were written in the same file specifically so they could not drift, and they drifted anyway — because nothing failed when only one of them was used. A test asserting that a foreign-owned ticket withholds those actions would have caught it; there isn't one, and the dashboard has no test harness for component behaviour.

**2026-08-30 — Tenth pass. The remaining buildable items.**

Three items closed, which empties the list of work this session could do without a live ServiceNow instance.

**Field-mapping editor** (`mapping-editor.tsx`). The target is a select over `ITSM_MAPPABLE_FIELDS`, so an invalid target is unrepresentable rather than merely rejected, and the note says why `priority` is absent — an option missing with no explanation looks like an oversight rather than a decision. Value maps are entered as `foreign = ours` lines, because a real status vocabulary is a dozen entries and pasting them beats twelve clicks.

**Preview renders decisions.** It previously ran the same computation an apply runs and then threw the answer away into a toast. It now shows, per record, what would happen, which environment it resolved to and by which route, and whether it would start a run — with unmapped values called out above the table. This is the payoff for the planner being pure, and it was the one place the plan's own promise ("preview against the last 20 records") was unmet.

**Portal.** Synced tickets are excluded from the reporter-scoped queries in SQL, not in a component — the boundary is data shape, following `getMyTicket`'s precedent. `portalIsFrontDoor` gates both create links; the portal nav is duplicated for desktop and mobile, so gating one alone would have left the other reachable.

**A pre-existing failure now blocks the portal typecheck, and it is not this phase's.** `portal/src/routes/_auth/home.tsx` calls `orpc.enrollDevice`, which exists in no contract — another session added device-enrolment UI ahead of the procedure that backs it. `pnpm check-types` in `portal` therefore reports two errors, both in that block. The portal changes above are unaffected; `biome` is clean and no other file errors.

Gate state: `api` `tsc` clean and 72 connector tests passing, `dashboard` `tsc`, `validate` and lint clean, `portal` lint clean with the two inherited errors above, contracts and proto fresh.

**What genuinely remains:** a smoke test against a real ServiceNow instance, which needs a Personal Developer Instance and therefore a human to sign up. `parseJournal` is the assumption most likely to be wrong. Beyond that, `store.ts`, `runtime.ts` and `writeback.ts` still have no test exercising their sequencing, and the dashboard has no harness for component behaviour — which is how the disabled-actions defect in the ninth pass survived being written.

**2026-08-30 — Eleventh pass. Three §4 items that had been missed, and a flaky test made honest.**

The previous entry claimed everything buildable was done. That was wrong. Checking §4 against the tree rather than against memory found three of its own requirements unimplemented: the queue source column, the queue source facet, and the SLA relabel on a synced ticket. All three are now built.

**SLA relabel.** On a ticket owned by a foreign service desk the stopwatch card is titled "Axiōma working time" rather than "Service levels", with a line saying it is not the customer's SLA. That commitment is made in their system, computed by their calendar, reported by their tooling; presenting our elapsed working time under the same heading would assert a commitment we are not party to. Nothing about it is written back, for the same reason.

**Queue source column and facet.** `connectorLabel` and `externalKey` are correlated subqueries on the ticket list — matching the columns around them, so a ticket with no connector origin stays a single row. The facet is built only from connectors that own at least one ticket, and the control renders only when that list is non-empty, so a deployment without a connector is never shown an always-zero filter. A `connectorId` filter was added to `listTickets` alongside it.

**A flaky test, diagnosed rather than deleted.** The database tests passed alone and hung for thirty seconds when the suite ran all six connector files in parallel. `lock_timeout` at four seconds did not fire, which ruled out row contention and pointed at the connection rather than the query. The cause was a client per test: six files in parallel against a development database that also has a dev server attached was enough connection churn to stall. One connection for the file, opened lazily and closed in `test.after`, removes the variable — and since every test rolls back, sharing it costs no isolation. 72 of 72 passing on three consecutive full-suite runs.

Recording it because the first instinct was to mark the file as needing serial execution, which would have hidden a real defect in the test harness behind a configuration flag.

Final gate state: `api` — `tsc` clean, biome clean, contracts and proto fresh, 72 tests passing. `dashboard` — `tsc` clean, `validate` clean, biome clean. `portal` — biome clean, with two inherited `tsc` errors from `orpc.enrollDevice`, a procedure another session's UI calls and no contract defines.

**What remains is one item, and it needs a person:** a smoke test against a real ServiceNow instance. A Personal Developer Instance is free and provisioned in minutes, but signing up is not something this session can do. `parseJournal` — which reads a flattened display string — is the assumption most likely to be wrong, and `servicenow.test.ts` annotates each fixture with the field semantics it assumes so a failure there names which one broke.
