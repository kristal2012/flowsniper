@echo off
TITLE INICIAR ROBO FLOWSNIPER (24H - MODO SERVER)
COLOR 0A
echo ==================================================
echo      INICIANDO SISTEMA 24 HORAS (VIA PM2)
echo ==================================================
echo.
echo [1] Verificando Proxy e Configuracao...
echo.

REM Stop and Delete existing process to ensure code refresh
call pm2 delete flowsniper-headless >nul 2>&1
call pm2 start ecosystem.config.cjs

echo.
echo ==================================================
echo      SUCESSO! O ROBO ESTA RODANDO NOS BASTIDORES
echo ==================================================
echo.
echo Ele vai continuar rodando 24h por dia, mesmo se voce fechar esta janela.
echo.
echo Para ver o que ele esta fazendo, use o arquivo "VER_LOGS.bat"
echo Para parar ele, use o arquivo "PARAR_ROBO.bat"
echo.
pause
