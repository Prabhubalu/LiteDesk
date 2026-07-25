; Arivu Connector Agent — Inno Setup script
; Builds: ArivuConnectorSetup.exe (self-contained agent + runtimes)
;
; Prerequisites:
;   - Inno Setup 6.x (https://jrsoftware.org/isinfo.php) — Windows only (or Wine)
;   - Packaged agent binary at dist\arivu-connector-agent.exe (pkg — can be cross-built on Mac)
;   - Optional: installer\redist\VC_redist.x64.exe (Visual C++ 2015-2022 x64)
;
; Compile (Windows):
;   ISCC.exe installer\arivu-connector.iss
;   or: .\installer\build.ps1

#define MyAppName "Arivu Connector Agent"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Arivu"
#define MyAppExeName "arivu-connector-agent.exe"
#define MyServiceName "ArivuConnectorAgent"

[Setup]
AppId={{A7C0E1D2-4B5F-4A91-9C3E-ARIVUCONN0}}
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
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Self-contained Node agent (pkg embeds Node runtime — no separate Node.js install)
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\installer\config.template.json"; DestDir: "{commonappdata}\Arivu\Connector"; DestName: "config.json"; Flags: onlyifdoesntexist
; Optional VC++ redistributable — place file at installer\redist\VC_redist.x64.exe before compile
Source: "..\installer\redist\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall skipifsourcedoesntexist

[Dirs]
Name: "{commonappdata}\Arivu\Connector"
Name: "{commonappdata}\Arivu\Connector\queue"
Name: "{commonappdata}\Arivu\Connector\logs"
Name: "{commonappdata}\Arivu\Connector\updates"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--console"
Name: "{group}\Pair Connector"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--pair"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; Install VC++ runtime quietly when bundled (skip if file was not in package)
Filename: "{tmp}\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Visual C++ runtime..."; Flags: waituntilterminated skipifdoesntexist
; Register and start Windows service
Filename: "{sys}\sc.exe"; Parameters: "create {#MyServiceName} binPath= ""{app}\{#MyAppExeName}"" start= auto DisplayName= ""Arivu Connector Agent"""; Flags: runhidden; StatusMsg: "Registering Windows service..."
Filename: "{sys}\sc.exe"; Parameters: "description {#MyServiceName} ""Bridges local Tally XML API to Arivu cloud."""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start {#MyServiceName}"; Flags: runhidden; StatusMsg: "Starting Arivu Connector Agent..."
Filename: "{app}\{#MyAppExeName}"; Parameters: "--pair"; Description: "Pair this PC with Arivu (device code)"; Flags: postinstall nowait skipifsilent unchecked

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden; RunOnceId: "StopArivuSvc"
Filename: "{sys}\sc.exe"; Parameters: "delete {#MyServiceName}"; Flags: runhidden; RunOnceId: "DelArivuSvc"

[Code]
function InitializeWizard(): Boolean;
begin
  Result := True;
  WizardForm.WelcomeLabel2.Caption :=
    'This wizard installs the Arivu Connector Agent.'#13#10#13#10 +
    'The installer includes the agent runtime (no separate Node.js install). ' +
    'If bundled, the Visual C++ redistributable is installed automatically.'#13#10#13#10 +
    'TallyPrime itself is not bundled — install Tally separately and enable XML HTTP (port 9000).'#13#10#13#10 +
    'After install you can pair with a code from the Integration Center.';
end;
