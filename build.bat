@echo off
rem Builds Boom.exe (and Boom-Setup-x.exe if NSIS is installed),
rem installs Boom to %LOCALAPPDATA%\Programs\Boom and creates Desktop + Start menu shortcuts.
cd /d "%~dp0"
if not exist .venv (
  python -m venv .venv
)
.venv\Scripts\python -m pip install -q -r requirements.txt pyinstaller || exit /b 1
.venv\Scripts\python tools\version_info.py || exit /b 1

.venv\Scripts\python -m PyInstaller --noconfirm --clean --windowed --name Boom ^
  --icon app.ico --version-file build\version_info.txt --add-data "static;static" --add-data "app.ico;." app.py || exit /b 1

rem Setup (optional): needs NSIS (https://nsis.sourceforge.io)
set "MAKENSIS=%ProgramFiles(x86)%\NSIS\makensis.exe"
if exist "%MAKENSIS%" (
  for /f "tokens=2 delims==" %%v in ('findstr /b "__version__" version.py') do set "VER=%%~v"
  setlocal enabledelayedexpansion
  set "VER=!VER: =!"
  set "VER=!VER:"=!"
  "%MAKENSIS%" /V2 /DVERSION=!VER! installer\boom.nsi && echo Setup: dist\Boom-Setup-!VER!.exe
  endlocal
)

set "DEST=%LOCALAPPDATA%\Programs\Boom"
taskkill /im Boom.exe /f >nul 2>&1
robocopy dist\Boom "%DEST%" /mir /xf Uninstall.exe /njh /njs /nfl /ndl >nul
if errorlevel 8 exit /b 1

powershell -NoProfile -Command ^
  "$s = New-Object -ComObject WScript.Shell;" ^
  "foreach ($d in @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))) {" ^
  "  $l = $s.CreateShortcut((Join-Path $d 'Boom.lnk'));" ^
  "  $l.TargetPath = '%DEST%\Boom.exe'; $l.WorkingDirectory = '%DEST%';" ^
  "  $l.IconLocation = '%DEST%\Boom.exe,0'; $l.Description = 'AWS resource dashboard'; $l.Save();" ^
  "  Write-Host ('shortcut: ' + $d + '\Boom.lnk') }"

echo Installed: %DEST%\Boom.exe
