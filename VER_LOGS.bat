@echo off
TITLE MONITORANDO ROBO FLOWSNIPER
COLOR 0B
echo ==================================================
echo      MONITORAMENTO EM TEMPO REAL
echo ==================================================
echo.
echo Aperte CTRL+C para sair do monitoramento (O robo CONTINUA rodando).
echo.

call pm2 logs flowsniper-headless

pause
