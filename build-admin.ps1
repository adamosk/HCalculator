# Start new PowerShell as admin and run the build
$currentPath = (Get-Location).Path
Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$currentPath'; npm run dist-win`"" 