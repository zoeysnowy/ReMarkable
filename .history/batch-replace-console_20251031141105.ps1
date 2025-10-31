# 批量替换所有src目录下的console调用为logger调用

$files = @(
    "src\App.tsx",
    "src\components\TagManager.tsx",
    "src\hooks\useFloatingToolbar.ts",
    "src\pages\PlanItemEditorDemo.tsx",
    "src\services\MicrosoftCalendarService.ts"
)

foreach ($file in $files) {
    $fullPath = "c:\Users\Zoey Gong\Github\ReMarkable\$file"
    
    if (Test-Path $fullPath) {
        Write-Host "Processing: $file"
        
        # Read file content
        $content = Get-Content $fullPath -Raw
        
        # Check if logger is already imported
        $hasLoggerImport = $content -match "import.*logger.*from.*['\`"]\.\.?/utils/logger['\`"]"
        
        if (-not $hasLoggerImport) {
            # Add logger import after the last import statement
            $lastImportMatch = [regex]::Matches($content, "^import .+;?\s*$", [System.Text.RegularExpressions.RegexOptions]::Multiline) | Select-Object -Last 1
            
            if ($lastImportMatch) {
                $insertPosition = $lastImportMatch.Index + $lastImportMatch.Length
                
                # Determine module name based on file
                $moduleName = switch -Wildcard ($file) {
                    "*App.tsx" { "App" }
                    "*TagManager.tsx" { "TagManager" }
                    "*useFloatingToolbar.ts" { "FloatingToolbar" }
                    "*PlanItemEditorDemo.tsx" { "PlanDemo" }
                    "*MicrosoftCalendarService.ts" { "MSCalendar" }
                    default { "Default" }
                }
                
                # Calculate relative path to logger
                $depth = ($file -split "\\").Length - 2
                $relativePath = "../" * $depth + "utils/logger"
                
                $importStatement = "`nimport { logger } from '$relativePath';`n`nconst ${moduleName}Logger = logger.module('$moduleName');"
                
                $content = $content.Insert($insertPosition, $importStatement)
                Write-Host "  Added logger import for module: $moduleName"
            }
        } else {
            Write-Host "  Logger already imported, skipping import addition"
        }
        
        # Get logger variable name from content
        $loggerMatch = [regex]::Match($content, "const\s+(\w+)\s*=\s*logger\.module")
        if ($loggerMatch.Success) {
            $loggerName = $loggerMatch.Groups[1].Value
            
            # Replace console calls with logger calls
            # Skip lines that are disabling console (like console.log = noop)
            $replacements = 0
            $content = $content -replace '(?<!console\.\w+\s*=.*)\bconsole\.log\b', "$loggerName.log"
            $replacements++
            $content = $content -replace '(?<!console\.\w+\s*=.*)\bconsole\.warn\b', "$loggerName.warn"
            $replacements++
            $content = $content -replace '(?<!console\.\w+\s*=.*)\bconsole\.error\b', "$loggerName.error"
            $replacements++
            $content = $content -replace '(?<!console\.\w+\s*=.*)\bconsole\.debug\b', "$loggerName.debug"
            
            Write-Host "  Replaced console calls with $loggerName"
        }
        
        # Save file
        $content | Set-Content $fullPath -NoNewline
        Write-Host "  ✅ Done: $file"
    } else {
        Write-Host "  ⚠️ File not found: $file"
    }
}

Write-Host "`n✅ All files processed!"
