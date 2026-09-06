# Creator program completion verification

Verified against the linked database on 2026-09-05. Overall acceptance remains incomplete.

## Newly reproduced and repaired

The creator custom-range RPC failed with `column reference creator_id is ambiguous`. The founder detail wrapper had the same variable collision. Forward migration `202609050032_disambiguate_creator_reporting.sql` qualifies the local tenant variable in both functions and is deployed. Migration dry run confirms parity.

## Executed backend journey

`supabase/tests/creator-program-repairs.sql` runs inside a transaction and rolls back all fixtures and program-setting changes. It now executes creator provisioning, creator-code issuance, account claim, partial payment replay, creator reporting, all four founder reporting sections, non-creator access rejection, 13 quota reservations with simulated successful completion, and rejection of reservation 14. It asserts one grant/accrual, ten base-funded reservations, three bonus-funded reservations, unknown deduction preservation, renewal usage, and refund without access revocation.

This is a database integration test using synthetic payment projections. It does not perform an Apple purchase or run thirteen AI analyses. Dashboard RPC results do not prove authenticated browser rendering.

## Still required before declaring complete

- Authenticated browser acceptance of founder creation/invitation and creator password setup, navigation, and statements.
- Installed iPhone creator-code validation, signup finalization, actual sandbox purchase and entitlement delivery.
- Store-driven renewal, restore, account switching, and refund/revocation verification.
- Complete financial reporting acceptance and previously documented reconciliation/coverage gaps.

Do not describe the remaining work as only a mobile binary release. The earlier remediation summary overstated completion of all dashboard/accounting requirements.
