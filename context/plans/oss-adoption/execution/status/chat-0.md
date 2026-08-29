# Chat 0 — domain refactor

Last updated: 2026-08-29
Branch: main

## Done
- Analysis complete: 140 unique contract procedures and 140 matching router procedures.
- Contracts and routers are split by product domain; all `tier*.ts` files and the dashboard `features/tier4` bucket are removed.
- Baseline and final OpenAPI contain 140 paths and 182077 bytes. The only raw-byte differences are the two runtime-generated `z.date().default(() => new Date())` timestamps; after removing those volatile default values, the documents are identical.
- `contracts:publish` synchronized dashboard and portal copies. `db:check` passes; no schema or migration was added.
- Authorization net confirmed composed-router based and passes; it does not read router source.

## Reconciled domain-to-file map

| Domain | Contract procedures | Router procedures / target |
|---|---|---|
| platform | `healthCheck` | `healthCheck` → `shared.ts` (the target has no platform file) |
| identity | `privateData`, `listRoles`, `getRole`, `updateRoleCapabilities`, `assignRole`, `listTeams`, `updateTeam`, `listAuthProviders`, `previewDirectorySync`, `applyDirectorySync` | same → `identity.ts` |
| tickets | `createTicket`, `listTickets`, `getTicket`, `getMyTicket`, `heartbeatTicketPresence`, `listTicketPresence`, `submitTicketCsat`, `addTicketMessage`, `addMyTicketMessage`, `listTicketLinks`, `linkTickets`, `unlinkTickets`, `mergeTickets`, `unmergeTicket`, `listTicketAudit`, `listTicketTimeEntries`, `addTicketTimeEntry`, `lookupTicket`, `listTicketAssignmentOptions`, `updateTicket`, `ticketStats` | same → `tickets.ts` |
| agent-runs | `startRun`, `getRun`, `cancelRun` (contract schemas live with tickets because target contracts omit agent-runs) | same → `agent-runs.ts` |
| devices | `listDevices`, `listMyDevices`, `enrollDevice`, `listDeviceCommands` | same → `devices.ts` |
| catalogue | `listCatalogue`, `listRequestCatalogue`, `createCatalogueRequest`, `listApprovals`, `decideApproval`, `getMyApprovalStatus` | same → `catalogue.ts` |
| problems | `listProblems`, `getProblem`, `createProblem`, `updateProblem`, `linkProblemTickets`, `closeProblem`, `getTicketServiceRecords` | same → `problems.ts` |
| changes | `listChanges`, `getChange`, `createChange`, `updateChange`, `voteOnChange` | same → `changes.ts` |
| knowledge | `listKnowledgeArticles`, `getKnowledgeArticle`, `createKnowledgeArticle`, `updateKnowledgeArticle`, `listPublicKnowledge`, `getPublicKnowledgeArticle` | same → `knowledge.ts` |
| cmdb | `listCmdbClasses`, `createCmdbClass`, `updateCmdbClass`, `deleteCmdbClass`, `listCmdbObjects`, `cmdbImpact`, `listTicketCmdbObjects`, `linkTicketCmdbObject`, `unlinkTicketCmdbObject` | same → `cmdb.ts` |
| automation | `listFieldDefinitions`, `createFieldDefinition`, `setFieldDefinitionActive`, `listTicketRules`, `createTicketRule`, `updateTicketRule`, `deleteTicketRule`, `listWorkflows`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`, `listWebhookDeliveries`, `retryWebhookDeliveries`, `listNotifications`, `markNotificationRead`, `listSavedViews`, `createSavedView`, `updateSavedView`, `deleteSavedView`, `reconcileSearch`, `listApiKeys`, `createApiKey`, `updateApiKey`, `revokeApiKey`, `search`, `getDashboardArrangement`, `setDashboardArrangement` | same → `automation.ts` |
| assets | `listAssets`, `previewAssetImport`, `importAssets`, `listAssetImportRuns`, `listAssetImportRejections`, `listAssetHistory`, `setAssetDynamicFields`, `checkoutAsset`, `checkinAsset`, `listSoftwareEntitlements`, `createSoftwareEntitlement`, `allocateSoftwareLicence`, `revokeSoftwareAllocation`, `readSoftwareCompliance` | same → `assets.ts` |
| scheduling | `setTicketSchedule`, `snoozeTicket`, `listCalendar`, `listRecurrences`, `createRecurrence`, `updateRecurrence`, `deleteRecurrence`, `triggerRecurrences` | same → `scheduling.ts` |
| status | `readStatus`, `upsertStatusService`, `upsertImpactLevel`, `createStatusIncident`, `updateStatusIncident` | same → `status.ts` |
| mail | `ingestChannelMessage`, `listEmailTemplates`, `createEmailTemplate`, `updateEmailTemplate`, `deleteEmailTemplate`, `listEmailTemplateRules`, `setEmailTemplateRule`, `deleteEmailTemplateRule`, `listEmailSendLog` | same → `mail.ts` |
| documents | `listDocuments`, `createLinkDocument`, `unlinkDocument` | same → `documents.ts` |
| suppliers | `listSuppliers`, `listContracts` | same → `suppliers.ts` |

## Shared boundaries and helper homes
- `contracts/shared.ts`: `id`, `nullableId`, `impact`, `priority`, `jsonRecord`, `capability` only.
- `routers/tickets.ts`: `findTicket`, `findTicketMessages`, `decodeCursor` (plus ticket-local selection/cursor helpers).
- `routers/agent-runs.ts`: `getRun`.
- `routers/shared.ts`: exported `startTicketRun` only, plus platform `healthCheck` router because no platform domain exists.
- No other file-local router helper crosses prospective domains.

## Decisions / code-over-brief notes
- The newer brief's explicit helper table overrides execution README lines 92–95: four helpers do not go into the shared bucket.
- `healthCheck` is platform health, not service status. With no platform target file, its contract uses the minimal extra `health.ts`; its router remains alongside cross-domain orchestration in `routers/shared.ts`.
- `startTicketRun` must avoid a `tickets -> shared -> tickets` cycle; pass the found ticket into it from ticket creation, while the agent-runs caller obtains it through exported `findTicket`.
- Contract import discipline currently passes. Authorization policy is ready.

## Baseline gates
- API Biome: blocked by 5 pre-existing errors (`channel-ingestion.test.ts`, `routers/tier4.ts`, `software-compliance.ts`, `tier3-integration.test.ts`).
- Agent: pass (`ruff`; 40 pytest, despite brief expecting 41).
- CLI: pass (`go vet`, `go build`, all packages).
- Dashboard Biome: blocked by 4 pre-existing formatting errors.
- Portal Biome: blocked by 1 pre-existing formatting error.

## Final gates
- API changed-file Biome pass; TypeScript pass; 130/130 tests pass. Full Biome remains blocked by the pre-existing files recorded above.
- Agent `ruff` and 40/40 pytest pass (plan's 41 count is stale).
- CLI `go vet`, `go build`, and all package tests pass (plan's 41 count is stale).
- Dashboard changed-file Biome and TypeScript pass. Full Biome remains blocked by pre-existing files.
- Portal TypeScript pass. Full Biome remains blocked by the pre-existing dynamic request form.
- OpenAPI: 140 paths, structurally and byte-order equivalent after excluding two volatile runtime date defaults.
- `pnpm db:check` pass; no migration introduced.

## Handed off
- The plan's literal byte-identical OpenAPI requirement is impossible across separate process starts while schemas contain `z.date().default(() => new Date())`; two serialized defaults differ by capture time. All stable bytes/schema semantics match.
