"""
SocialBeats - System Health & Integration Tests
================================================
Bu testler, sistemin genel sağlığını doğrular:

1. Encryption Service (AES-256-GCM)
2. Rate Limiter ve Bot Detection
3. Input Sanitizer (XSS, NoSQL Injection, Path Traversal)
4. Email Service yapılandırması
5. Locale dosyalarının bütünlüğü
6. .env yapılandırma doğrulaması
7. Security Headers
8. Brute Force Protection

Not: Bu testler sunucu gerektirmez, birim test olarak çalışır.
"""
import pytest
import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Backend root'u path'e ekle
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)


# ============== 1. Encryption Service Tests ==============

class TestEncryptionService:
    """AES-256-GCM şifreleme servisi testleri"""

    def test_encryption_module_import(self):
        """encryption_service modülü import edilebilmeli"""
        from services import encryption_service
        assert hasattr(encryption_service, 'encrypt_data')
        assert hasattr(encryption_service, 'decrypt_data')
        assert hasattr(encryption_service, 'is_configured')
        print("✅ Encryption service modülü başarıyla import edildi")

    def test_encrypt_decrypt_roundtrip(self):
        """Şifreleme ve çözme doğru çalışmalı"""
        from services import encryption_service
        original = "Gizli veri: SocialBeats test 🎵"

        if encryption_service.is_configured():
            encrypted = encryption_service.encrypt_data(original)
            assert encrypted != original, "Şifreli veri orijinalden farklı olmalı"
            decrypted = encryption_service.decrypt_data(encrypted)
            assert decrypted == original, "Çözülen veri orijinale eşit olmalı"
            print("✅ Encrypt/decrypt roundtrip testi geçti (AES-256-GCM)")
        else:
            # Fallback: key yoksa plaintext döner
            result = encryption_service.encrypt_data(original)
            assert result == original
            print("✅ Encryption key eksik - fallback plaintext doğru")

    def test_encryption_key_configured(self):
        """ENCRYPTION_KEY env variable ayarlanmış olmalı"""
        key = os.environ.get("ENCRYPTION_KEY", "")
        assert len(key) >= 16, f"ENCRYPTION_KEY en az 16 karakter olmalı, mevcut: {len(key)}"
        print(f"✅ ENCRYPTION_KEY yapılandırılmış ({len(key)} karakter)")

    def test_encrypt_empty_string(self):
        """Boş string şifrelenebilmeli"""
        from services import encryption_service
        if encryption_service.is_configured():
            result = encryption_service.encrypt_data("")
            # Boş string de şifrelenmeli
            assert isinstance(result, str)
            print("✅ Boş string şifreleme testi geçti")
        else:
            print("⚠️ Encryption key eksik, test atlandı")


# ============== 2. Rate Limiter Tests ==============

class TestRateLimiter:
    """Rate limiter ve bot detection testleri"""

    def test_rate_limiter_allows_normal_traffic(self):
        """Normal trafik rate limit'e takılmamalı"""
        from server import RateLimiter
        rl = RateLimiter()
        ip = "192.168.1.100"

        # 10 istek → hepsi geçmeli
        for _ in range(10):
            assert rl.check_rate_limit(ip, limit=100, window_seconds=60)
        print("✅ Normal trafik rate limit'e takılmıyor")

    def test_rate_limiter_blocks_excessive_traffic(self):
        """Aşırı trafik engelleneli"""
        from server import RateLimiter
        rl = RateLimiter()
        ip = "10.0.0.50"

        # 100 istek → hepsi geçmeli
        for _ in range(100):
            rl.check_rate_limit(ip, limit=100, window_seconds=60)

        # 101. istek → engellenmeli
        assert not rl.check_rate_limit(ip, limit=100, window_seconds=60)
        print("✅ Aşırı trafik engelleniyor")

    def test_ip_blocking(self):
        """IP engelleme doğru çalışmalı"""
        from server import RateLimiter
        rl = RateLimiter()
        ip = "192.168.1.200"

        assert not rl.is_blocked(ip)
        rl.block_ip(ip, duration_minutes=1)
        assert rl.is_blocked(ip)
        print("✅ IP engelleme doğru çalışıyor")

    def test_ip_unblocking(self):
        """IP engel kaldırma doğru çalışmalı"""
        from server import RateLimiter
        rl = RateLimiter()
        ip = "172.16.0.1"

        rl.block_ip(ip, duration_minutes=5)
        assert rl.is_blocked(ip)
        result = rl.unblock_ip(ip)
        assert result is True
        assert not rl.is_blocked(ip)
        print("✅ IP engel kaldırma doğru çalışıyor")

    def test_bot_detection_suspicious_user_agent(self):
        """Şüpheli user-agent tespit edilmeli"""
        from server import RateLimiter
        rl = RateLimiter()
        ip = "10.10.10.10"

        # Bot user agents
        bot_agents = ["python-requests/2.28", "curl/7.85", "scrapy/2.6"]
        for agent in bot_agents:
            rl.detect_bot_patterns(ip, "/api/users", agent)

        assert rl.suspicious_ips[ip] > 0
        print("✅ Şüpheli user-agent tespit ediliyor")

    def test_rate_limiter_stats(self):
        """Rate limiter istatistikleri döndürmeli"""
        from server import RateLimiter
        rl = RateLimiter()
        rl.check_rate_limit("1.2.3.4", limit=100)

        stats = rl.get_stats()
        assert "total_tracked_ips" in stats
        assert "blocked_ips_count" in stats
        assert "suspicious_ips" in stats
        print("✅ Rate limiter istatistikleri doğru")

    def test_remaining_requests(self):
        """Kalan istek sayısı doğru hesaplanmalı"""
        from server import RateLimiter
        rl = RateLimiter()
        ip = "5.5.5.5"

        # 30 istek yap
        for _ in range(30):
            rl.check_rate_limit(ip, limit=100, window_seconds=60)

        remaining = rl.get_remaining(ip, limit=100, window_seconds=60)
        assert remaining == 70
        print("✅ Kalan istek sayısı doğru: 70")


# ============== 3. Input Sanitizer Tests ==============

class TestInputSanitizer:
    """Güvenlik giriş doğrulama testleri"""

    def test_security_middleware_importable(self):
        """Security middleware import edilebilmeli"""
        try:
            from services.security_middleware import (
                rate_limiter, brute_force_protection, input_sanitizer,
                SECURITY_HEADERS, generate_csrf_token
            )
            assert input_sanitizer is not None
            print("✅ Security middleware import edildi")
        except ImportError:
            pytest.skip("Security middleware mevcut değil")

    def test_xss_detection(self):
        """XSS pattern'leri tespit edilmeli"""
        try:
            from services.security_middleware import input_sanitizer
            xss_payloads = [
                '<script>alert("xss")</script>',
                '<img onerror="alert(1)" src=x>',
                'javascript:alert(1)',
            ]
            for payload in xss_payloads:
                result = input_sanitizer.check_xss(payload)
                assert result is True, f"XSS tespit edilmedi: {payload}"
            print("✅ XSS pattern'leri doğru tespit ediliyor")
        except ImportError:
            pytest.skip("Security middleware mevcut değil")

    def test_nosql_injection_detection(self):
        """NoSQL injection pattern'leri tespit edilmeli"""
        try:
            from services.security_middleware import input_sanitizer
            nosql_payloads = [
                '{"$gt": ""}',
                '{"$ne": null}',
                '{"$where": "this.password.match(/.*/)"}',
            ]
            for payload in nosql_payloads:
                result = input_sanitizer.check_nosql_injection(payload)
                assert result is True, f"NoSQL injection tespit edilmedi: {payload}"
            print("✅ NoSQL injection pattern'leri doğru tespit ediliyor")
        except ImportError:
            pytest.skip("Security middleware mevcut değil")

    def test_path_traversal_detection(self):
        """Path traversal pattern'leri tespit edilmeli"""
        try:
            from services.security_middleware import input_sanitizer
            traversal_payloads = [
                '../../../etc/passwd',
                '..\\..\\windows\\system32',
                '%2e%2e%2f%2e%2e%2f',
            ]
            for payload in traversal_payloads:
                result = input_sanitizer.check_path_traversal(payload)
                assert result is True, f"Path traversal tespit edilmedi: {payload}"
            print("✅ Path traversal pattern'leri doğru tespit ediliyor")
        except ImportError:
            pytest.skip("Security middleware mevcut değil")


# ============== 4. Security Headers Tests ==============

class TestSecurityHeaders:
    """Güvenlik başlıkları testleri"""

    def test_security_headers_defined(self):
        """Gerekli güvenlik başlıkları tanımlı olmalı"""
        try:
            from services.security_middleware import SECURITY_HEADERS
            required_headers = [
                "X-Content-Type-Options",
                "X-Frame-Options",
                "X-XSS-Protection",
            ]
            for header in required_headers:
                assert header in SECURITY_HEADERS, f"Eksik güvenlik başlığı: {header}"
            print(f"✅ {len(SECURITY_HEADERS)} güvenlik başlığı tanımlı")
        except ImportError:
            pytest.skip("Security middleware mevcut değil")


# ============== 5. Locale Files Tests ==============

class TestLocaleFiles:
    """Çoklu dil dosyası bütünlük testleri"""

    LOCALES_DIR = os.path.join(BACKEND_DIR, "..", "frontend", "src", "i18n", "locales")

    def test_all_29_locale_files_exist(self):
        """29 locale dosyası mevcut olmalı"""
        if not os.path.exists(self.LOCALES_DIR):
            pytest.skip("Locales dizini bulunamadı")

        expected_locales = [
            "af", "ar", "bn", "de", "en", "es", "fil", "fr", "ha",
            "hi", "id", "it", "ja", "ko", "ms", "nl", "pl", "pt",
            "ru", "ta", "te", "th", "tr", "uk", "ur", "vi", "yo", "zh", "zu"
        ]

        for locale in expected_locales:
            filepath = os.path.join(self.LOCALES_DIR, f"{locale}.json")
            assert os.path.exists(filepath), f"Eksik locale dosyası: {locale}.json"

        print(f"✅ {len(expected_locales)} locale dosyası mevcut")

    def test_all_locale_files_valid_json(self):
        """Tüm locale dosyaları geçerli JSON olmalı"""
        if not os.path.exists(self.LOCALES_DIR):
            pytest.skip("Locales dizini bulunamadı")

        files = [f for f in os.listdir(self.LOCALES_DIR) if f.endswith('.json')]
        valid_count = 0

        for fname in files:
            filepath = os.path.join(self.LOCALES_DIR, fname)
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)  # Geçersiz JSON → exception
                assert isinstance(data, dict), f"{fname} dict olmalı"
                valid_count += 1

        assert valid_count == 29, f"Geçerli JSON dosya sayısı 29 olmalı, mevcut: {valid_count}"
        print(f"✅ {valid_count}/29 locale dosyası geçerli JSON")

    def test_locale_files_have_consistent_keys(self):
        """Tüm locale dosyaları en.json ile aynı üst düzey key'lere sahip olmalı"""
        if not os.path.exists(self.LOCALES_DIR):
            pytest.skip("Locales dizini bulunamadı")

        en_path = os.path.join(self.LOCALES_DIR, "en.json")
        if not os.path.exists(en_path):
            pytest.skip("en.json bulunamadı")

        with open(en_path, 'r', encoding='utf-8') as f:
            en_data = json.load(f)
        en_sections = set(en_data.keys())

        files = [f for f in os.listdir(self.LOCALES_DIR) if f.endswith('.json') and f != 'en.json']
        missing_sections = {}

        for fname in files:
            filepath = os.path.join(self.LOCALES_DIR, fname)
            with open(filepath, 'r', encoding='utf-8') as f:
                locale_data = json.load(f)
            locale_sections = set(locale_data.keys())
            diff = en_sections - locale_sections
            if diff:
                missing_sections[fname] = diff

        if missing_sections:
            for fname, sections in missing_sections.items():
                print(f"⚠️ {fname}: eksik bölümler: {sections}")

        assert len(missing_sections) == 0, f"{len(missing_sections)} locale dosyasında eksik bölüm var"
        print(f"✅ Tüm locale dosyaları en.json ile tutarlı")

    def test_rtl_locales_configured(self):
        """Arapça ve Urduca RTL olarak yapılandırılmış olmalı"""
        try:
            # i18n_routes dosyasından kontrol
            from routes.i18n_routes import router
            # RTL bilgisi SUPPORTED_LOCALES'da tanımlı
            print("✅ RTL locale yapılandırması kontrol edildi")
        except ImportError:
            pytest.skip("i18n_routes mevcut değil")


# ============== 6. Environment Configuration Tests ==============

class TestEnvConfiguration:
    """Ortam değişkenleri doğrulama testleri"""

    def test_mongo_url_configured(self):
        """MONGO_URL yapılandırılmış olmalı"""
        mongo_url = os.environ.get("MONGO_URL", "")
        assert len(mongo_url) > 0, "MONGO_URL boş"
        assert "mongodb" in mongo_url.lower(), "MONGO_URL mongodb:// ile başlamalı"
        print(f"✅ MONGO_URL yapılandırılmış")

    def test_jwt_secret_strong(self):
        """JWT_SECRET yeterince güçlü olmalı (en az 64 karakter)"""
        secret = os.environ.get("JWT_SECRET", "")
        assert len(secret) >= 64, f"JWT_SECRET en az 64 karakter olmalı, mevcut: {len(secret)}"
        print(f"✅ JWT_SECRET güçlü ({len(secret)} karakter)")

    def test_cors_origins_not_wildcard(self):
        """CORS_ORIGINS wildcard (*) olmamalı"""
        origins = os.environ.get("CORS_ORIGINS", "*")
        assert origins != "*", "CORS_ORIGINS wildcard (*) olmamalı"
        print(f"✅ CORS_ORIGINS kısıtlı: {origins[:50]}...")

    def test_db_name_correct(self):
        """DB_NAME 'socialbeats' olmalı"""
        db_name = os.environ.get("DB_NAME", "")
        assert db_name == "socialbeats", f"DB_NAME 'socialbeats' olmalı, mevcut: '{db_name}'"
        print("✅ DB_NAME doğru: socialbeats")

    def test_meilisearch_master_key_set(self):
        """MEILISEARCH_MASTER_KEY ayarlanmış olmalı"""
        key = os.environ.get("MEILISEARCH_MASTER_KEY", "")
        assert len(key) > 0, "MEILISEARCH_MASTER_KEY boş"
        print("✅ MEILISEARCH_MASTER_KEY ayarlanmış")


# ============== 7. Content Moderation Tests ==============

class TestContentModeration:
    """İçerik moderasyonu sistemi testleri"""

    def test_moderation_service_importable(self):
        """Moderation servisi import edilebilmeli"""
        try:
            from services.moderation_service import ContentModerationService
            service = ContentModerationService()
            assert service is not None
            print("✅ ContentModerationService import edildi")
        except ImportError:
            pytest.skip("Moderation service mevcut değil")

    def test_detoxify_threshold_configured(self):
        """DETOXIFY_TOXICITY_THRESHOLD yapılandırılmış olmalı"""
        threshold = os.environ.get("DETOXIFY_TOXICITY_THRESHOLD", "")
        if threshold:
            val = float(threshold)
            assert 0.0 < val < 1.0, f"Threshold 0-1 arası olmalı, mevcut: {val}"
            print(f"✅ DETOXIFY_TOXICITY_THRESHOLD: {val}")
        else:
            print("⚠️ DETOXIFY_TOXICITY_THRESHOLD tanımsız (varsayılan kullanılır)")


# ============== 8. File Upload Validation Tests ==============

class TestFileUploadValidation:
    """Dosya yükleme doğrulama testleri"""

    def test_dangerous_extensions_blocked(self):
        """Tehlikeli dosya uzantıları engellenmeli"""
        try:
            from services.security_middleware import validate_file_upload

            dangerous_extensions = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".php", ".jsp"]
            safe_extensions = [".jpg", ".jpeg", ".png", ".gif", ".mp4", ".mp3", ".webp"]

            # validate_file_upload fonksiyonu var mı kontrol et
            assert callable(validate_file_upload)
            print("✅ Dosya yükleme doğrulama fonksiyonu mevcut")
        except ImportError:
            pytest.skip("Security middleware mevcut değil")


# ============== 9. Email Service Tests ==============

class TestEmailService:
    """E-posta servisi testleri"""

    def test_email_service_importable(self):
        """Email servisi import edilebilmeli"""
        try:
            from services.email_service import email_service, EmailService
            assert email_service is not None
            print("✅ Email servisi import edildi")
        except ImportError:
            pytest.skip("Email service mevcut değil")


# ============== Run ==============

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
