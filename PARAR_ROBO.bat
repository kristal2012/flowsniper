@echo off
TITLE PARAR ROBO FLOWSNIPER
COLOR 0C
echo ==================================================
echo      PARANDO O ROBO...
echo ==================================================
echo.

call pm2 stop flowsniper-headless
call pm2 delete flowsniper-headless

echo.
echo ==================================================
echo      O ROBO FOI DESLIGADO COM SUCESSO
echo ==================================================
echo.
pause
