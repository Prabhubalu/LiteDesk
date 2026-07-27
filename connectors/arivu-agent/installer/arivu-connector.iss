; Arivu Connector Agent — Inno Setup 6 script
; Builds: ArivuConnectorSetup.exe (self-contained agent + runtimes)
;
; Prerequisites:
;   - Inno Setup 6.x (https://jrsoftware.org/isinfo.php)
;   - dist\arivu-connector-agent.exe (from pkg)
;   - Optional: installer\redist\VC_redist.x64.exe
;
; Compile:
;   ISCC.exe installer\arivu-connector.iss

#define MyAppName "Arivu Connector Agent"
#define MyAppVersion "0.3.1"
#define MyAppPublisher "Arivu"
#define MyAppExeName "arivu-connector-agent.exe"
#define MyServiceName "ArivuConnectorAgent"

[Setup]
; AppId must be a valid GUID (hex only)
AppId={{A7C0E1D2-4B5F-4A91-9C3E-8F2B1A0D6E45}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Arivu\Connector
DefaultGroupName=Arivu
DisableProgramGroupPage=yes
OutputDir=..\dist\installer
OutputBaseFilename=ArivuConnectorSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
; Admin only for install into Program Files. Daily use is user-session (--tray), never elevate.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupLogging=yes
MinVersion=10.0
CloseApplications=force

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Self-contained Node agent (pkg embeds Node — no separate Node.js install)
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "config.template.json"; DestDir: "{localappdata}\Arivu\Connector"; DestName: "config.json"; Flags: onlyifdoesntexist
Source: "config.template.json"; DestDir: "{commonappdata}\Arivu\Connector"; DestName: "config.json"; Flags: onlyifdoesntexist
; Loose UI copy next to EXE (fallback if pkg asset path fails)
Source: "..\src\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; Arivu Tally TDL pack — customer loads once in TallyPrime
Source: "..\tdl\*"; DestDir: "{app}\tdl"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\tdl\*"; DestDir: "{localappdata}\Arivu\Connector\tdl"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\tdl\*"; DestDir: "{commonappdata}\Arivu\Connector\tdl"; Flags: ignoreversion recursesubdirs createallsubdirs
; Optional VC++ redistributable
Source: "redist\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall skipifsourcedoesntexist

[Dirs]
Name: "{localappdata}\Arivu\Connector"
Name: "{localappdata}\Arivu\Connector\queue"
Name: "{localappdata}\Arivu\Connector\logs"
Name: "{localappdata}\Arivu\Connector\updates"
Name: "{commonappdata}\Arivu\Connector"
Name: "{commonappdata}\Arivu\Connector\queue"
Name: "{commonappdata}\Arivu\Connector\logs"

[Icons]
; Never set "Run as administrator" — agent must stay in the user session to see Tally
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"
Name: "{group}\Arivu Connector (console)"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"
Name: "{group}\Tally TDL folder"; Filename: "{app}\tdl"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"
Name: "{userdesktop}\Arivu Connector"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Install VC++ runtime quietly when bundled
Filename: "{tmp}\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ runtime..."; Flags: waituntilterminated skipifdoesntexist
; Remove legacy Windows service (Session 0 cannot reliably talk to Tally / caused UAC prompts)
Filename: "{sys}\sc.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden; StatusMsg: "Stopping legacy service..."
Filename: "{sys}\sc.exe"; Parameters: "delete {#MyServiceName}"; Flags: runhidden; StatusMsg: "Removing legacy Windows service..."
; Start user-session tray (NOT elevated) — this is the real agent
Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"; Description: "Open Arivu Connector (recommended)"; Flags: postinstall nowait skipifsilent runasoriginaluser

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden; RunOnceId: "StopArivuSvc"
Filename: "{sys}\sc.exe"; Parameters: "delete {#MyServiceName}"; Flags: runhidden; RunOnceId: "DelArivuSvc"

[Code]
{ Inno Setup 6: InitializeWizard is a procedure (no Boolean return). }
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel2.Caption :=
    'This wizard installs the Arivu Connector Agent + Tally TDL.'#13#10#13#10 +
    'After install:'#13#10 +
    '1) Desktop → Arivu Connector opens (no admin — do not Run as administrator).'#13#10 +
    '2) In TallyPrime load ArivuConnector.tdl via F1 → TDL & Add-On.'#13#10 +
    '3) Enable HTTP port 9000 in Tally.'#13#10 +
    '4) Pair from Arivu Integration Center.'#13#10#13#10 +
    'The agent auto-detects Tally when you open it (within ~15 seconds).'#13#10 +
    'TDL path: C:\Program Files\Arivu\Connector\tdl\';
end;
