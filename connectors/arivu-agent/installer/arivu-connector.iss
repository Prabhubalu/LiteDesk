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
#define MyAppVersion "0.2.2"
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
    'This wizard installs the Arivu Connector Agent.'#13#10#13#10 +
    'After install, open Desktop / Start Menu → Arivu Connector. A small console stays open and the pairing page loads at http://127.0.0.1:17932/'#13#10#13#10 +
    'Paste the code from Arivu Integrations → Tally. Keep that window open while using the connector.'#13#10#13#10 +
    'TallyPrime itself is not bundled — enable XML HTTP (port 9000).';
end;
