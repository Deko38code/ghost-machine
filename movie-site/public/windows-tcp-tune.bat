@echo off
:: ============================================
::  CineVault Windows TCP Tune - Stream Bypass
::  Reduces timeout from 43s to 1s (2 retries)
::  Run as Administrator - Right-click ^> Run as Admin
:: ============================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [!] Run this as Administrator!
    echo  [!] Right-click this file ^> Run as Administrator
    echo.
    pause
    exit /b 1
)

echo.
echo  ================================
echo   CineVault TCP Stream Tune
echo  ================================
echo.

echo  [1/2] Setting InitialRto=1000 (1s timeout)...
netsh interface tcp set global InitialRto=1000
if %errorlevel% equ 0 (
    echo  [OK] InitialRto set to 1000
) else (
    echo  [FAIL] Could not set InitialRto
)

echo  [2/2] Setting MaxSynRetransmissions=2...
netsh interface tcp set global MaxSynRetransmissions=2
if %errorlevel% equ 0 (
    echo  [OK] MaxSynRetransmissions set to 2
) else (
    echo  [FAIL] Could not set MaxSynRetransmissions
)

echo.
echo  Done! Stream timeouts reduced.
echo  Restart your browser/VLC for best results.
echo.
pause