Visual C++ Redistributable (optional but recommended)
======================================================

Download Microsoft Visual C++ 2015–2022 Redistributable (x64):

  https://aka.ms/vs/17/release/vc_redist.x64.exe

Save as:

  connectors/arivu-agent/installer/redist/VC_redist.x64.exe

Then run build.ps1 / ISCC. The installer will install this quietly during setup
so customers do not need a separate runtime download.

Do NOT bundle:
- TallyPrime / Tally.ERP 9 (customer licenses)
- Node.js (already embedded in arivu-connector-agent.exe via pkg)
