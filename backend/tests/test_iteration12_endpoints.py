"""
Iteration 12 Backend Tests - SocialBeats
Tests for:
- Security: Device tracking (GET /api/user/devices)
- Security: Admin IP lists (GET /api/admin/ip-lists) - admin only
- Security: Admin restrictions (GET /api/admin/restrictions) - admin only
- Statistics: Listening habits (GET /api/stats/listening-habits)
- Statistics: Activity timeline (GET /api/stats/timeline)
- Statistics: Year review (GET /api/stats/year-review/{year})
- Statistics: Realtime trending (GET /api/stats/realtime/trending)
- Playlists: Smart playlist types (GET /api/playlists/smart-types)
- Playlists: Seasonal suggestions (GET /api/playlists/seasonal-suggestions)
- Playlists: Generate smart playlist (POST /api/playlists/generate-smart)
- Recommendations: Personalized (GET /api/recommendations/personalized)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def test_user(api_client):
    """Create a test user and return auth token"""
    unique_id = str(uuid.uuid4())[:8]
    user_data = {
        "email": f"TEST_iter12_{unique_id}@test.com",
        "password": "testpass123",
        "username": f"TEST_iter12_{unique_id}",
        "display_name": f"Test User {unique_id}"
    }
    
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=user_data)
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "credentials": user_data
        }
    
    # If registration fails, try login
    login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": user_data["email"],
        "password": user_data["password"]
    })
    if login_response.status_code == 200:
        data = login_response.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "credentials": user_data
        }
    
    pytest.skip("Could not create or login test user")

@pytest.fixture(scope="module")
def auth_headers(test_user):
    """Get auth headers for authenticated requests"""
    return {"Authorization": f"Bearer {test_user['token']}"}


class TestSetup:
    """Setup fixtures for tests - deprecated, use module-level fixtures"""
    pass


class TestDeviceTracking:
    """Test device tracking endpoints"""
    
    def test_get_user_devices(self, api_client, auth_headers):
        """GET /api/user/devices - Returns user's devices"""
        response = api_client.get(f"{BASE_URL}/api/user/devices", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should have at least one device (current device)
        assert len(data) >= 1, "Should have at least one device"
        
        # Check device structure
        device = data[0]
        assert "id" in device, "Device should have id"
        assert "platform" in device or "user_agent" in device, "Device should have platform or user_agent"
        assert "last_active" in device, "Device should have last_active"
        
        print(f"✅ GET /api/user/devices - Found {len(data)} device(s)")
    
    def test_get_devices_unauthorized(self, api_client):
        """GET /api/user/devices - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/user/devices")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/user/devices - Correctly rejects unauthorized")


class TestAdminIPLists:
    """Test admin IP list endpoints"""
    
    def test_get_ip_lists_non_admin(self, api_client, auth_headers):
        """GET /api/admin/ip-lists - Returns 403 for non-admin users"""
        response = api_client.get(f"{BASE_URL}/api/admin/ip-lists", headers=auth_headers)
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✅ GET /api/admin/ip-lists - Correctly returns 403 for non-admin")
    
    def test_get_ip_lists_unauthorized(self, api_client):
        """GET /api/admin/ip-lists - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/admin/ip-lists")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/admin/ip-lists - Correctly rejects unauthorized")


class TestAdminRestrictions:
    """Test admin restrictions endpoints"""
    
    def test_get_restrictions_non_admin(self, api_client, auth_headers):
        """GET /api/admin/restrictions - Returns 403 for non-admin users"""
        response = api_client.get(f"{BASE_URL}/api/admin/restrictions", headers=auth_headers)
        
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✅ GET /api/admin/restrictions - Correctly returns 403 for non-admin")
    
    def test_get_restrictions_unauthorized(self, api_client):
        """GET /api/admin/restrictions - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/admin/restrictions")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/admin/restrictions - Correctly rejects unauthorized")


class TestListeningHabits:
    """Test listening habits statistics endpoint"""
    
    def test_get_listening_habits(self, api_client, auth_headers):
        """GET /api/stats/listening-habits - Returns listening habits analysis"""
        response = api_client.get(f"{BASE_URL}/api/stats/listening-habits", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        assert "weekly_activity" in data, "Should have weekly_activity"
        assert "weekly_hours" in data, "Should have weekly_hours"
        assert "hourly_distribution" in data, "Should have hourly_distribution"
        assert "peak_hour" in data, "Should have peak_hour"
        assert "genre_evolution" in data, "Should have genre_evolution"
        
        # Validate data types
        assert isinstance(data["weekly_activity"], list), "weekly_activity should be a list"
        assert len(data["weekly_activity"]) == 7, "weekly_activity should have 7 days"
        assert isinstance(data["peak_hour"], int), "peak_hour should be an integer"
        
        print(f"✅ GET /api/stats/listening-habits - Peak hour: {data['peak_hour']}")
    
    def test_listening_habits_unauthorized(self, api_client):
        """GET /api/stats/listening-habits - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/stats/listening-habits")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/stats/listening-habits - Correctly rejects unauthorized")


class TestActivityTimeline:
    """Test activity timeline endpoint"""
    
    def test_get_timeline_default(self, api_client, auth_headers):
        """GET /api/stats/timeline - Returns activity timeline (default 30 days)"""
        response = api_client.get(f"{BASE_URL}/api/stats/timeline", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 30, f"Default should return 30 days, got {len(data)}"
        
        # Check activity structure
        if len(data) > 0:
            activity = data[0]
            assert "date" in activity, "Activity should have date"
            assert "count" in activity, "Activity should have count"
        
        print(f"✅ GET /api/stats/timeline - Returned {len(data)} days of activity")
    
    def test_get_timeline_custom_days(self, api_client, auth_headers):
        """GET /api/stats/timeline?days=7 - Returns custom number of days"""
        response = api_client.get(f"{BASE_URL}/api/stats/timeline?days=7", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert len(data) == 7, f"Should return 7 days, got {len(data)}"
        
        print("✅ GET /api/stats/timeline?days=7 - Custom days parameter works")
    
    def test_timeline_unauthorized(self, api_client):
        """GET /api/stats/timeline - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/stats/timeline")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/stats/timeline - Correctly rejects unauthorized")


class TestYearReview:
    """Test year review endpoint"""
    
    def test_get_year_review_2026(self, api_client, auth_headers):
        """GET /api/stats/year-review/2026 - Returns year in review stats"""
        response = api_client.get(f"{BASE_URL}/api/stats/year-review/2026", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        assert data.get("year") == 2026, "Year should be 2026"
        assert "total_minutes" in data, "Should have total_minutes"
        assert "total_hours" in data, "Should have total_hours"
        assert "total_songs" in data, "Should have total_songs"
        assert "top_artists" in data, "Should have top_artists"
        assert "top_songs" in data, "Should have top_songs"
        assert "top_genre" in data, "Should have top_genre"
        
        # Validate data types
        assert isinstance(data["top_artists"], list), "top_artists should be a list"
        assert isinstance(data["top_songs"], list), "top_songs should be a list"
        
        print(f"✅ GET /api/stats/year-review/2026 - Total hours: {data['total_hours']}")
    
    def test_get_year_review_2025(self, api_client, auth_headers):
        """GET /api/stats/year-review/2025 - Works for different years"""
        response = api_client.get(f"{BASE_URL}/api/stats/year-review/2025", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("year") == 2025, "Year should be 2025"
        
        print("✅ GET /api/stats/year-review/2025 - Different year works")
    
    def test_year_review_unauthorized(self, api_client):
        """GET /api/stats/year-review/2026 - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/stats/year-review/2026")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/stats/year-review/2026 - Correctly rejects unauthorized")


class TestRealtimeTrending:
    """Test realtime trending endpoint"""
    
    def test_get_realtime_trending_default(self, api_client, auth_headers):
        """GET /api/stats/realtime/trending - Returns realtime trending content"""
        response = api_client.get(f"{BASE_URL}/api/stats/realtime/trending", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        assert "soundcloud" in data, "Should have soundcloud trending"
        assert "period" in data, "Should have period"
        assert "timestamp" in data, "Should have timestamp"

        # Validate data types
        assert isinstance(data["soundcloud"], list), "soundcloud should be a list"
        
        print(f"✅ GET /api/stats/realtime/trending - Period: {data['period']}")
    
    def test_get_realtime_trending_week(self, api_client, auth_headers):
        """GET /api/stats/realtime/trending?period=week - Custom period"""
        response = api_client.get(f"{BASE_URL}/api/stats/realtime/trending?period=week", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("period") == "week", "Period should be week"
        
        print("✅ GET /api/stats/realtime/trending?period=week - Custom period works")
    
    def test_realtime_trending_unauthorized(self, api_client):
        """GET /api/stats/realtime/trending - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/stats/realtime/trending")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/stats/realtime/trending - Correctly rejects unauthorized")


class TestSmartPlaylistTypes:
    """Test smart playlist types endpoint"""
    
    def test_get_smart_types(self, api_client, auth_headers):
        """GET /api/playlists/smart-types - Returns available smart playlist types"""
        response = api_client.get(f"{BASE_URL}/api/playlists/smart-types", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check structure
        assert "playlists" in data, "Should have playlists key"
        playlists = data["playlists"]
        assert isinstance(playlists, list), "playlists should be a list"
        assert len(playlists) >= 1, "Should have at least one smart playlist type"
        
        # Check playlist type structure
        playlist_type = playlists[0]
        assert "type" in playlist_type, "Should have type"
        assert "name" in playlist_type, "Should have name"
        assert "description" in playlist_type, "Should have description"
        
        # Check expected types exist
        types = [p["type"] for p in playlists]
        expected_types = ["discover_weekly", "repeat_rewind", "chill_mix"]
        for expected in expected_types:
            assert expected in types, f"Should have {expected} type"
        
        print(f"✅ GET /api/playlists/smart-types - Found {len(playlists)} types")
    
    def test_smart_types_unauthorized(self, api_client):
        """GET /api/playlists/smart-types - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/playlists/smart-types")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/playlists/smart-types - Correctly rejects unauthorized")


class TestSeasonalSuggestions:
    """Test seasonal playlist suggestions endpoint"""
    
    def test_get_seasonal_suggestions(self, api_client, auth_headers):
        """GET /api/playlists/seasonal-suggestions - Returns seasonal playlist recommendations"""
        response = api_client.get(f"{BASE_URL}/api/playlists/seasonal-suggestions", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check structure
        assert "season" in data, "Should have season"
        assert "playlists" in data, "Should have playlists"
        
        # Validate season
        valid_seasons = ["spring", "summer", "fall", "winter"]
        assert data["season"] in valid_seasons, f"Season should be one of {valid_seasons}"
        
        # Check playlists structure
        playlists = data["playlists"]
        assert isinstance(playlists, list), "playlists should be a list"
        assert len(playlists) >= 1, "Should have at least one seasonal playlist"
        
        # Check playlist structure
        playlist = playlists[0]
        assert "name" in playlist, "Playlist should have name"
        assert "description" in playlist, "Playlist should have description"
        assert "mood" in playlist, "Playlist should have mood"
        
        print(f"✅ GET /api/playlists/seasonal-suggestions - Season: {data['season']}, {len(playlists)} playlists")
    
    def test_seasonal_suggestions_unauthorized(self, api_client):
        """GET /api/playlists/seasonal-suggestions - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/playlists/seasonal-suggestions")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/playlists/seasonal-suggestions - Correctly rejects unauthorized")


class TestGenerateSmartPlaylist:
    """Test smart playlist generation endpoint"""
    
    def test_generate_smart_playlist_discover_weekly(self, api_client, auth_headers):
        """POST /api/playlists/generate-smart - Generates discover_weekly playlist"""
        response = api_client.post(
            f"{BASE_URL}/api/playlists/generate-smart?playlist_type=discover_weekly",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check response structure
        assert "message" in data, "Should have message"
        assert "playlist" in data, "Should have playlist"
        
        playlist = data["playlist"]
        assert "id" in playlist, "Playlist should have id"
        assert "name" in playlist, "Playlist should have name"
        assert playlist.get("is_smart") == True, "Should be marked as smart playlist"
        assert playlist.get("smart_type") == "discover_weekly", "Smart type should be discover_weekly"
        
        print(f"✅ POST /api/playlists/generate-smart - Created: {playlist['name']}")
    
    def test_generate_smart_playlist_chill_mix(self, api_client, auth_headers):
        """POST /api/playlists/generate-smart - Generates chill_mix playlist"""
        response = api_client.post(
            f"{BASE_URL}/api/playlists/generate-smart?playlist_type=chill_mix",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        playlist = data["playlist"]
        assert playlist.get("smart_type") == "chill_mix", "Smart type should be chill_mix"
        
        print("✅ POST /api/playlists/generate-smart - chill_mix works")
    
    def test_generate_smart_playlist_invalid_type(self, api_client, auth_headers):
        """POST /api/playlists/generate-smart - Returns 400 for invalid type"""
        response = api_client.post(
            f"{BASE_URL}/api/playlists/generate-smart?playlist_type=invalid_type",
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"
        print("✅ POST /api/playlists/generate-smart - Correctly rejects invalid type")
    
    def test_generate_smart_playlist_unauthorized(self, api_client):
        """POST /api/playlists/generate-smart - Requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/playlists/generate-smart?playlist_type=discover_weekly")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ POST /api/playlists/generate-smart - Correctly rejects unauthorized")


class TestPersonalizedRecommendations:
    """Test personalized recommendations endpoint"""
    
    def test_get_personalized_recommendations(self, api_client, auth_headers):
        """GET /api/recommendations/personalized - Returns personalized content"""
        response = api_client.get(f"{BASE_URL}/api/recommendations/personalized", headers=auth_headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        assert "tracks" in data, "Should have tracks"
        assert "users" in data, "Should have users"
        assert "playlists" in data, "Should have playlists"
        assert "reason" in data, "Should have reason"
        
        # Validate data types
        assert isinstance(data["tracks"], list), "tracks should be a list"
        assert isinstance(data["users"], list), "users should be a list"
        assert isinstance(data["playlists"], list), "playlists should be a list"
        
        print(f"✅ GET /api/recommendations/personalized - Reason: {data['reason']}")
    
    def test_personalized_with_limit(self, api_client, auth_headers):
        """GET /api/recommendations/personalized?limit=5 - Respects limit parameter"""
        response = api_client.get(
            f"{BASE_URL}/api/recommendations/personalized?limit=5",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Tracks should respect limit
        assert len(data["tracks"]) <= 5, f"Should have at most 5 tracks, got {len(data['tracks'])}"
        
        print("✅ GET /api/recommendations/personalized?limit=5 - Limit parameter works")
    
    def test_personalized_unauthorized(self, api_client):
        """GET /api/recommendations/personalized - Requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/recommendations/personalized")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/recommendations/personalized - Correctly rejects unauthorized")


class TestHealthCheck:
    """Basic health check"""
    
    def test_health_endpoint(self):
        """GET /api/health - Returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        
        print("✅ GET /api/health - Backend is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
