; Boom 설치 프로그램 (NSIS)
;   makensis /DVERSION=1.2.0 installer\boom.nsi   →  dist\Boom-Setup-1.2.0.exe
; dist\Boom (PyInstaller 결과)을 사용자 폴더(%LOCALAPPDATA%\Programs\Boom)에 설치한다.
; 관리자 권한이 필요 없어서(UAC 창 없음) 앱 안의 자동 업데이트가 /S 로 조용히 다시 설치할 수 있다.

Unicode true
SetCompressor /SOLID lzma

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!define APP "Boom"
!define PUBLISHER "tsunat10101steam-cyber"
!define URL "https://github.com/tsunat10101steam-cyber/boom"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Boom"

Name "${APP}"
OutFile "..\dist\Boom-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Boom"
RequestExecutionLevel user
BrandingText "${APP} ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=0 "ProductName" "${APP}"
VIAddVersionKey /LANG=0 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=0 "FileDescription" "${APP} Setup"
VIAddVersionKey /LANG=0 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=0 "LegalCopyright" "${PUBLISHER}"

!include "MUI2.nsh"
!define MUI_ICON "setup.ico"
!define MUI_UNICON "..\app.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Boom.exe"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Windows 표시 언어에 맞춰 자동으로 고른다 (앱이 지원하는 8개 언어)
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "Japanese"
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "TradChinese"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "Spanish"

Section "Boom"
  ; 실행 중인 Boom 은 닫고 설치 (업데이트할 때 파일이 잠겨 있지 않게)
  nsExec::Exec 'taskkill /im Boom.exe /f'
  Sleep 500
  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\_internal"
  File /r "..\dist\Boom\*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$SMPROGRAMS\Boom.lnk" "$INSTDIR\Boom.exe"
  CreateShortcut "$DESKTOP\Boom.lnk" "$INSTDIR\Boom.exe"

  ; 설정 → 앱 목록에 표시 (제거 가능)
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${URL}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\Boom.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /im Boom.exe /f'
  Sleep 500
  Delete "$SMPROGRAMS\Boom.lnk"
  Delete "$DESKTOP\Boom.lnk"
  ; 설치 폴더를 사용자가 바꿨을 수 있으니 통째로 지우지 않고 Boom 파일만 지운다
  Delete "$INSTDIR\Boom.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR\_internal"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  ; 저장된 액세스 키·앱 창 프로필(%LOCALAPPDATA%\Boom)은 지우지 않는다 (다시 설치하면 그대로 이어서 사용)
SectionEnd
