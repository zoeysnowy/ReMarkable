@echo off
echo ========================================
echo Tiptap Phase 2 Cache Cleanup Script
echo ========================================
echo.

echo [1/4] Stopping all Node processes...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo ✓ Node processes stopped
) else (
    echo ✓ No Node processes running
)
echo.

echo [2/4] Clearing webpack cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo ✓ Webpack cache cleared
) else (
    echo ✓ No webpack cache found
)
echo.

echo [3/4] Clearing build artifacts...
if exist build (
    rmdir /s /q build
    echo ✓ Build folder cleared
) else (
    echo ✓ No build folder found
)
echo.

echo [4/4] Verifying renamed files...
if exist src\components\TiptapEditor\nodes\EventDescription.ts.backup (
    echo ✓ EventDescription.ts.backup exists
) else (
    echo ✗ EventDescription.ts.backup NOT FOUND
)

if exist src\components\TiptapEditor\nodes\EventTitle.ts.backup (
    echo ✓ EventTitle.ts.backup exists
) else (
    echo ✗ EventTitle.ts.backup NOT FOUND
)

if exist src\components\TiptapEditor\PlanEditor.tsx.backup (
    echo ✓ PlanEditor.tsx.backup exists
) else (
    echo ✗ PlanEditor.tsx.backup NOT FOUND
)
echo.

echo ========================================
echo Cleanup Complete!
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Close browser and clear cache (Ctrl+Shift+Delete)
echo 2. Restart dev server: npm start
echo 3. Open browser to http://localhost:3000
echo 4. Hard refresh: Ctrl+F5
echo.
pause
