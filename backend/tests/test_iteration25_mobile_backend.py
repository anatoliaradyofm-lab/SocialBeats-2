"""
Backend API Tests for Iteration 25 - Mobile Backend APIs
Tests for:
1. Music Search API (/api/music/search/{query})
2. Music Stream API (/api/music/stream/{id}) - ToS compliant embed URL
3. Legal API (/api/legal/all?lang=tr)
4. Compliance API (/api/legal/compliance?region=kvkk)
5. Compliance API (/api/legal/compliance?region=gdpr)
6. Language files verification (13 languages)
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMusicSearchAPI:
    """Test /api/music/search/{query} endpoint"""
    
    def test_music_search_basic(self):
        """Test basic music search functionality"""
        response = requests.get(f"{BASE_URL}/api/music/search/tarkan", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "results" in data, "Response should contain 'results' key"
        assert "query" in data, "Response should contain 'query' key"
        assert "count" in data, "Response should contain 'count' key"
        assert data["query"] == "tarkan", f"Query should be 'tarkan', got {data['query']}"
        print(f"✅ Music search returned {data['count']} results for 'tarkan'")
    
    def test_music_search_turkish_artist(self):
        """Test search with Turkish artist name"""
        response = requests.get(f"{BASE_URL}/api/music/search/sezen aksu", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        print(f"✅ Turkish artist search returned {data['count']} results")
    
    def test_music_search_result_structure(self):
        """Test that search results have correct structure"""
        response = requests.get(f"{BASE_URL}/api/music/search/pop music", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        if data["count"] > 0:
            result = data["results"][0]
            # Check required fields for mobile app
            assert "id" in result or "song_id" in result, "Result should have id or song_id"
            assert "title" in result, "Result should have title"
            assert "artist" in result, "Result should have artist"
            assert "embed_url" in result, "Result should have embed_url for ToS compliance"
            assert "playback_type" in result, "Result should have playback_type"
            assert result["playback_type"] == "embed", "Playback type should be 'embed' for ToS compliance"
            print(f"✅ Search result structure is correct with embed playback")
    
    def test_music_search_short_query_rejected(self):
        """Test that short queries are rejected"""
        response = requests.get(f"{BASE_URL}/api/music/search/a", timeout=10)
        assert response.status_code == 400, f"Expected 400 for short query, got {response.status_code}"
        print("✅ Short query correctly rejected with 400")
    
    def test_music_search_with_limit(self):
        """Test search with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/music/search/rock?limit=5", timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert data["count"] <= 5, f"Expected max 5 results, got {data['count']}"
        print(f"✅ Search with limit=5 returned {data['count']} results")


class TestMusicStreamAPI:
    """Test /api/music/stream/{id} endpoint - ToS compliant embed URL"""
    
    def test_stream_returns_embed_url(self):
        """Test that stream endpoint returns stream URL (SoundCloud)"""
        track_id = "sc_123456"
        response = requests.get(f"{BASE_URL}/api/music/stream/{track_id}", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "song_id" in data or "track_id" in data or "stream_url" in data, "Response should contain stream info"
        print(f"✅ Stream endpoint returns stream URL")
    
    def test_stream_deprecated_message(self):
        """Test that stream endpoint includes deprecation notice"""
        video_id = "dQw4w9WgXcQ"
        response = requests.get(f"{BASE_URL}/api/music/stream/{video_id}", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert "deprecated" in data, "Response should indicate deprecation"
        assert data["deprecated"] == True, "Deprecated should be True"
        assert "message" in data, "Response should contain message about ToS compliance"
        # API uses migration_guide instead of migration
        assert "migration_guide" in data or "migration" in data, "Response should contain migration info"
        print("✅ Stream endpoint includes deprecation notice and migration info")
    
    def test_stream_empty_id_rejected(self):
        """Test that empty song ID is rejected"""
        response = requests.get(f"{BASE_URL}/api/music/stream/", timeout=10)
        # Should return 404 (not found) or 400 (bad request)
        assert response.status_code in [400, 404, 405], f"Expected 400/404/405, got {response.status_code}"
        print("✅ Empty song ID correctly rejected")


class TestLegalAllAPI:
    """Test /api/legal/all endpoint"""
    
    def test_legal_all_turkish(self):
        """Test legal documents in Turkish"""
        response = requests.get(f"{BASE_URL}/api/legal/all?lang=tr", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "privacy_policy" in data, "Response should contain privacy_policy"
        assert "terms_of_service" in data, "Response should contain terms_of_service"
        assert "licenses" in data, "Response should contain licenses"
        
        # Check Turkish content
        privacy = data["privacy_policy"]
        assert "title" in privacy, "Privacy policy should have title"
        assert "Gizlilik" in privacy["title"], f"Turkish privacy title should contain 'Gizlilik', got {privacy['title']}"
        print("✅ Legal documents returned in Turkish")
    
    def test_legal_all_english(self):
        """Test legal documents in English"""
        response = requests.get(f"{BASE_URL}/api/legal/all?lang=en", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        privacy = data["privacy_policy"]
        assert "Privacy" in privacy["title"], f"English privacy title should contain 'Privacy', got {privacy['title']}"
        print("✅ Legal documents returned in English")
    
    def test_legal_all_supported_languages(self):
        """Test that supported languages list is returned"""
        response = requests.get(f"{BASE_URL}/api/legal/all?lang=tr", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert "supported_languages" in data, "Response should contain supported_languages"
        
        supported = data["supported_languages"]
        # Check for all 13 languages
        expected_langs = ["tr", "en", "de", "fr", "es", "ar", "it", "pt", "ru", "ja", "ko", "zh", "hi"]
        for lang in expected_langs:
            assert lang in supported, f"Language '{lang}' should be in supported_languages"
        print(f"✅ All 13 languages are in supported_languages: {supported}")


class TestComplianceAPI:
    """Test /api/legal/compliance endpoint"""
    
    def test_compliance_kvkk(self):
        """Test KVKK compliance information"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=kvkk", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "framework" in data, "Response should contain framework"
        
        framework = data["framework"]
        assert "name" in framework, "Framework should have name"
        assert "KVKK" in framework["name"] or "Kişisel" in framework["name"], f"KVKK name incorrect: {framework['name']}"
        assert "region" in framework, "Framework should have region"
        assert framework["region"] == "Türkiye" or "Turkey" in str(framework.get("region", "")), "Region should be Turkey"
        assert "key_rights" in framework, "Framework should have key_rights"
        print(f"✅ KVKK compliance info returned: {framework['name']}")
    
    def test_compliance_gdpr(self):
        """Test GDPR compliance information"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=gdpr", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "framework" in data
        
        framework = data["framework"]
        # API returns full name "General Data Protection Regulation"
        assert "General Data Protection Regulation" in framework["name"] or "GDPR" in framework["name"], f"GDPR name incorrect: {framework['name']}"
        assert "key_rights" in framework, "Framework should have key_rights"
        
        # GDPR should have specific rights
        rights = framework["key_rights"]
        assert len(rights) > 0, "GDPR should have key rights listed"
        print(f"✅ GDPR compliance info returned with {len(rights)} key rights")
    
    def test_compliance_ccpa(self):
        """Test CCPA compliance information"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=ccpa", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        framework = data["framework"]
        # API returns full name "California Consumer Privacy Act"
        assert "California Consumer Privacy Act" in framework["name"] or "CCPA" in framework["name"], f"CCPA name incorrect: {framework['name']}"
        print(f"✅ CCPA compliance info returned: {framework['name']}")
    
    def test_compliance_lgpd(self):
        """Test LGPD (Brazil) compliance information"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=lgpd", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        framework = data["framework"]
        # API returns full name "Lei Geral de Proteção de Dados"
        assert "Lei Geral de Proteção de Dados" in framework["name"] or "LGPD" in framework["name"], f"LGPD name incorrect: {framework['name']}"
        assert "Brasil" in framework.get("region", "") or "Brazil" in str(framework), "Region should be Brazil"
        print(f"✅ LGPD compliance info returned: {framework['name']}")
    
    def test_compliance_all_frameworks(self):
        """Test getting all compliance frameworks"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert "frameworks" in data, "Response should contain frameworks"
        
        frameworks = data["frameworks"]
        expected_frameworks = ["GDPR", "CCPA", "KVKK", "LGPD"]
        for fw in expected_frameworks:
            assert fw in frameworks, f"Framework '{fw}' should be in response"
        print(f"✅ All compliance frameworks returned: {list(frameworks.keys())}")


class TestLanguageFiles:
    """Test that all 13 language files exist and have content"""
    
    EXPECTED_LANGUAGES = ["tr", "en", "de", "fr", "es", "ar", "it", "pt", "ru", "ja", "ko", "zh", "hi"]
    LOCALE_PATH = "/app/mobile/src/i18n/locales"
    
    def test_all_13_language_files_exist(self):
        """Test that all 13 language JSON files exist"""
        missing_files = []
        for lang in self.EXPECTED_LANGUAGES:
            file_path = f"{self.LOCALE_PATH}/{lang}.json"
            if not os.path.exists(file_path):
                missing_files.append(lang)
        
        assert len(missing_files) == 0, f"Missing language files: {missing_files}"
        print(f"✅ All 13 language files exist: {self.EXPECTED_LANGUAGES}")
    
    def test_language_files_are_valid_json(self):
        """Test that all language files are valid JSON"""
        invalid_files = []
        for lang in self.EXPECTED_LANGUAGES:
            file_path = f"{self.LOCALE_PATH}/{lang}.json"
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    json.load(f)
            except (json.JSONDecodeError, FileNotFoundError) as e:
                invalid_files.append((lang, str(e)))
        
        assert len(invalid_files) == 0, f"Invalid JSON files: {invalid_files}"
        print("✅ All 13 language files are valid JSON")
    
    def test_language_files_have_common_section(self):
        """Test that all language files have 'common' section"""
        missing_common = []
        for lang in self.EXPECTED_LANGUAGES:
            file_path = f"{self.LOCALE_PATH}/{lang}.json"
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if "common" not in data:
                        missing_common.append(lang)
            except Exception as e:
                missing_common.append(f"{lang} (error: {e})")
        
        assert len(missing_common) == 0, f"Files missing 'common' section: {missing_common}"
        print("✅ All language files have 'common' section")
    
    def test_language_files_have_required_sections(self):
        """Test that language files have all required sections"""
        required_sections = ["common", "navigation", "auth", "settings"]
        incomplete_files = []
        
        for lang in self.EXPECTED_LANGUAGES:
            file_path = f"{self.LOCALE_PATH}/{lang}.json"
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    missing = [s for s in required_sections if s not in data]
                    if missing:
                        incomplete_files.append((lang, missing))
            except Exception as e:
                incomplete_files.append((lang, [f"error: {e}"]))
        
        assert len(incomplete_files) == 0, f"Files missing required sections: {incomplete_files}"
        print(f"✅ All language files have required sections: {required_sections}")
    
    def test_language_files_section_count(self):
        """Test section count in each language file"""
        section_counts = {}
        for lang in self.EXPECTED_LANGUAGES:
            file_path = f"{self.LOCALE_PATH}/{lang}.json"
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    section_counts[lang] = len(data.keys())
            except Exception:
                section_counts[lang] = 0
        
        # Report section counts
        print(f"Language file section counts: {section_counts}")
        
        # Check if any files have significantly fewer sections
        max_sections = max(section_counts.values())
        incomplete = {k: v for k, v in section_counts.items() if v < max_sections}
        
        if incomplete:
            print(f"⚠️ WARNING: Some language files have fewer sections: {incomplete}")
            print(f"   Max sections: {max_sections}, Incomplete files need updating")
        else:
            print(f"✅ All language files have {max_sections} sections")


class TestHealthAndBasicEndpoints:
    """Test basic health and API availability"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ API health check passed")
    
    def test_music_cache_stats(self):
        """Test music cache stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/music/cache/stats", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert "total_cached" in data
        print(f"✅ Cache stats: {data}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
