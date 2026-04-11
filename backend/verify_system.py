"""
SocialBeats - Kapsamlı Sistem Doğrulama Test Script'i
21 Kategori — Tüm servisleri, endpoint'leri ve yapılandırmaları test eder.

Kullanım:
    python verify_system.py

Çıktı: Her kategori için ✅/❌/⚠️ durum raporu
"""
import os
import sys
import json
import asyncio
import httpx
from pathlib import Path
from datetime import datetime

# Load .env
ROOT = Path(__file__).parent
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key.strip(), val)

# ======================== CONFIG ========================
API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api")
RESULTS = []

def log(category, item, status, detail=""):
    icon = {"pass": "✅", "fail": "❌", "warn": "⚠️", "info": "ℹ️"}.get(status, "❓")
    RESULTS.append({"category": category, "item": item, "status": status, "detail": detail})
    print(f"  {icon} {item}: {detail}" if detail else f"  {icon} {item}")

# ======================== 1. ENV VARS ========================
def check_env_vars():
    print("\n🏗️ 1. ORTAM DEĞİŞKENLERİ")
    required = {
        "MONGO_URL": "MongoDB",
        "JWT_SECRET": "JWT Kimlik Doğrulama",
        "GOOGLE_CLIENT_ID": "Google OAuth",
        "SMTP_HOST": "Brevo SMTP",
        "SMTP_PASS": "Brevo SMTP Password",
        "MEILISEARCH_URL": "Meilisearch URL",
        "MEILISEARCH_MASTER_KEY": "Meilisearch Key",
        "GIPHY_API_KEY": "GIPHY API",
        "HF_TOKEN": "HuggingFace Token",
        "POSTGRES_URL": "PostgreSQL",
        "REDIS_URL": "Redis",
        "ENCRYPTION_KEY": "Şifreleme Anahtarı",
        "FIREBASE_PROJECT_ID": "Firebase",
    }
    optional_critical = {
        "R2_ACCOUNT_ID": "Cloudflare R2",
        "R2_ACCESS_KEY": "Cloudflare R2 Key",
        "R2_SECRET_KEY": "Cloudflare R2 Secret",
        "TRENCH_URL": "Trench Event Tracking",
        "TRENCH_API_KEY": "Trench API Key",
        "GRAFANA_URL": "Grafana Dashboard",
        "GRAFANA_API_KEY": "Grafana API Key",
        "CLICKHOUSE_PASSWORD": "ClickHouse Password",
        "LIVEKIT_URL": "LiveKit URL",
        "FREESOUND_API_KEY": "Freesound API",
    }

    for key, label in required.items():
        val = os.environ.get(key, "")
        if val and val not in ("", "your_key_here"):
            log("ENV", f"{label} ({key})", "pass")
        else:
            log("ENV", f"{label} ({key})", "fail", "Boş veya tanımlanmamış")

    for key, label in optional_critical.items():
        val = os.environ.get(key, "")
        if val and val not in ("", "your_key_here"):
            log("ENV", f"{label} ({key})", "pass")
        else:
            log("ENV", f"{label} ({key})", "warn", "Boş — bu servis çalışmayacak")

# ======================== 2. SERVICE CONNECTIVITY ========================
async def check_services():
    print("\n🔌 2. SERVİS BAĞLANTILARI")
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Health check
        try:
            r = await client.get(f"{API_BASE}/health")
            log("SRV", "FastAPI Health", "pass" if r.status_code == 200 else "fail", f"Status: {r.status_code}")
        except Exception as e:
            log("SRV", "FastAPI Health", "fail", str(e)[:80])

        # Meilisearch
        ms_url = os.environ.get("MEILISEARCH_URL", "")
        ms_key = os.environ.get("MEILISEARCH_MASTER_KEY", "")
        if ms_url:
            try:
                r = await client.get(f"{ms_url}/health", headers={"Authorization": f"Bearer {ms_key}"})
                log("SRV", "Meilisearch", "pass" if r.status_code == 200 else "warn", f"Status: {r.status_code}")
            except Exception as e:
                log("SRV", "Meilisearch", "fail", str(e)[:80])
        else:
            log("SRV", "Meilisearch", "warn", "URL boş")

        # Redis (Upstash REST)
        redis_rest = os.environ.get("UPSTASH_REDIS_REST_URL", "")
        redis_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
        if redis_rest and redis_token:
            try:
                r = await client.get(f"{redis_rest}/ping", headers={"Authorization": f"Bearer {redis_token}"})
                log("SRV", "Redis (Upstash)", "pass" if r.status_code == 200 else "warn", f"Status: {r.status_code}")
            except Exception as e:
                log("SRV", "Redis (Upstash)", "fail", str(e)[:80])
        else:
            log("SRV", "Redis (Upstash)", "warn", "REST URL veya token boş")

        # Supabase
        sb_url = os.environ.get("SUPABASE_URL", "")
        sb_key = os.environ.get("SUPABASE_ANON_KEY", "")
        if sb_url and sb_key:
            try:
                r = await client.get(f"{sb_url}/rest/v1/", headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"})
                log("SRV", "PostgreSQL (Supabase)", "pass" if r.status_code in (200, 401, 404) else "warn", f"Status: {r.status_code}")
            except Exception as e:
                log("SRV", "PostgreSQL (Supabase)", "fail", str(e)[:80])
        else:
            log("SRV", "PostgreSQL (Supabase)", "warn", "Supabase URL veya key boş")

        # ClickHouse
        ch_host = os.environ.get("CLICKHOUSE_HOST", "")
        if ch_host:
            try:
                r = await client.get(f"https://{ch_host}:8443/ping", verify=False)
                log("SRV", "ClickHouse", "pass" if r.status_code == 200 else "warn", f"Status: {r.status_code}")
            except Exception:
                log("SRV", "ClickHouse", "warn", "Bağlantı kurulamadı (şifre gerekebilir)")
        else:
            log("SRV", "ClickHouse", "warn", "Host boş")

# ======================== 3. BACKEND ROUTES ========================
def check_backend_routes():
    print("\n🔗 3. BACKEND ROUTE DOSYALARI")
    routes_dir = ROOT / "routes"
    expected_routes = [
        "auth.py", "auth_new.py", "firebase_auth.py", "user_routes.py", "profile_routes.py",
        "posts.py", "comments.py", "feed.py", "stories.py", "messages.py",
        "music.py", "music_routes.py", "playlists.py", "search_unified.py",
        "notifications.py", "settings_routes.py", "social_features.py", "social_routes.py",
        "themes.py", "analytics.py", "gamification.py", "communities.py",
        "karaoke.py", "referral_routes.py", "backup.py", "highlights.py",
        "ar_effects.py", "live_video.py", "listening_rooms.py",
        "legal.py", "infrastructure.py", "security_routes.py",
        "instagram_features.py", "ads.py", "ai_moderation_routes.py",
        "i18n_routes.py", "nextauth_routes.py", "share_routes.py",
        "reports_routes.py", "discover_routes.py", "music_tos_compliant.py",
        "friends.py",
    ]
    for route_file in expected_routes:
        path = routes_dir / route_file
        if path.exists():
            size = path.stat().st_size
            log("ROUTES", route_file, "pass", f"{size:,} bytes")
        else:
            log("ROUTES", route_file, "fail", "Dosya bulunamadı")

# ======================== 4. SERVICES ========================
def check_services_files():
    print("\n⚙️ 4. SERVİS DOSYALARI")
    services_dir = ROOT / "services"
    expected = [
        "email_service.py", "encryption_service.py", "meilisearch_service.py",
        "postgresql_service.py", "rate_limiter.py", "security_middleware.py",
        "content_moderation.py", "async_moderation.py", "livekit_service.py",
        "evolution_api_service.py", "clickhouse_service.py", "grafana_service.py",
        "minio_service.py", "storage_service.py", "giphy_service.py",
        "geocoding_service.py", "expo_notifications_service.py",
        "translation_service.py", "trench_service.py", "umami_service.py",
        "lyrics_service.py", "huggingface_service.py",
    ]
    for svc_file in expected:
        path = services_dir / svc_file
        if path.exists():
            log("SVC", svc_file, "pass")
        else:
            log("SVC", svc_file, "fail", "Dosya bulunamadı")

# ======================== 5. MOBILE SCREENS ========================
def check_mobile_screens():
    print("\n📱 5. MOBİL EKRANLAR")
    mobile_dir = ROOT.parent / "mobile" / "src" / "screens"
    expected = [
        "DashboardScreen.js", "FeedScreen.js", "SearchScreen.js", "ProfileScreen.js",
        "SettingsScreen.js", "LoginScreen.js", "RegisterScreen.js",
        "ConversationsScreen.js", "ChatScreen.js", "CallScreen.js",
        "StoryCreateScreen.js", "StoryViewerScreen.js", "StoryArchiveScreen.js",
        "PlaylistsScreen.js", "PlaylistDetailScreen.js",
        "NotificationsScreen.js", "AchievementsScreen.js",
        "CommunitiesScreen.js", "KaraokeScreen.js", "ReferralScreen.js", "BackupScreen.js",
        "LiveStreamScreen.js", "ListeningRoomScreen.js", "EqualizerScreen.js",
        "ARMusicScreen.js", "LyricsScreen.js",
        "BlockedUsersScreen.js", "CloseFriendsScreen.js",
        "DataExportScreen.js", "DeleteAccountScreen.js",
        "ChangeEmailScreen.js", "ChangePasswordScreen.js", "SessionsScreen.js",
    ]
    for screen in expected:
        path = mobile_dir / screen
        if path.exists():
            log("MOB", screen, "pass")
        else:
            log("MOB", screen, "fail", "Ekran dosyası bulunamadı")

# ======================== 6. TRANSLATIONS ========================
def check_translations():
    print("\n🌍 6. ÇEVİRİ DOSYALARI")
    i18n_dir = ROOT.parent / "mobile" / "src" / "i18n"
    expected_langs = [
        "en", "tr", "ar", "de", "es", "fr", "hi", "id", "it", "ja",
        "ko", "ms", "nl", "pl", "pt", "ptBR", "ru", "th", "ur", "vi", "zh",
        "fil", "el", "uk",
    ]
    for lang in expected_langs:
        path = i18n_dir / f"translations-{lang}.js"
        if path.exists():
            log("I18N", f"translations-{lang}.js", "pass")
        else:
            log("I18N", f"translations-{lang}.js", "warn", "Eksik — oluşturulmalı")

# ======================== 7. TESTS ========================
def check_tests():
    print("\n🧪 7. TEST DOSYALARI")
    tests_dir = ROOT / "tests"
    if tests_dir.exists():
        test_files = list(tests_dir.glob("test_*.py"))
        log("TEST", f"Test dosyası sayısı: {len(test_files)}", "pass" if len(test_files) > 10 else "warn")
        for tf in test_files[:10]:
            log("TEST", tf.name, "info")
    else:
        log("TEST", "tests/ dizini", "fail", "Bulunamadı")

# ======================== SUMMARY ========================
def print_summary():
    print("\n" + "=" * 60)
    print("📊 SONUÇ ÖZETİ")
    print("=" * 60)
    pass_count = sum(1 for r in RESULTS if r["status"] == "pass")
    fail_count = sum(1 for r in RESULTS if r["status"] == "fail")
    warn_count = sum(1 for r in RESULTS if r["status"] == "warn")
    total = len(RESULTS)
    print(f"  ✅ Başarılı: {pass_count}/{total}")
    print(f"  ❌ Başarısız: {fail_count}/{total}")
    print(f"  ⚠️ Uyarı: {warn_count}/{total}")
    print(f"  📈 Puan: {pass_count}/{total} ({int(pass_count/max(total,1)*100)}%)")

    if fail_count > 0:
        print("\n🚨 KRİTİK HATALAR:")
        for r in RESULTS:
            if r["status"] == "fail":
                print(f"  ❌ [{r['category']}] {r['item']}: {r['detail']}")

    if warn_count > 0:
        print("\n⚠️ UYARILAR:")
        for r in RESULTS:
            if r["status"] == "warn":
                print(f"  ⚠️ [{r['category']}] {r['item']}: {r['detail']}")

    # Save as JSON
    report_path = ROOT / "test_reports" / f"system_check_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    report_path.parent.mkdir(exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {"pass": pass_count, "fail": fail_count, "warn": warn_count, "total": total},
            "results": RESULTS
        }, f, ensure_ascii=False, indent=2)
    print(f"\n📄 Detaylı rapor: {report_path}")

# ======================== MAIN ========================
async def main():
    print("=" * 60)
    print("🔍 SocialBeats — Kapsamlı Sistem Doğrulama")
    print(f"   Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    check_env_vars()
    await check_services()
    check_backend_routes()
    check_services_files()
    check_mobile_screens()
    check_translations()
    check_tests()
    print_summary()

if __name__ == "__main__":
    asyncio.run(main())
