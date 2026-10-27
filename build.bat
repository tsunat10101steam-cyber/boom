@echo off
rem Builds Boom.exe, installs it to %LOCALAPPDATA%\Programs\Boom,
rem and creates Desktop + Start menu shortcuts.
cd /d "%~dp0"
if not exist .venv (
  python -m venv .venv
)
.venv\Scripts\python -m pip install -q -r requirements.txt pyinstaller || exit /b 1

.venv\Scripts\python -m PyInstaller --noconfirm --clean --windowed --name Boom ^
  --icon app.ico --add-data "static;static" --add-data "app.ico;." app.py || exit /b 1

set "DEST=%LOCALAPPDATA%\Programs\Boom"
taskkill /im Boom.exe /f >nul 2>&1
robocopy dist\Boom "%DEST%" /mir /njh /njs /nfl /ndl >nul
if errorlevel 8 exit /b 1

powershell -NoProfile -Command ^
  "$s = New-Object -ComObject WScript.Shell;" ^
  "foreach ($d in @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))) {" ^
  "  $l = $s.CreateShortcut((Join-Path $d 'Boom.lnk'));" ^
  "  $l.TargetPath = '%DEST%\Boom.exe'; $l.WorkingDirectory = '%DEST%';" ^
  "  $l.IconLocation = '%DEST%\Boom.exe,0'; $l.Description = 'AWS resource dashboard'; $l.Save();" ^
  "  Write-Host ('shortcut: ' + $d + '\Boom.lnk') }"

echo Installed: %DEST%\Boom.exe
