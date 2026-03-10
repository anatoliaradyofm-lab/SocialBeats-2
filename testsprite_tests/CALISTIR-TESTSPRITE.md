# TestSprite Testlerini Çalıştırma

Bu projede TestSprite ile frontend test planı oluşturuldu. Testlerin **gerçekten koşması** için aşağıdaki adımları sırayla yapın.

---

## 1. Backend’i başlatın

```bash
cd c:\Users\user\Desktop\PROJE\backend
python server.py
```

API’nin http://localhost:8000 üzerinde çalıştığını kontrol edin.

---

## 2. Test kullanıcısını oluşturun (bir kez)

```bash
cd c:\Users\user\Desktop\PROJE\backend
python -m scripts.seed_testsprite_user
```

**Giriş:** `testsprite@test.com` / `TestSprite123!`

---

## 3. Frontend’i port 8081’de başlatın

**İlk kez web çalıştıracaksanız** (Expo web bağımlılıkları gerekir):

```bash
cd c:\Users\user\Desktop\PROJE\frontend
npx expo install react-dom react-native-web @expo/metro-runtime
```

Ardından:

```bash
npm run web
```

Tarayıcıda http://localhost:8081 açılıyorsa devam edin.

---

## 4. TestSprite testlerini çalıştırın

```bash
cd c:\Users\user\Desktop\PROJE
npx testsprite-mcp generateCodeAndExecute
```

(TestSprite MCP kuruluysa Cursor üzerinden ilgili komutla da tetikleyebilirsiniz.)

---

## Oluşturulan dosyalar

| Dosya | Açıklama |
|-------|----------|
| `code_summary.yaml` | Proje özeti (rota, özellikler, giriş) |
| `testsprite_tests/testsprite_frontend_test_plan.json` | Frontend test planı (TC001, TC002, …) |
| `testsprite_tests/testsprite-mcp-test-report.md` | Test raporu (durum ve sonraki adımlar) |
| `PRD.md` | Ürün gereksinimleri dokümanı |

Testler bittikten sonra ham sonuçlar `testsprite_tests/tmp/raw_report.md` içinde oluşur; tam rapor `testsprite_tests/testsprite-mcp-test-report.md` güncellenebilir.
