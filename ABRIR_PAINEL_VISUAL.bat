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
echo Agora voce tem CONTROLE TOTAL pelo site!
echo As configuracoes que voce mudar NO SITE sao enviadas para o "ROBO 24H".
echo.
echo Voce tambem pode usar o arquivo "EDITAR_CONFIGURACAO.bat" se preferir.
echo.

call npm run dev -- --open

pause
