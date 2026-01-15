@echo off
TITLE EDITAR CONFIGURACAO (NOTEPAD)
COLOR 0E
echo ==================================================
echo      EDITANDO CONFIGURACOES DO ROBO (.ENV)
echo ==================================================
echo.
echo O Bloco de Notas vai abrir.
echo.
echo Mude o que precisar:
echo - VITE_MODE=REAL (Para valer dinheiro)
echo - VITE_PRIVATE_KEY=SuaChavePrivada...
echo - VITE_TRADE_AMOUNT=Valor da aposta
echo.
echo DEPOIS DE SALVAR O ARQUIVO NO BLOCO DE NOTAS:
echo 1. Feche o Bloco de Notas.
echo 2. Se o robo estiver rodando, REINICIE ele para pegar a nova configuracao.
echo.

notepad .env

pause
