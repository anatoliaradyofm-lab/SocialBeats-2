# GitHub'a Yükleme Adımları

Projeyi GitHub'a yüklemek için kendi bilgisayarınızda **Terminal** (PowerShell veya CMD) açıp aşağıdaki komutları sırayla çalıştırın. Git kurulu olmalı: https://git-scm.com/download/win

---

## 1. Proje klasörüne gidin

```bash
cd c:\Users\user\Desktop\PROJE
```

---

## 2. Git deposu başlatın (ilk kez ise)

```bash
git init
```

---

## 3. Dosyaları ekleyin ve commit edin

```bash
git add .
git commit -m "Initial commit: SocialBeats"
```

*(.env, credentials, node_modules .gitignore sayesinde eklenmez.)*

---

## 4. GitHub'da yeni repo oluşturun

1. Tarayıcıda https://github.com/new açın.
2. **Repository name:** `SocialBeats` (veya istediğiniz isim)
3. **Public** seçin.
4. "Create repository"e tıklayın.
5. Açılan sayfada **"push an existing repository from the command line"** bölümündeki komutları kullanın.

---

## 5. Remote ekleyip push edin

Aşağıdaki `KULLANICI_ADINIZ` yerine kendi GitHub kullanıcı adınızı yazın:

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/SocialBeats.git
git branch -M main
git push -u origin main
```

GitHub girişi istenirse kullanıcı adı ve şifre (veya Personal Access Token) girin.

---

## Tamamlandı

Repo adresiniz: `https://github.com/KULLANICI_ADINIZ/SocialBeats`

Başkaları clone için: `git clone https://github.com/KULLANICI_ADINIZ/SocialBeats.git`
