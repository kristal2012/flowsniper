@echo off
TITLE PAINEL VISUAL (SITE)
COLOR 0B
echo ==================================================
echo      ABRINDO PAINEL VISUAL (WEB)
echo ==================================================
echo.
echo O site vai abrir no seu navegador.
echo.
echo IMPORTANTE:
echo O site serve apenas para MONITORAR ou TESTAR VISUALMENTE.
echo As configuracoes que voce mudar NO SITE nao alteram o "ROBO 24H".
echo.
echo Para mudar o Robo 24h, use o arquivo "EDITAR_CONFIGURACAO.bat".
echo.

call npm run dev

pause
