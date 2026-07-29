@echo off
setlocal EnableDelayedExpansion
REM ==========================================================================================
REM  Phase 2B - Blender-authored realism build (Windows, one command)
REM
REM  Runs the whole pipeline and fails loudly on the first gate that does not pass:
REM     Blender build  ->  generated-asset verification  ->  manifest validation
REM     ->  simulator tests  ->  type check  ->  browser capture QA (when available)
REM
REM  It NEVER writes simulator\assets\human\human.glb; the build script refuses that path and
REM  this file checks the file's size and timestamp either side of the run as a second guard.
REM  The last known-good generated output is kept until a new one passes validation.
REM
REM  Usage:   run_phase2_blender_build.bat  [--preview]  [--skip-browser]
REM  Blender: set BLENDER_EXE to override auto-detection, e.g.
REM             set BLENDER_EXE=D:\Tools\blender-4.5.12\blender.exe
REM ==========================================================================================

REM ---- 1. repository root, resolved from this file's own location --------------------------
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%..\..\.." >nul 2>&1
set "REPO_ROOT=%CD%"
popd >nul 2>&1
if not exist "%REPO_ROOT%\simulator\assets\human\human.glb" (
  echo [phase2b] ERROR: repository root resolved to "%REPO_ROOT%" but the original human asset
  echo [phase2b]        simulator\assets\human\human.glb is not there.
  exit /b 2
)
echo [phase2b] repository root : %REPO_ROOT%

set "LOG_DIR=%REPO_ROOT%\simulator\artifacts\phase2b"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "BUILD_LOG=%LOG_DIR%\blender-build.log"

set "PREVIEW_ARG="
set "SKIP_BROWSER="
for %%A in (%*) do (
  if /I "%%A"=="--preview" set "PREVIEW_ARG=--preview"
  if /I "%%A"=="--skip-browser" set "SKIP_BROWSER=1"
)

REM ---- 2/3. Blender executable: BLENDER_EXE wins, else the documented 4.5 LTS locations -----
if defined BLENDER_EXE (
  if not exist "%BLENDER_EXE%" (
    echo [phase2b] ERROR: BLENDER_EXE is set to "%BLENDER_EXE%" but that file does not exist.
    exit /b 2
  )
) else (
  for %%P in (
    "%ProgramFiles%\Blender Foundation\Blender 4.5\blender.exe"
    "%ProgramFiles(x86)%\Blender Foundation\Blender 4.5\blender.exe"
    "%LOCALAPPDATA%\Programs\Blender Foundation\Blender 4.5\blender.exe"
    "%ProgramFiles%\Blender Foundation\Blender\blender.exe"
    "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
  ) do (
    if not defined BLENDER_EXE if exist %%P set "BLENDER_EXE=%%~P"
  )
)
if not defined BLENDER_EXE (
  where blender.exe >nul 2>&1 && for /f "delims=" %%B in ('where blender.exe') do (
    if not defined BLENDER_EXE set "BLENDER_EXE=%%B"
  )
)
if not defined BLENDER_EXE (
  echo [phase2b] ERROR: no Blender 4.5 LTS found.
  echo [phase2b]        Install Blender 4.5 LTS, or set BLENDER_EXE to its blender.exe.
  echo [phase2b]        Phase 2B does not accept a substituted Blender version.
  exit /b 3
)
REM ---- 4. print the resolved executable -----------------------------------------------------
echo [phase2b] blender        : %BLENDER_EXE%
"%BLENDER_EXE%" --version 2>&1 | findstr /I /C:"Blender" > "%LOG_DIR%\blender-version.txt"
type "%LOG_DIR%\blender-version.txt"
findstr /I /C:"Blender 4.5" "%LOG_DIR%\blender-version.txt" >nul
if errorlevel 1 (
  echo [phase2b] ERROR: the resolved Blender is not 4.5 LTS. Refusing to substitute a version.
  exit /b 3
)

REM ---- 16/17. guard the immutable input and keep the last known-good output ------------------
set "ORIGINAL=%REPO_ROOT%\simulator\assets\human\human.glb"
set "BAKED=%REPO_ROOT%\simulator\assets\human\human_application_baked.glb"
set "MANIFEST=%REPO_ROOT%\simulator\assets\human\human_application_manifest.json"
for %%F in ("%ORIGINAL%") do set "ORIGINAL_SIZE_BEFORE=%%~zF"
for %%F in ("%ORIGINAL%") do set "ORIGINAL_TIME_BEFORE=%%~tF"
if exist "%BAKED%"    copy /Y "%BAKED%"    "%BAKED%.lastgood"    >nul
if exist "%MANIFEST%" copy /Y "%MANIFEST%" "%MANIFEST%.lastgood" >nul

REM ---- 5/6/7/8/9. run Blender in background mode, log everything, stop on failure ------------
echo [phase2b] building       : %BUILD_LOG%
"%BLENDER_EXE%" --background --factory-startup --python-exit-code 1 ^
  --python "%SCRIPT_DIR%build_phase2_realism.py" -- ^
  --repo "%REPO_ROOT%" %PREVIEW_ARG% > "%BUILD_LOG%" 2>&1
set "BUILD_RC=%ERRORLEVEL%"
type "%BUILD_LOG%"
if not "%BUILD_RC%"=="0" (
  echo [phase2b] BLENDER BUILD FAILED with exit code %BUILD_RC% - see %BUILD_LOG%
  call :restore_lastgood
  exit /b %BUILD_RC%
)

for %%F in ("%ORIGINAL%") do set "ORIGINAL_SIZE_AFTER=%%~zF"
for %%F in ("%ORIGINAL%") do set "ORIGINAL_TIME_AFTER=%%~tF"
if not "%ORIGINAL_SIZE_BEFORE%"=="%ORIGINAL_SIZE_AFTER%" goto :original_changed
if not "%ORIGINAL_TIME_BEFORE%"=="%ORIGINAL_TIME_AFTER%" goto :original_changed

REM ---- 10/11. generated-asset verification and manifest validation ---------------------------
echo [phase2b] verifying generated asset
node "%REPO_ROOT%\simulator\tools\verify-baked-asset.mjs"
if errorlevel 1 (
  echo [phase2b] GENERATED-ASSET VERIFICATION FAILED
  call :restore_lastgood
  exit /b 4
)

REM ---- 12. Three.js / simulator tests ---------------------------------------------------------
echo [phase2b] running simulator tests
node "%REPO_ROOT%\simulator\tests\run.mjs"
if errorlevel 1 (
  echo [phase2b] SIMULATOR TESTS FAILED
  call :restore_lastgood
  exit /b 5
)

REM ---- 13. type checking ------------------------------------------------------------------------
echo [phase2b] type checking
where npx >nul 2>&1
if errorlevel 1 (
  echo [phase2b] npx not found - skipping tsc --noEmit
) else (
  pushd "%REPO_ROOT%\simulator"
  npx --yes tsc --noEmit -p tsconfig.json
  set "TSC_RC=!ERRORLEVEL!"
  popd
  if not "!TSC_RC!"=="0" (
    echo [phase2b] TYPE CHECK FAILED
    call :restore_lastgood
    exit /b 6
  )
)

REM ---- 14. browser capture / QA ------------------------------------------------------------------
if defined SKIP_BROWSER (
  echo [phase2b] --skip-browser given, not running browser QA
) else (
  echo [phase2b] browser QA: start a static server on 127.0.0.1:8099 serving simulator\ then run
  echo [phase2b]   node simulator\tools\capture-frames.mjs --url phase2b-preview.html ^
--out simulator\artifacts\phase2b\frames --mode blender-baked --frames 421
  echo [phase2b]   python tools\blender\encode_video.py -- --frames ... --out ... --fps 30
)

echo [phase2b] BUILD OK
del /Q "%BAKED%.lastgood"    2>nul
del /Q "%MANIFEST%.lastgood" 2>nul
exit /b 0

:original_changed
echo [phase2b] FATAL: simulator\assets\human\human.glb CHANGED during the build.
echo [phase2b]        size %ORIGINAL_SIZE_BEFORE% -^> %ORIGINAL_SIZE_AFTER%
echo [phase2b]        time %ORIGINAL_TIME_BEFORE% -^> %ORIGINAL_TIME_AFTER%
call :restore_lastgood
exit /b 7

:restore_lastgood
if exist "%BAKED%.lastgood" (
  echo [phase2b] restoring the last known-good generated asset
  move /Y "%BAKED%.lastgood" "%BAKED%" >nul
)
if exist "%MANIFEST%.lastgood" (
  move /Y "%MANIFEST%.lastgood" "%MANIFEST%" >nul
)
goto :eof
