@echo off
title GitHub'a Yukleme (SocialBeats 2)
color 0B

echo ==============================================================
echo SocialBeats 2 Mobil Uygulamasini GitHub'a Yukleme Araci
echo ==============================================================
echo.
echo [ONEMLI] Lutfen once www.github.com adresine giderek kendi 
echo hesabinizda "SocialBeats-2" adinda BOS bir repository olusturun.
echo.
pause

echo.
echo ==============================================================
echo 1. Adim: Git Kurulumu Kontrol Ediliyor...
echo ==============================================================
git --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Bilgisayarinizda Git kurulu degil!
    echo Lutfen https://git-scm.com adresinden Git indirip kurun.
    pause
    exit
)
echo (Git kurulu, devam ediliyor...)

cd mobile

echo.
echo ==============================================================
echo 2. Adim: Dosyalar Paketleniyor (Git Ayarlari Yapiliyor)
echo ==============================================================
:: Eger daha once git hesabi girilmemisse hata vermemesi icin gecici kimlik tanimliyoruz
git config user.email "admin@socialbeats.app"
git config user.name "SocialBeats Admin"

git init
git add .
git commit -m "SocialBeats 2 mobil versiyon ilk yukleme"
git branch -M main

echo.
echo ==============================================================
echo 3. Adim: GitHub'a Baglanti ve Yukleme
echo ==============================================================
echo.
set /p repo_url="Olusturdugunuz BOS reponun Linkini (URL) girin (Orn: https://github.com/user/SocialBeats-2.git): "

if "%repo_url%"=="" (
    echo [HATA] URL bos birakilamaz!
    pause
    exit
)

echo Yukleniyor... Lutfen bekleyin. (Bu islem internetinizin hizina gore surebilir)
:: Eger daha onceden origin eklenmisse diye once kaldiriyoruz
git remote remove origin 2>nul
git remote add origin %repo_url%
git push -u origin main

echo.
echo ==============================================================
echo ISLEM TAMAMLANDI!
echo SocialBeats 2 kodlariniz basariyla GitHub'a yollanmistir.
echo ==============================================================
pause
