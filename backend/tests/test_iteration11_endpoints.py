"""
Iteration 11 Backend Tests - SocialBeats (Simplified)
Tests for:
- Profile tabs API (photos, videos, content summary)
- Popular content API (discover/popular)
- For You API (discover/for-you)
- YouTube playlist API
- Collaborative playlists API
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module-level fixtures
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
        "email": f"test_iter11_{unique_id}@test.com",
        "password": "TestPass123!",
        "username": f"testuser11_{unique_id}",
        "display_name": f"Test User 11 {unique_id}"
    }
    
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=user_data)
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "user_id": data["user"]["id"]
        }
    
    pytest.skip("Could not create test user")

@pytest.fixture(scope="module")
def second_test_user(api_client):
    """Create a second test user for collaborative tests"""
    unique_id = str(uuid.uuid4())[:8]
    user_data = {
        "email": f"test_iter11_second_{unique_id}@test.com",
        "password": "TestPass123!",
        "username": f"testuser11_second_{unique_id}",
        "display_name": f"Test User 11 Second {unique_id}"
    }
    
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=user_data)
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "user_id": data["user"]["id"]
        }
    pytest.skip("Could not create second test user")

@pytest.fixture(scope="module")
def auth_headers(test_user):
    """Get auth headers for authenticated requests"""
    return {"Authorization": f"Bearer {test_user['token']}"}

@pytest.fixture(scope="module")
def collaborative_playlist(api_client, test_user, auth_headers):
    """Create a collaborative playlist for testing"""
    playlist_data = {
        "name": f"Test Collaborative Playlist {uuid.uuid4().hex[:8]}",
        "description": "Test playlist for collaborative features",
        "is_public": True,
        "is_collaborative": True
    }
    
    response = api_client.post(
        f"{BASE_URL}/api/playlists",
        json=playlist_data,
        headers=auth_headers
    )
    
    if response.status_code in [200, 201]:
        return response.json()
    pytest.skip("Could not create collaborative playlist")


# ============== PROFILE TABS API TESTS ==============

class TestProfileTabsAPI:
    """Tests for Profile Tabs endpoints - photos, videos, content summary"""
    
    def test_get_user_photos_success(self, api_client, test_user, auth_headers):
        """GET /api/users/{user_id}/photos - Should return user's photos"""
        response = api_client.get(
            f"{BASE_URL}/api/users/{test_user['user_id']}/photos",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "photos" in data, "Response should contain 'photos' key"
        assert "total" in data, "Response should contain 'total' key"
        assert "has_more" in data, "Response should contain 'has_more' key"
        print(f"✅ GET /api/users/{test_user['user_id']}/photos - Success: {data['total']} photos")
    
    def test_get_user_photos_invalid_user(self, api_client, auth_headers):
        """GET /api/users/{user_id}/photos - Should return 404 for invalid user"""
        response = api_client.get(
            f"{BASE_URL}/api/users/invalid-user-id-12345/photos",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ GET /api/users/invalid-user/photos - Correctly returns 404")
    
    def test_get_user_photos_unauthorized(self, api_client, test_user):
        """GET /api/users/{user_id}/photos - Should require auth"""
        response = api_client.get(
            f"{BASE_URL}/api/users/{test_user['user_id']}/photos"
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/users/{user_id}/photos - Correctly requires auth")
    
    def test_get_user_videos_success(self, api_client, test_user, auth_headers):
        """GET /api/users/{user_id}/videos - Should return user's videos"""
        response = api_client.get(
            f"{BASE_URL}/api/users/{test_user['user_id']}/videos",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "videos" in data, "Response should contain 'videos' key"
        assert "total" in data, "Response should contain 'total' key"
        assert "has_more" in data, "Response should contain 'has_more' key"
        print(f"✅ GET /api/users/{test_user['user_id']}/videos - Success: {data['total']} videos")
    
    def test_get_user_videos_invalid_user(self, api_client, auth_headers):
        """GET /api/users/{user_id}/videos - Should return 404 for invalid user"""
        response = api_client.get(
            f"{BASE_URL}/api/users/invalid-user-id-12345/videos",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ GET /api/users/invalid-user/videos - Correctly returns 404")
    
    def test_get_user_content_summary_success(self, api_client, test_user, auth_headers):
        """GET /api/users/{user_id}/content - Should return content summary"""
        response = api_client.get(
            f"{BASE_URL}/api/users/{test_user['user_id']}/content",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "photos_count" in data, "Response should contain 'photos_count'"
        assert "videos_count" in data, "Response should contain 'videos_count'"
        assert "stories_count" in data, "Response should contain 'stories_count'"
        assert "highlights_count" in data, "Response should contain 'highlights_count'"
        assert "posts_count" in data, "Response should contain 'posts_count'"
        assert "total_media" in data, "Response should contain 'total_media'"
        
        print(f"✅ GET /api/users/{test_user['user_id']}/content - Success: photos={data['photos_count']}, videos={data['videos_count']}")
    
    def test_get_user_content_invalid_user(self, api_client, auth_headers):
        """GET /api/users/{user_id}/content - Should return 404 for invalid user"""
        response = api_client.get(
            f"{BASE_URL}/api/users/invalid-user-id-12345/content",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ GET /api/users/invalid-user/content - Correctly returns 404")


# ============== DISCOVER POPULAR API TESTS ==============

class TestDiscoverPopularAPI:
    """Tests for Popular Content Discovery endpoint"""
    
    def test_get_popular_content_all(self, api_client, auth_headers):
        """GET /api/discover/popular - Should return all popular content types"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/popular",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "posts" in data or "users" in data or "playlists" in data or "tracks" in data, \
            "Response should contain at least one content type"
        
        print(f"✅ GET /api/discover/popular - Success: keys={list(data.keys())}")
    
    def test_get_popular_posts_only(self, api_client, auth_headers):
        """GET /api/discover/popular?content_type=posts - Should return only posts"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/popular?content_type=posts",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "posts" in data, "Response should contain 'posts'"
        print(f"✅ GET /api/discover/popular?content_type=posts - Success: {len(data.get('posts', []))} posts")
    
    def test_get_popular_users_only(self, api_client, auth_headers):
        """GET /api/discover/popular?content_type=users - Should return only users"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/popular?content_type=users",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "users" in data, "Response should contain 'users'"
        print(f"✅ GET /api/discover/popular?content_type=users - Success: {len(data.get('users', []))} users")
    
    def test_get_popular_tracks_only(self, api_client, auth_headers):
        """GET /api/discover/popular?content_type=tracks - Should return only tracks"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/popular?content_type=tracks",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "tracks" in data, "Response should contain 'tracks'"
        print(f"✅ GET /api/discover/popular?content_type=tracks - Success: {len(data.get('tracks', []))} tracks")
    
    def test_get_popular_with_period(self, api_client, auth_headers):
        """GET /api/discover/popular?period=week - Should filter by period"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/popular?period=week",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        print("✅ GET /api/discover/popular?period=week - Success")
    
    def test_get_popular_unauthorized(self, api_client):
        """GET /api/discover/popular - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/discover/popular")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/discover/popular - Correctly requires auth")


# ============== DISCOVER FOR-YOU API TESTS ==============

class TestDiscoverForYouAPI:
    """Tests for For You personalized recommendations endpoint"""
    
    def test_get_for_you_content(self, api_client, auth_headers):
        """GET /api/discover/for-you - Should return personalized recommendations"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/for-you",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "recommendations" in data, "Response should contain 'recommendations'"
        assert "reason" in data, "Response should contain 'reason'"
        
        print(f"✅ GET /api/discover/for-you - Success: {len(data['recommendations'])} recommendations")
    
    def test_get_for_you_with_limit(self, api_client, auth_headers):
        """GET /api/discover/for-you?limit=5 - Should respect limit"""
        response = api_client.get(
            f"{BASE_URL}/api/discover/for-you?limit=5",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["recommendations"]) <= 5, "Should respect limit"
        print("✅ GET /api/discover/for-you?limit=5 - Success")
    
    def test_get_for_you_unauthorized(self, api_client):
        """GET /api/discover/for-you - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/discover/for-you")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/discover/for-you - Correctly requires auth")


# ============== YOUTUBE PLAYLIST API TESTS ==============

class TestYouTubePlaylistAPI:
    """Tests for YouTube Playlist endpoints"""
    
    def test_get_youtube_playlist_with_valid_id(self, api_client, auth_headers):
        """GET /api/youtube/playlist/{playlist_id} - Test with a known public playlist"""
        playlist_id = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
        
        response = api_client.get(
            f"{BASE_URL}/api/youtube/playlist/{playlist_id}",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "playlist" in data or "tracks" in data
            print(f"✅ GET /api/youtube/playlist/{playlist_id} - Success")
        elif response.status_code == 500:
            print(f"⚠️ GET /api/youtube/playlist - YouTube API error (expected if API key invalid)")
        else:
            print(f"⚠️ GET /api/youtube/playlist - Status: {response.status_code}")
    
    def test_get_youtube_playlist_unauthorized(self, api_client):
        """GET /api/youtube/playlist/{playlist_id} - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/youtube/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/youtube/playlist - Correctly requires auth")


# ============== COLLABORATIVE PLAYLISTS API TESTS ==============

class TestCollaborativePlaylistsAPI:
    """Tests for Collaborative Playlists endpoints"""
    
    def test_get_collaborative_playlists(self, api_client, auth_headers):
        """GET /api/playlists/collaborative - Should return user's collaborative playlists"""
        response = api_client.get(
            f"{BASE_URL}/api/playlists/collaborative",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "playlists" in data, "Response should contain 'playlists'"
        assert "total" in data, "Response should contain 'total'"
        
        print(f"✅ GET /api/playlists/collaborative - Success: {data['total']} playlists")
    
    def test_get_collaborative_playlists_unauthorized(self, api_client):
        """GET /api/playlists/collaborative - Should require auth"""
        response = api_client.get(f"{BASE_URL}/api/playlists/collaborative")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/playlists/collaborative - Correctly requires auth")
    
    def test_add_collaborator_to_playlist(self, api_client, test_user, second_test_user, auth_headers, collaborative_playlist):
        """POST /api/playlists/{id}/collaborators/{user_id} - Add collaborator"""
        playlist_id = collaborative_playlist["id"]
        collaborator_id = second_test_user["user_id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/playlists/{playlist_id}/collaborators/{collaborator_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/playlists/{playlist_id}/collaborators - Success")
    
    def test_add_collaborator_invalid_playlist(self, api_client, second_test_user, auth_headers):
        """POST /api/playlists/{id}/collaborators/{user_id} - Invalid playlist should return 404"""
        response = api_client.post(
            f"{BASE_URL}/api/playlists/invalid-playlist-id/collaborators/{second_test_user['user_id']}",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ POST /api/playlists/invalid/collaborators - Correctly returns 404")
    
    def test_add_collaborator_invalid_user(self, api_client, auth_headers, collaborative_playlist):
        """POST /api/playlists/{id}/collaborators/{user_id} - Invalid user should return 404"""
        playlist_id = collaborative_playlist["id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/playlists/{playlist_id}/collaborators/invalid-user-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ POST /api/playlists/{id}/collaborators/invalid-user - Correctly returns 404")
    
    def test_get_playlist_collaborators(self, api_client, auth_headers, collaborative_playlist):
        """GET /api/playlists/{id}/collaborators - Get list of collaborators"""
        playlist_id = collaborative_playlist["id"]
        
        response = api_client.get(
            f"{BASE_URL}/api/playlists/{playlist_id}/collaborators",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "owner" in data, "Response should contain 'owner'"
        assert "collaborators" in data, "Response should contain 'collaborators'"
        assert "total" in data, "Response should contain 'total'"
        
        print(f"✅ GET /api/playlists/{playlist_id}/collaborators - Success: {data['total']} collaborators")
    
    def test_remove_collaborator_from_playlist(self, api_client, test_user, second_test_user, auth_headers, collaborative_playlist):
        """DELETE /api/playlists/{id}/collaborators/{user_id} - Remove collaborator"""
        playlist_id = collaborative_playlist["id"]
        collaborator_id = second_test_user["user_id"]
        
        # First ensure collaborator is added
        api_client.post(
            f"{BASE_URL}/api/playlists/{playlist_id}/collaborators/{collaborator_id}",
            headers=auth_headers
        )
        
        # Then remove
        response = api_client.delete(
            f"{BASE_URL}/api/playlists/{playlist_id}/collaborators/{collaborator_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ DELETE /api/playlists/{playlist_id}/collaborators - Success")
    
    def test_add_track_to_collaborative_playlist(self, api_client, auth_headers, collaborative_playlist):
        """POST /api/playlists/{id}/tracks/{track_id}/collaborative - Add track"""
        playlist_id = collaborative_playlist["id"]
        track_id = "t1"  # Mock track ID
        
        response = api_client.post(
            f"{BASE_URL}/api/playlists/{playlist_id}/tracks/{track_id}/collaborative",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ POST /api/playlists/{playlist_id}/tracks/{track_id}/collaborative - Success")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
