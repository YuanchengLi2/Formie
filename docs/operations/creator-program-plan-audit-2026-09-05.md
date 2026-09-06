# Creator program implementation audit — 2026-09-05

## Remediation update

The source findings A1–A8 below were repaired later on 2026-09-05. Forward migrations `202609050024` through `202609050030` are deployed, the RevenueCat webhook repair is deployed, and the website is deployed at `useformie.com`.

- Late provider data now completes the original reward redemption idempotently.
- Unknown provider deductions stay unknown; estimated and approved proceeds use separate fields.
- Apple matching includes transaction/settlement evidence and compatible financial buckets. Matching remains proposed until explicit founder approval.
- Only approved active allocations unlock payout eligibility; commission amounts are immutable and reconciliation corrections append ledger entries.
- Analytics enqueue schedules delivery, drains every acknowledged batch, and retries transient failures.
- Operational metrics, section details, trends, and creator custom ranges use a common half-open interval.
- Questionnaire completion is emitted at the actual transition, and the funnel requires account, payment, first analysis, and second analysis in order.
- Completed duplicate webhooks return before projection metadata can be reset.
- D7 and D30 cohorts now use separate mature denominators, and first-week analysis depth reports its D30 retention relationship.

The historical audit text is retained below to document the defects that prompted the repair. Physical-device purchase, renewal, refund, and fourteen-analysis acceptance still requires a new mobile build and isolated store identities.

## Verdict and scope

The implementation does **not** yet meet the plan's completion criteria. The creator-code screens, ledgers, RPCs, and dashboard routes exist, but source review found correctness defects in reward recovery, financial reconciliation, analytics delivery, and reporting. The earlier statement that only mobile release and live acceptance remained was too strong.

This review treats the user's approved creator-code flow as replacing Branch, link issuance, and deferred installation attribution. Those removed features are not missing requirements. All other bonus, accounting, privacy, reporting, and acceptance requirements remain applicable.

This is an audit, not a repair release. No production records or application source were changed during this audit. The review inspected current source and later migrations that modify the original functions. A fresh Supabase push dry run reported the remote database up to date. That confirms migration parity, not financial or end-to-end correctness.

## Requirement coverage

| Plan area | Evidence in the implementation | Assessment |
|---|---|---|
| Creator-code onboarding | Affiliated creator option, dedicated code screen, server preview, secure pending token, signup finalization | Implemented; device acceptance remains unverified |
| Permanent account attribution | Unique account referral, token hash, 30-day token expiry, 24-hour signup retry window, rate version | Implemented structurally; concurrent code validation and exact rate-effective timing need acceptance coverage |
| Subscription and three-unit bonus | Separate grant, base-first reservations, v2 access snapshot, attempt ownership | Partial: late financial fields can permanently prevent grant completion; bonus base-used snapshot uses old period after renewal |
| First-payment commission | Transaction and redemption ledgers, one-account accrual index, rate snapshot | Partial: replay recovery and missing-value calculation defects |
| Refunds and reversals | Refund/reversal entries and bonus revocation | Partial: refund itself revokes bonus without testing provider access revocation |
| Apple report imports | Private original-file storage, parser, hash, imports, lines, allocation RPC | Partial: timing, compatibility, report completeness, and FX workflow are insufficient |
| Manual payouts | Prepare batch, exact items, paid date/reference, CSV route | Partial: finalization eligibility and ledger immutability defects |
| Product analytics | Secure anonymous identity, bounded persisted queue, event ingestion | Partial: normal session events do not trigger delivery; no queue-draining retry scheduler |
| Founder Overview/Revenue/Creators/Growth | Real RPC-backed pages and metrics | Partial: custom-range, funnel, cohort, and query-bounding defects |
| Creator portal | Membership-derived tenant, authentication, referrals, earnings, account | Implemented structurally; custom dates absent; complete authenticated acceptance unverified |
| Privacy | Creator responses omit exercise/demographic details, reporting suppression, deletion support | Present in source; do not infer complete adversarial/deletion verification from schema tests |
| Release and tests | Forward migrations and function/site deployment work; local unit suites | Partial: required behavioral SQL fixtures and complete live acceptance are missing |

## Confirmed high-priority findings

### A1 — Late payment fields can permanently lose rewards

**Source:** `supabase/migrations/202609040012_referral_bonus_quota.sql:94–105`, function `project_revenuecat_transaction`.

The function inserts the receipt redemption first. Bonus and commission writes then run only when that insert returns a newly inserted row. If the first projection has a positive amount but lacks billing-period timestamps, the redemption is consumed without a grant. If currency is absent, the grant can exist without commission. A later complete replay hits `ON CONFLICT DO NOTHING`, so the missing projection is never repaired.

**Required correction:** Treat redemption ownership as durable eligibility, not proof that downstream writes finished. Idempotently complete the same qualifying transaction's missing grant/accrual after required verified fields arrive. Add fixtures for missing period, missing currency, replay, and account transfer without issuing a second reward.

### A2 — Unknown financial deductions become zero, and history replay can overwrite reconciled proceeds

**Source:** `supabase/migrations/202609040012_referral_bonus_quota.sql:66–80`; `_shared/revenue-ledger.ts` history projection.

`coalesce(p_tax_percentage,0)` and `coalesce(p_commission_percentage,0)` convert absent data into known zero deductions. A $9.99 payment with both fields missing becomes $9.99 estimated net proceeds and can accrue commission on that amount. This violates the plan's explicit null/coverage requirement.

Separately, Apple reconciliation writes its allocated result into `estimated_net_proceeds`. Replaying a purchase event subsequently updates that same field from provider estimates while preserving `financial_status='final'`. The amount can therefore change back to an estimate while retaining a final label.

**Required correction:** Preserve unknown components, keep estimated and allocated/final amounts separately, and select the appropriate amount with provenance. Provider replay must never overwrite accepted settlement data. Test reconciliation followed by purchase-history replay.

### A3 — Financial allocation ignores settlement timing and does not establish monetary compatibility

**Source:** `supabase/migrations/202609040011_revenue_and_creator_payouts.sql:176–207`.

The reconciliation buckets omit settlement date and product type, and match transactions by purchase date inside the fiscal period. It ignores the detailed report's transaction/settlement dates already stored on each line. A purchase collected in a later fiscal period can be unmatched or allocated against another purchase. Apple explicitly distinguishes purchase and settlement dates: https://developer.apple.com/help/app-store-connect/reference/reporting/financial-report-fields.

The algorithm checks quantity and positive gross-weight sum, but does not compare compatible expected monetary totals before allocating. It weights by gross rather than known transaction proceeds. It also lacks an App Store-only predicate. Matching counts alone can finalize an incompatible bucket.

**Required correction:** Resolve settlement period using report evidence, preserve unresolved timing, filter store/product/type/storefront/currency/sale-return compatibly, validate quantities and amounts, and use proceeds weights. Require an explicit reconciliation decision for discrepancies.

### A4 — Partial reports can unlock payouts; accounting adjustments are mutable

**Source:** `supabase/migrations/202609040011_revenue_and_creator_payouts.sql:210–218,268–286`.

The import can remain `validated` because some buckets are unmatched while its matched transactions become `final`. Payout preparation only requires any allocation row; it does not require an accepted, complete report. There is no separate complete-period approval workflow.

Reconciliation uses `ON CONFLICT(transaction_id,entry_type) DO UPDATE SET amount=excluded.amount`. That can change an adjustment already allocated or paid, while payout items retain the old amount. A different file hash for an overlapping period can allocate the same transaction again because allocation uniqueness is only `(import_id,transaction_id)`.

**Required correction:** Make imports/version supersession explicit, approve complete compatible coverage before payable status, prevent overlapping effective allocations, and append correction entries instead of rewriting historical amounts. Verify a correction after payout and overlapping reports.

### A5 — Analytics events wait for another lifecycle transition instead of flushing in-session

**Source:** `src/features/analytics/product-analytics.ts`, `analytics-queue.ts:96–125`, `analytics-provider.tsx:10–14`.

Tracking enqueues and persists only. Flush is called at startup, foreground, and account changes. There is no batch-size/debounce timer, retry timer, or loop to drain beyond the first 25 events. A person can complete onboarding or use the app and leave without that session's events reaching reporting. A long session can overflow the 200-event queue even while online.

**Required correction:** Schedule bounded delivery when events arrive, drain acknowledged batches, and retry transient failures with backoff while active. Coordinate identity transitions with outstanding writes/requests. Test delivery without foreground/auth transitions and queues larger than 25 events.

### A6 — Several custom-date metrics include events after the selected end date

**Source:** `supabase/migrations/202609040014_business_dashboard_reporting.sql:167,190–203` and the v2–v5 wrapper chain.

The base function sets `v_now` from the custom end date, but new-user, new-payment, cancellation, visit, and other queries often apply only `>=v_start`. The later financial wrappers fix selected monetary metrics, not all inherited counters. Selecting a historical month can include later users/payments and disagree with the bounded revenue cards.

**Required correction:** Apply a common half-open start/end interval to every operational query, and independently define current-state cards. Fixture the same user/payment immediately before, inside, and after the interval. Creator portal custom-date filters also remain absent.

### A7 — The displayed ordered funnel is not based on actual ordered questionnaire events

**Source:** `supabase/migrations/202609040014_business_dashboard_reporting.sql:332–345`; `src/features/profile/profile-provider.tsx:158`.

The questionnaire and account stages both derive from reporting snapshots joined to existing auth users. Anonymous questionnaire completers who never create an account cannot appear. The questionnaire-completed event is emitted during profile finalization. The analysis stage falls back to signup time when no payment exists (`coalesce(paid.first_paid_at,signup.created_at)`), so unpaid analyses can count after a missing payment stage despite the UI claiming each stage reached its predecessor.

**Required correction:** Record questionnaire completion at the actual questionnaire transition, link anonymous records securely, and construct each stage from the previous stage's eligible population and timestamps. Preserve historical unavailable states rather than relabeling finalization as an earlier step.

### A8 — Duplicate completed webhooks reset financial projection metadata

**Source:** `supabase/functions/revenuecat-webhook/index.ts:15–42`; `handler.ts:116`.

`claimEvent` updates `user_id` to null and `financial_projection_status` to pending before returning that an event was already completed. The handler then returns early for that duplicate. An ordinary duplicate delivery thus leaves a completed event with reset projection metadata and lost ownership on the event row.

**Required correction:** Return completed duplicates before resetting projection state, or atomically claim/persist only a projection requiring processing. Add an integration test for completed event redelivery preserving all projection fields.

## Additional material gaps

1. **Refund vs revocation:** `202609040012_referral_bonus_quota.sql:108–113` revokes the bonus on any refund signal. It does not require verified access revocation as agreed. Commission reversal and entitlement revocation need separate provider-backed transitions.
2. **Renewal snapshot:** `get_referral_bonus_access_for_user` at line 144 calculates `base_used` from the original bonus period whenever a grant exists. After renewal it reports first-period base usage instead of current-period base usage. Keep historical bonus statistics while calculating base usage from the active entitlement period.
3. **Cohorts:** `business_retention_breakdown` excludes everyone newer than 31 days even for D7. With the default trailing 30-day range, these breakdowns necessarily have no eligible users. Subscriber retention is currently all previously paying users still active, not a selected subscriber cohort at a defined comparison boundary. First-week depth shows counts but not the requested retention relationship.
4. **Query bounds:** `get_founder_business_dashboard_v4` strips referral/payout arrays only after calling v3, which calls the full base query. The base still constructs those arrays for all creators. This reduces response size but does not remove the unbounded database work the plan required replacing.
5. **Financial operations:** FX/payment reconciliation input, explicit fiscal-period selection, rejected-row review, and manual compatible-allocation approval are absent from the Revenue actions/UI. Cross-currency buckets remain pending with no implemented path to supply the missing conversion evidence.
6. **Sandbox acceptance:** The reward projector returns immediately for non-production events (`202609040012_referral_bonus_quota.sql:82`). This prevents sandbox accounting from exercising the complete three-unit grant/commission journey described in acceptance. Production exclusion is correct; an isolated sandbox reward ledger/test mode is still needed.
7. **Verification:** `supabase/tests/business-reporting.sql` and `referral-bonus.sql` primarily use schema assertions and function-text matching. They do not execute the required concurrent reservations, late-data recovery, exact metric fixtures, or complete payout correction scenarios. The browser suite conditionally skips credentials/import/provisioning scenarios and does not contain payout preparation/confirmation coverage. Its creator-management heading still expects the old link wording.

## Evidence and release boundary

- Fresh `supabase db push --dry-run`: remote database up to date.
- Apple financial parser tests rerun during audit: 7/7 passed. These tests do not exercise the SQL allocation and payout defects above.
- Focused referral/analytics/ledger tests rerun during audit: 4 suites, 21/21 tests passed. Passing existing tests does not negate uncovered cases.
- No physical-iPhone purchase/13-analysis/renewal/refund journey was executed during this audit.
- No real Apple report or external payout was executed during this audit.
- Previous task deployment evidence is not a replacement for current end-to-end financial acceptance.

The first repairs should be reward replay completion, financial source separation/reconciliation/payout immutability, and analytics delivery. Then correct reporting queries and add behavioral fixtures before the live acceptance journey.
