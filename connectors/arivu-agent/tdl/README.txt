Arivu Connector — Tally TDL Pack v1.0.0
=======================================

Research basis
--------------
- TallyHelp: XML Integration, Understanding Tally XML Tags
- TallyHelp: GST schema + Rel 3.0 XML tag changes (PartyGSTIN, HSNDetails, GSTDetails)
- Production connector patterns: Collection + Fetch with LedgerEntries.* / InventoryEntries.*
  (without nested Fetch, voucher XML returns headers only — common failure mode)

Files (load the loader OR the single-file fallback)
--------------------------------------
  ArivuConnector.tdl              ← preferred (Includes the modules below)
  ArivuConnector.All.tdl          ← fallback if #Include fails (all-in-one)
  ArivuConnector.Masters.tdl
  ArivuConnector.Inventory.tdl
  ArivuConnector.Vouchers.tdl
  ArivuConnector.GST.tdl

Installed paths
---------------
  C:\Program Files\Arivu\Connector\tdl\
  %ProgramData%\Arivu\Connector\tdl\

Load in TallyPrime
------------------
1. F1 → TDL & Add-On → F4 Manage Local TDLs
2. Load selected TDL files on startup = Yes
3. Add ArivuConnector.tdl (same folder as sibling modules)
   — If Include errors: load ArivuConnector.All.tdl instead
4. Accept → Restart Tally
5. Gateway shows "Arivu Connector" — open it; version must show 1.0.0
6. F12 → Enable ODBC / HTTP server (port 9000)

If Include fails on your build, use ArivuConnector.All.tdl only (do not also load modules).

Collection catalog (agent IDs — do not rename)
----------------------------------------------
Masters:
  Arivu Connector Meta
  Arivu List of Companies
  Arivu List of Groups
  Arivu List of Ledgers
  Arivu List of Currencies
  Arivu List of Voucher Types
  Arivu List of Cost Categories
  Arivu List of Cost Centres
  Arivu List of Units
  Arivu List of Attendance Types

Inventory:
  Arivu List of Stock Groups
  Arivu List of Stock Categories
  Arivu List of Stock Items (includes GodownEntries.*, BatchEntries.*)
  Arivu List of Godowns
  Arivu List of Batches
  Arivu Stock Summary

Vouchers (set SVFROMDATE / SVTODATE in XML; nested LedgerEntries.* / InventoryEntries.*):
  Arivu List of Vouchers
  Arivu Sales / Purchase / Payment / Receipt / Journal / Contra Vouchers
  Arivu Credit Note / Debit Note Vouchers
  Arivu Stock Journal / Delivery Note / Receipt Note Vouchers

GST (Rel 3+):
  Arivu List of GST Classifications
  Arivu List of Tax Units
  Arivu List of GST Duty Ledgers

Future-proofing
---------------
- Fetch includes GUID, MasterID, AlterID for incremental sync
- GST/HSN aggregates for Rel 3+ schema
- Nested voucher entries explicitly fetched
- Pack version exposed via Arivu Connector Meta + Gateway report
- Bump ARIVU_TDL_PACK_VERSION in agent when changing collection contracts

Support
-------
https://app.arivusystems.com/integrations/tally
