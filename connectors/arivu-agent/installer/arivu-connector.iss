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
#define MyAppVersion "0.3.0"
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
Source: "config.template.json"; DestDir: "{commonappdata}\Arivu\Connector"; DestName: "config.json"; Flags: onlyifdoesntexist
; Loose UI copy next to EXE (fallback if pkg asset path fails)
Source: "..\src\ui\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; Arivu Tally TDL pack — customer loads once in TallyPrime
Source: "..\tdl\*"; DestDir: "{app}\tdl"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\tdl\*"; DestDir: "{commonappdata}\Arivu\Connector\tdl"; Flags: ignoreversion recursesubdirs createallsubdirs
; Optional VC++ redistributable
Source: "redist\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall skipifsourcedoesntexist

[Dirs]
Name: "{commonappdata}\Arivu\Connector"
Name: "{commonappdata}\Arivu\Connector\queue"
Name: "{commonappdata}\Arivu\Connector\logs"
Name: "{commonappdata}\Arivu\Connector\updates"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"
Name: "{group}\Arivu Connector (console)"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"
Name: "{group}\Tally TDL folder"; Filename: "{app}\tdl"
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"
Name: "{userdesktop}\Arivu Connector"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Install VC++ runtime quietly when bundled
Filename: "{tmp}\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ runtime..."; Flags: waituntilterminated skipifdoesntexist
; Reinstall-safe service registration
Filename: "{sys}\sc.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden; StatusMsg: "Stopping previous service..."
Filename: "{sys}\sc.exe"; Parameters: "delete {#MyServiceName}"; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "create {#MyServiceName} binPath= ""{app}\{#MyAppExeName}"" start= auto DisplayName= ""Arivu Connector Agent"""; Flags: runhidden; StatusMsg: "Registering Windows service..."
Filename: "{sys}\sc.exe"; Parameters: "description {#MyServiceName} ""Bridges local Tally XML API to Arivu cloud."""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start {#MyServiceName}"; Flags: runhidden; StatusMsg: "Starting Arivu Connector Agent..."
; CRITICAL: runasoriginaluser — elevated Setup kills child processes / wrong session otherwise
Filename: "{app}\{#MyAppExeName}"; Parameters: "--tray"; Description: "Open Arivu Connector pairing UI"; Flags: postinstall nowait skipifsilent runasoriginaluser unchecked

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden; RunOnceId: "StopArivuSvc"
Filename: "{sys}\sc.exe"; Parameters: "delete {#MyServiceName}"; Flags: runhidden; RunOnceId: "DelArivuSvc"

[Code]
{ Inno Setup 6: InitializeWizard is a procedure (no Boolean return). }
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel2.Caption :=
    'This wizard installs the Arivu Connector Agent + Tally TDL.'#13#10#13#10 +
    'After install: (1) Open Desktop → Arivu Connector. (2) In TallyPrime load ArivuConnector.tdl (or ArivuConnector.All.tdl) via F1 → TDL & Add-On → Manage Local TDLs. (3) Enable HTTP port 9000. (4) Dry run from Arivu.'#13#10#13#10 +
    'TDL path: C:\Program Files\Arivu\Connector\tdl\';
end;
