"""
Iteration 16 - Theme and Karaoke API Tests
Tests for:
- Theme API: GET /api/themes, PUT /api/themes/user/app, GET /api/themes/user
- Karaoke API: GET /api/karaoke/lyrics/{track_id}, GET /api/karaoke/search
- Party API: GET /api/party/list
- User Settings: GET /api/user/settings
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL


class TestThemeAPI:
    """Theme API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_all_themes(self, auth_headers):
        """GET /api/themes - Get all available themes"""
        response = requests.get(
            f"{BASE_URL}/api/themes",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "app_themes" in data
        assert "profile_themes" in data
        assert isinstance(data["app_themes"], list)
        assert isinstance(data["profile_themes"], list)
        
        # Verify app themes contain expected themes
        app_theme_ids = [t["id"] for t in data["app_themes"]]
        assert "dark" in app_theme_ids
        assert "light" in app_theme_ids
        assert "midnight" in app_theme_ids
        assert "sunset" in app_theme_ids
        assert "forest" in app_theme_ids
        assert "neon" in app_theme_ids
        
        # Verify theme structure
        for theme in data["app_themes"]:
            assert "id" in theme
            assert "name" in theme
            assert "colors" in theme
            assert "background" in theme["colors"]
            assert "primary" in theme["colors"]
            assert "text" in theme["colors"]
    
    def test_get_all_themes_unauthorized(self):
        """GET /api/themes - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/themes")
        assert response.status_code in [401, 403]
    
    def test_get_user_theme_settings(self, auth_headers):
        """GET /api/themes/user - Get current user's theme settings"""
        response = requests.get(
            f"{BASE_URL}/api/themes/user",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "app_theme" in data
        assert "profile_theme" in data
        assert "app_theme_id" in data
        assert "profile_theme_id" in data
        
        # Verify theme object structure
        assert "id" in data["app_theme"]
        assert "name" in data["app_theme"]
        assert "colors" in data["app_theme"]
    
    def test_update_app_theme_to_midnight(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=midnight - Update to midnight theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=midnight",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "theme" in data
        assert data["theme"]["id"] == "midnight"
        
        # Verify theme was persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/themes/user",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["app_theme_id"] == "midnight"
    
    def test_update_app_theme_to_dark(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=dark - Update to dark theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=dark",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["theme"]["id"] == "dark"
    
    def test_update_app_theme_to_light(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=light - Update to light theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=light",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["theme"]["id"] == "light"
    
    def test_update_app_theme_to_sunset(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=sunset - Update to sunset theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=sunset",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["theme"]["id"] == "sunset"
    
    def test_update_app_theme_to_forest(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=forest - Update to forest theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=forest",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["theme"]["id"] == "forest"
    
    def test_update_app_theme_to_neon(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=neon - Update to neon theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=neon",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["theme"]["id"] == "neon"
    
    def test_update_app_theme_invalid_id(self, auth_headers):
        """PUT /api/themes/user/app?theme_id=invalid - Should return 400 for invalid theme"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=invalid_theme",
            headers=auth_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_update_app_theme_unauthorized(self):
        """PUT /api/themes/user/app - Should require authentication"""
        response = requests.put(
            f"{BASE_URL}/api/themes/user/app?theme_id=dark"
        )
        assert response.status_code in [401, 403]


class TestKaraokeAPI:
    """Karaoke API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_lyrics_by_track_id(self, auth_headers):
        """GET /api/karaoke/lyrics/{track_id} - Get lyrics for a track"""
        response = requests.get(
            f"{BASE_URL}/api/karaoke/lyrics/test123",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "lyrics" in data
        assert "synced" in data
        assert "source" in data
        assert isinstance(data["lyrics"], list)
    
    def test_get_lyrics_unauthorized(self):
        """GET /api/karaoke/lyrics/{track_id} - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/karaoke/lyrics/test123")
        assert response.status_code in [401, 403]
    
    def test_search_lyrics_real_song(self, auth_headers):
        """GET /api/karaoke/search - Search for real song lyrics"""
        response = requests.get(
            f"{BASE_URL}/api/karaoke/search",
            params={"track": "Shape of You", "artist": "Ed Sheeran"},
            headers=auth_headers,
            timeout=15
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "lyrics" in data
        assert "synced" in data
        assert "source" in data
        
        # If lyrics found, verify structure
        if data["lyrics"]:
            assert isinstance(data["lyrics"], list)
            assert data["source"] == "lrclib"
            # Verify lyrics have time and text
            for lyric in data["lyrics"][:5]:  # Check first 5
                assert "time" in lyric
                assert "text" in lyric
    
    def test_search_lyrics_nonexistent_song(self, auth_headers):
        """GET /api/karaoke/search - Search for non-existent song"""
        response = requests.get(
            f"{BASE_URL}/api/karaoke/search",
            params={"track": "NonExistentSong12345", "artist": "FakeArtist99999"},
            headers=auth_headers,
            timeout=15
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return empty or message
        assert "lyrics" in data or "message" in data
    
    def test_search_lyrics_unauthorized(self):
        """GET /api/karaoke/search - Should require authentication"""
        response = requests.get(
            f"{BASE_URL}/api/karaoke/search",
            params={"track": "Test", "artist": "Test"}
        )
        assert response.status_code in [401, 403]


class TestPartyAPI:
    """Party API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_party_list(self, auth_headers):
        """GET /api/party/list - Get list of parties"""
        response = requests.get(
            f"{BASE_URL}/api/party/list",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "parties" in data
        assert isinstance(data["parties"], list)


class TestUserSettings:
    """User Settings API endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_user_settings(self, auth_headers):
        """GET /api/user/settings - Get user settings"""
        response = requests.get(
            f"{BASE_URL}/api/user/settings",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data
        # Theme should be present if user has set one
        if "theme" in data:
            assert isinstance(data["theme"], str)


class TestHealthCheck:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - Backend health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
