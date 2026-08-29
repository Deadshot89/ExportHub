@echo off
where gradle >nul 2>nul
if errorlevel 1 (
  echo Gradle 9.5.0 ist lokal nicht installiert. Nutze den enthaltenen GitHub-Workflow oder Android Studio.
  exit /b 1
)
gradle %*
