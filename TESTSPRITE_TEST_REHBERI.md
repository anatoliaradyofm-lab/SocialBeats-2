# TestSprite ile SocialBeats Test Rehberi

Bu rehber, projeyi TestSprite ile test etmek için adım adım ne yapmanız gerektiğini anlatır.

---

## 1. Test kullanıcısını oluşturma

Backend’in çalıştığı ortamda (MongoDB bağlı) bir kez şu komutu çalıştırın:

```bash
cd backend
python -m scripts.seed_testsprite_user
```

**Test giriş bilgileri:**

| Alan     | Değer                  |
|----------|------------------------|
| E-posta  | `testsprite@test.com`  |
| Şifre    | `TestSprite123!`      |

---

## 2. PRD dosyası

- **İndirme (backend çalışırken):** `GET /api/public/prd` → `SocialBeats-PRD.md` iner.
- **Proje içi:** `PRD.md` dosyasını doğrudan kullanabilirsiniz.

TestSprite’a PRD olarak bu dosyayı verebilirsiniz.

---

## 3. Uygulamayı çalıştırma

TestSprite **frontend** testi için uygulamanın çalışıyor olması gerekir.

- **Expo web (önerilen test için):**  
  ```bash
  cd frontend
  npm run web
  ```
  Varsayılan port genelde **8081** (Expo web). Tarayıcıda `http://localhost:8081` açılır.

- **Backend API:**  
  Backend’in de ayakta olduğundan emin olun (giriş ve diğer API’ler için). Örneğin:
  ```bash
  cd backend
  python server.py
  ```
  veya projenizde kullandığınız çalıştırma komutu.

TestSprite, projeyi **production** modda (build + serve) istiyor olabilir. Expo’da production web için:

```bash
cd frontend
npx expo export --platform web
npx serve dist
```

Bu durumda `serve`’in kullandığı portu (genelde 3000) TestSprite konfigürasyonunda **localPort** olarak belirtin.

---

## 4. TestSprite konfigürasyonu

- İlk kurulumda **TestSprite bootstrap** çalıştırıldı; proje **frontend** ve **codebase** kapsamında ayarlandı.
- **Code summary** şu dosyaya yazıldı:  
  `testsprite_tests/tmp/code_summary.yaml`

TestSprite’ta:

- **Proje yolu:** `c:\Users\user\Desktop\PROJE`
- **Port:** Web’de çalışan uygulamanın portu (örn. 8081 veya 3000)
- **Giriş:** E-posta `testsprite@test.com`, şifre `TestSprite123!`

---

## 5. TestSprite’ta test planı ve çalıştırma

1. **Frontend test planı oluşturma:**  
   TestSprite aracında “frontend test planı oluştur” seçeneğini kullanın; giriş gerekli olarak işaretleyin (needLogin: true).

2. **Testleri çalıştırma:**  
   Uygulama (web + backend) çalışır durumdayken “generate and execute tests” benzeri adımı çalıştırın.  
   Giriş bilgilerini (e-posta / şifre) TestSprite’a verdiğinizden emin olun.

---

## 6. Özet kontrol listesi

- [ ] Test kullanıcısı oluşturuldu (`python -m scripts.seed_testsprite_user`)
- [ ] Backend çalışıyor
- [ ] Frontend web’de çalışıyor (`npm run web` veya `expo export` + `serve`)
- [ ] TestSprite’a PRD verildi (`PRD.md` veya `/api/public/prd`)
- [ ] TestSprite’a giriş bilgileri verildi (testsprite@test.com / TestSprite123!)
- [ ] `code_summary.yaml` mevcut (`testsprite_tests/tmp/code_summary.yaml`)

Bu adımlar tamamsa TestSprite ile testleri koşturabilirsiniz.
