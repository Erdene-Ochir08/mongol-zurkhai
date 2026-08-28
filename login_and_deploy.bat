@echo off
title Vercel Login
echo Setting up Vercel CLI...
set "PATH=%LOCALAPPDATA%\Programs\Node;%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
cd /d "c:\Users\Ochro\Documents\Mongol_zurkhai"
call npx --yes vercel login
echo.
echo Login completed! Now deploying to production...
call npx --yes vercel --prod --yes
pause