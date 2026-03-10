"""
Test Iteration 24 - Legal API Endpoints and i18n Language Files
Tests:
1. 7 new language files (it, pt, ru, ja, ko, zh, hi) - verify 15 sections each
2. Legal API endpoints for compliance frameworks (GDPR, CCPA, KVKK, LGPD)
3. Privacy policy, terms, data rights endpoints
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# =====================================================
# LANGUAGE FILE TESTS
# =====================================================

class TestLanguageFiles:
    """Test that all 7 new language files have 15 sections"""
    
    EXPECTED_SECTIONS = [
        "common", "navigation", "auth", "feed", "music", "story", 
        "profile", "settings", "languages", "feedback", "messages", 
        "search", "errors", "time", "legal"
    ]
    
    @pytest.mark.parametrize("lang", ["it", "pt", "ru", "ja", "ko", "zh", "hi"])
    def test_language_file_has_15_sections(self, lang):
        """Verify each language file has exactly 15 sections"""
        file_path = f"/app/mobile/src/i18n/locales/{lang}.json"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        section_count = len(data.keys())
        assert section_count == 15, f"{lang}.json has {section_count} sections, expected 15"
        
        # Verify all expected sections exist
        for section in self.EXPECTED_SECTIONS:
            assert section in data, f"{lang}.json missing section: {section}"
    
    @pytest.mark.parametrize("lang", ["it", "pt", "ru", "ja", "ko", "zh", "hi"])
    def test_language_file_common_section(self, lang):
        """Verify common section has required keys"""
        file_path = f"/app/mobile/src/i18n/locales/{lang}.json"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        common = data.get("common", {})
        required_keys = ["app_name", "save", "cancel", "delete", "edit", "share", "loading", "error", "success"]
        
        for key in required_keys:
            assert key in common, f"{lang}.json common section missing key: {key}"
    
    @pytest.mark.parametrize("lang", ["it", "pt", "ru", "ja", "ko", "zh", "hi"])
    def test_language_file_legal_section(self, lang):
        """Verify legal section has required keys"""
        file_path = f"/app/mobile/src/i18n/locales/{lang}.json"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        legal = data.get("legal", {})
        required_keys = ["title", "privacy_policy", "terms_of_service", "licenses"]
        
        for key in required_keys:
            assert key in legal, f"{lang}.json legal section missing key: {key}"


# =====================================================
# LEGAL API ENDPOINT TESTS
# =====================================================

class TestLegalAllEndpoint:
    """Test /api/legal/all endpoint"""
    
    def test_legal_all_italian(self):
        """GET /api/legal/all?lang=it returns Italian content"""
        response = requests.get(f"{BASE_URL}/api/legal/all?lang=it")
        assert response.status_code == 200
        
        data = response.json()
        assert "privacy_policy" in data
        assert "terms_of_service" in data
        assert "licenses" in data
        assert "supported_languages" in data
        
        # Verify Italian is in supported languages
        assert "it" in data["supported_languages"]
    
    def test_legal_all_supported_languages(self):
        """Verify all 7 new languages are in supported_languages"""
        response = requests.get(f"{BASE_URL}/api/legal/all?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        new_languages = ["it", "pt", "ru", "ja", "ko", "zh", "hi"]
        
        for lang in new_languages:
            assert lang in data["supported_languages"], f"Language {lang} not in supported_languages"


class TestComplianceEndpoint:
    """Test /api/legal/compliance endpoint for different regions"""
    
    def test_compliance_kvkk(self):
        """GET /api/legal/compliance?region=kvkk returns KVKK details"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=kvkk")
        assert response.status_code == 200
        
        data = response.json()
        assert "framework" in data
        assert "region" in data
        assert data["region"] == "KVKK"
        
        framework = data["framework"]
        assert framework["name"] == "Kişisel Verilerin Korunması Kanunu"
        assert "key_rights" in framework
        assert len(framework["key_rights"]) > 0
        assert "veri_sorumlusu" in framework
    
    def test_compliance_gdpr(self):
        """GET /api/legal/compliance?region=gdpr returns GDPR details"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=gdpr")
        assert response.status_code == 200
        
        data = response.json()
        assert "framework" in data
        assert data["region"] == "GDPR"
        
        framework = data["framework"]
        assert framework["name"] == "General Data Protection Regulation"
        assert "key_rights" in framework
        assert "Right to access (Article 15)" in framework["key_rights"]
        assert "our_compliance" in framework
        assert "how_to_exercise_rights" in framework
    
    def test_compliance_ccpa(self):
        """GET /api/legal/compliance?region=ccpa returns CCPA details"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=ccpa")
        assert response.status_code == 200
        
        data = response.json()
        assert "framework" in data
        assert data["region"] == "CCPA"
        
        framework = data["framework"]
        assert framework["name"] == "California Consumer Privacy Act"
        assert "key_rights" in framework
        assert "categories_collected" in framework
        assert "our_compliance" in framework
    
    def test_compliance_lgpd(self):
        """GET /api/legal/compliance?region=lgpd returns LGPD details"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance?region=lgpd")
        assert response.status_code == 200
        
        data = response.json()
        assert "framework" in data
        assert data["region"] == "LGPD"
        
        framework = data["framework"]
        assert framework["name"] == "Lei Geral de Proteção de Dados"
        assert "key_rights" in framework
        assert "dados_coletados" in framework
        assert "encarregado" in framework
    
    def test_compliance_all_frameworks(self):
        """GET /api/legal/compliance without region returns all frameworks"""
        response = requests.get(f"{BASE_URL}/api/legal/compliance")
        assert response.status_code == 200
        
        data = response.json()
        assert "frameworks" in data
        
        # Verify all major frameworks are present
        frameworks = data["frameworks"]
        assert "GDPR" in frameworks
        assert "CCPA" in frameworks
        assert "KVKK" in frameworks
        assert "LGPD" in frameworks


class TestDataRightsEndpoint:
    """Test /api/legal/data-rights endpoint"""
    
    def test_data_rights_turkish(self):
        """GET /api/legal/data-rights?lang=tr returns Turkish data rights"""
        response = requests.get(f"{BASE_URL}/api/legal/data-rights?lang=tr")
        assert response.status_code == 200
        
        data = response.json()
        assert "rights" in data
        assert "frameworks_applied" in data
        
        rights = data["rights"]
        assert rights["title"] == "Veri Sahibi Hakları Talebi"
        assert "request_types" in rights
        assert len(rights["request_types"]) >= 5
    
    def test_data_rights_english(self):
        """GET /api/legal/data-rights?lang=en returns English data rights"""
        response = requests.get(f"{BASE_URL}/api/legal/data-rights?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        assert "rights" in data
        
        rights = data["rights"]
        assert rights["title"] == "Data Subject Rights Request"
    
    def test_data_rights_frameworks_applied(self):
        """Verify frameworks_applied includes major regulations"""
        response = requests.get(f"{BASE_URL}/api/legal/data-rights?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        frameworks = data["frameworks_applied"]
        
        assert "GDPR" in frameworks
        assert "CCPA" in frameworks
        assert "KVKK" in frameworks
        assert "LGPD" in frameworks


class TestPrivacyPolicyEndpoint:
    """Test /api/legal/privacy-policy endpoint"""
    
    def test_privacy_policy_turkish(self):
        """GET /api/legal/privacy-policy?lang=tr returns Turkish privacy policy"""
        response = requests.get(f"{BASE_URL}/api/legal/privacy-policy?lang=tr")
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "Gizlilik Politikası"
        assert "sections" in data
        assert len(data["sections"]) == 10
        assert "last_updated" in data
    
    def test_privacy_policy_english(self):
        """GET /api/legal/privacy-policy?lang=en returns English privacy policy"""
        response = requests.get(f"{BASE_URL}/api/legal/privacy-policy?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "Privacy Policy"
        assert "sections" in data
        assert len(data["sections"]) == 10


class TestTermsEndpoint:
    """Test /api/legal/terms endpoint"""
    
    def test_terms_english(self):
        """GET /api/legal/terms?lang=en returns English terms of service"""
        response = requests.get(f"{BASE_URL}/api/legal/terms?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "Terms of Service"
        assert "sections" in data
        assert len(data["sections"]) == 11
        assert "last_updated" in data
    
    def test_terms_turkish(self):
        """GET /api/legal/terms?lang=tr returns Turkish terms of service"""
        response = requests.get(f"{BASE_URL}/api/legal/terms?lang=tr")
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "Kullanım Koşulları"
        assert "sections" in data


class TestLicensesEndpoint:
    """Test /api/legal/licenses endpoint"""
    
    def test_licenses_endpoint(self):
        """GET /api/legal/licenses returns open source licenses"""
        response = requests.get(f"{BASE_URL}/api/legal/licenses?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        assert "app_info" in data
        assert "libraries" in data
        assert "third_party_services" in data
        assert "disclaimer" in data
        
        # Verify app info
        assert data["app_info"]["name"] == "SocialBeats"
        
        # Verify libraries list
        assert len(data["libraries"]) > 0


class TestCookiePolicyEndpoint:
    """Test /api/legal/cookie-policy endpoint"""
    
    def test_cookie_policy(self):
        """GET /api/legal/cookie-policy returns cookie categories"""
        response = requests.get(f"{BASE_URL}/api/legal/cookie-policy?lang=en")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        
        categories = data["categories"]
        assert len(categories) >= 3
        
        # Verify necessary cookies are required
        necessary = next((c for c in categories if c["id"] == "necessary"), None)
        assert necessary is not None
        assert necessary["required"] == True


# =====================================================
# INTEGRATION TESTS
# =====================================================

class TestLegalIntegration:
    """Integration tests for legal endpoints"""
    
    def test_all_compliance_regions_accessible(self):
        """Verify all compliance regions return valid data"""
        regions = ["gdpr", "ccpa", "kvkk", "lgpd", "pipeda", "pdpa", "appi", "popia"]
        
        for region in regions:
            response = requests.get(f"{BASE_URL}/api/legal/compliance?region={region}")
            assert response.status_code == 200, f"Failed for region: {region}"
            
            data = response.json()
            assert "framework" in data, f"No framework in response for region: {region}"
    
    def test_privacy_policy_all_languages(self):
        """Verify privacy policy works for all supported languages"""
        languages = ["tr", "en", "de", "fr", "es", "ar"]
        
        for lang in languages:
            response = requests.get(f"{BASE_URL}/api/legal/privacy-policy?lang={lang}")
            assert response.status_code == 200, f"Failed for language: {lang}"
            
            data = response.json()
            assert "title" in data, f"No title in response for language: {lang}"
            assert "sections" in data, f"No sections in response for language: {lang}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
