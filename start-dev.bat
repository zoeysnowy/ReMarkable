@echo off
chcp 65001 >nul
echo Starting ReMarkable Development Server...
echo.

set NODE_OPTIONS=--max-old-space-size=4096
set TSC_COMPILE_ON_ERROR=true
set GENERATE_SOURCEMAP=false
set SKIP_PREFLIGHT_CHECK=true

npm start
