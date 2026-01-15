@echo off
TITLE LIMPEZA TOTAL (CORRIGIR ERROS)
COLOR 0E
echo ==================================================
echo      CORRIGINDO PROBLEMAS DO SITE (MODO COMPLETO)
echo ==================================================
echo.
echo 1. Removendo instalacoes antigas (Isso pode demorar um pouquinho)...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del "package-lock.json"
if exist "yarn.lock" del "yarn.lock"

echo 2. Reinstalando tudo do zero...
call npm install

echo 3. Iniciando site limpo...
echo.
echo O navegador vai abrir em instantes.
echo.

call npm run dev -- --open --force

pause
