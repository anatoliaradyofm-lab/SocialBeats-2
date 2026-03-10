@echo off
echo SocialBeats Chrome Eklentisi (Extension) Derleniyor...
cd /d "%~dp0frontend"
call npx expo export -p web
echo.
echo Derleme Tamamlandi! 
echo Eklenti dosyalari "frontend/dist" klasoru icerisinde olusturulmustur.
echo.
echo Bu klasoru Chrome'dan "Paketlenmemis oge yukle" diyerek eklenti olarak ekleyebilirsiniz.
pause
