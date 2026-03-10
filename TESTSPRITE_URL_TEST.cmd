@echo off
title TestSprite URL Testi
color 0A

echo ==============================================
echo TestSprite - URL Uzerinden Otomatik Test
echo ==============================================
echo.

set /p test_url="Test edilecek URL'yi girin (Orn: http://localhost:8081): "

if "%test_url%"=="" (
    set test_url=http://localhost:8081
    echo Bos birakildi, varsayilan URL kullaniliyor: http://localhost:8081
)

echo.
echo %test_url% adresi icin test baslatiliyor...
echo Lutfen bekleyin, tarayici otomasyonu calisacaktir.
echo ==============================================

npx testsprite-cli test --url %test_url%

echo.
echo Test tamamlandi! Sonuclari yukaridaki loglardan veya ilgili klasorden gorebilirsiniz.
pause
