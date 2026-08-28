@echo off
title Mongol Zurkhai Local Server
echo Starting server at http://127.0.0.1:8080 ...
start http://127.0.0.1:8080
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause