# TestSprite - Node.js Uyumluluk Notu

TestSprite, **Node.js v25** ile `entities` paket hatası verebilir.

## Öneri: Node.js 20 LTS kullanın

1. **https://nodejs.org** adresine gidin
2. **LTS** (v20.x) sürümünü indirin
3. Kurun (mevcut Node'unuzun yerine geçer)
4. Bilgisayarı yeniden başlatın veya yeni CMD açın
5. Kontrol: `node -v` → v20.x.x olmalı
6. TestSprite: `cd PROJE` → `npm run testsprite`

## Alternatif: npx cache temizleme

CMD'de (PowerShell degil):

```cmd
rd /s /q "%LOCALAPPDATA%\npm-cache\_npx"
```

Ardindan tekrar deneyin:

```cmd
cd C:\Users\user\Desktop\PROJE
npm run testsprite
```
