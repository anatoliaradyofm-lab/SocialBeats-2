# TestSprite – Giriş Bilgileri ve PRD

## Test kullanıcısı (uygulamaya giriş)

| Alan      | Değer                |
|----------|----------------------|
| **E-posta** | `testsprite@test.com` |
| **Şifre**   | `TestSprite123!`     |

- **Giriş endpoint’i (API):** `POST /api/auth/login`  
  Body: `{"email":"testsprite@test.com","password":"TestSprite123!"}`
- **Web arayüzü:** Uygulama giriş sayfasında yukarıdaki e-posta ve şifre ile giriş yapın.

Bu kullanıcıyı veritabanında oluşturmak için (bir kez çalıştırmanız yeterli):

```bash
cd backend
python -m scripts.seed_testsprite_user
```

---

## PRD dosyasını indirme

- **Doğrudan link (API):**  
  `GET /api/public/prd`  
  Örnek (backend çalışıyorsa): `https://<backend-host>/api/public/prd`  
  Bu istek PRD dosyasını **SocialBeats-PRD.md** olarak indirir.

- **Proje içi dosya:**  
  Repodaki `PRD.md` dosyasını doğrudan açabilir veya kopyalayabilirsiniz:  
  `PROJE/PRD.md`

---

## Özet

1. **E-posta:** testsprite@test.com  
2. **Şifre:** TestSprite123!  
3. **PRD:** Yukarıdaki `/api/public/prd` linkinden indirin veya `PRD.md` dosyasını kullanın.
