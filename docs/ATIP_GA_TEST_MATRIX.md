# ATIP GA Test Matrix

## Unit
- `server/services/connectors/tally/engines/__tests__/atipEngines.test.js` — metadata fixtures, AI mapping, validation, transforms, error intelligence

## Integration (lab)
- Agent mock Tally: `connectors/arivu-agent/scripts/mock-tally-server.js`
- Pair → bind → metadata discover → mapping draft/activate → dry-run → live sync
- Inbound voucher create with `inboundCreatePolicy=draft` + `syncWay=bidirectional` on sales
- Conflict create + resolve (crm_wins / tally_wins)
- Watermark advance on pull (`lastAlterId`)

## E2E success criteria
- Wizard to Ready &lt; 5 minutes
- ≥90% auto-map confidence on standard COA (heuristic/AI)
- Retry + DLQ + audit search recoverable
- Multi-company: parallel companies, serial writes per GUID
- Tenant isolation on all ATIP collections

## Security
- Agent token hashed; secrets encrypted
- No cloud→:9000
- Addon entitlement + RBAC on `/api/connectors/tally/*`

## Performance
- Incremental AlterID pulls after initial sync
- Offline queue DLQ at 5000 pending
- Single-flight XML per company
