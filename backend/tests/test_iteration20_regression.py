"""
Test Iteration 20 - Regression Testing for SocialBeats
Tests: Auth, Social Features, Themes, Stories, Library, Playlists, Music Search
Focus: Verify all endpoints after dynamic theme addition to 44 screens
"""

import pytest
import requests
import os
import time
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@test.com"
TEST_USER_PASSWORD = "test123"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_ITER20_"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for all tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login to get auth token
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    
    if login_response.status_code == 200:
        data = login_response.json()
        auth_token = data.get("access_token")
        user_id = data.get("user", {}).get("id")
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        return {"session": session, "token": auth_token, "user_id": user_id}
    
    pytest.skip("Authentication failed")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_01_login_success(self):
        """POST /api/auth/login - Login with valid credentials"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        assert "id" in data["user"]
        assert "username" in data["user"]
        
        print(f"✅ Login successful for {TEST_USER_EMAIL}")
        time.sleep(0.3)
    
    def test_02_login_invalid_credentials(self):
        """POST /api/auth/login - Login with invalid credentials"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@test.com", "password": "wrongpass"}
        )
        
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")
        time.sleep(0.3)
    
    def test_03_register_duplicate_email(self):
        """POST /api/auth/register - Register with existing email fails"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_USER_EMAIL,
                "password": "test123",
                "username": "duplicateuser"
            }
        )
        
        # Should fail because email already exists
        assert response.status_code in [400, 409, 422], f"Expected 400/409/422, got {response.status_code}"
        print("✅ Duplicate email registration correctly rejected")
        time.sleep(0.3)
    
    def test_04_get_current_user(self, auth_session):
        """GET /api/auth/me - Get current user info"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200, f"Get current user failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "email" in data
        assert "username" in data
        assert data["email"] == TEST_USER_EMAIL
        
        print(f"✅ Current user retrieved: {data['username']}")
        time.sleep(0.3)


class TestSocialEndpoints:
    """Social features endpoint tests"""
    
    created_post_ids = []
    
    def test_05_get_social_feed(self, auth_session):
        """GET /api/social/feed - Get social feed"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/social/feed")
        
        assert response.status_code == 200, f"Get social feed failed: {response.text}"
        data = response.json()
        
        # Feed returns dict with posts key
        if isinstance(data, dict):
            assert "posts" in data
            posts = data["posts"]
        else:
            posts = data
        
        assert isinstance(posts, list)
        print(f"✅ Social feed retrieved: {len(posts)} posts")
        time.sleep(0.3)
    
    def test_06_create_post(self, auth_session):
        """POST /api/social/posts - Create a post"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        post_data = {
            "content": f"{TEST_PREFIX}Test post content #regression #test",
            "post_type": "text",
            "visibility": "public"
        }
        
        response = session.post(
            f"{BASE_URL}/api/social/posts",
            json=post_data
        )
        
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data
        assert data["content"] == post_data["content"]
        # Response uses user_id not author_id
        assert data["user_id"] == user_id
        
        self.created_post_ids.append(data["id"])
        print(f"✅ Post created: {data['id']}")
        time.sleep(0.3)
    
    def test_07_get_followers(self, auth_session):
        """GET /api/social/followers/{id} - Get user's followers"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        response = session.get(f"{BASE_URL}/api/social/followers/{user_id}")
        
        assert response.status_code == 200, f"Get followers failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Check structure if there are followers
        for follower in data:
            assert "id" in follower
            assert "username" in follower
            assert "is_following" in follower
        
        print(f"✅ Followers retrieved: {len(data)} followers")
        time.sleep(0.3)
    
    def test_08_get_following(self, auth_session):
        """GET /api/social/following/{id} - Get users being followed"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        response = session.get(f"{BASE_URL}/api/social/following/{user_id}")
        
        assert response.status_code == 200, f"Get following failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Following retrieved: {len(data)} users")
        time.sleep(0.3)
    
    def test_09_get_follow_status(self, auth_session):
        """GET /api/social/follow-status/{id} - Get follow status"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        response = session.get(f"{BASE_URL}/api/social/follow-status/{user_id}")
        
        assert response.status_code == 200, f"Get follow status failed: {response.text}"
        data = response.json()
        
        assert "is_following" in data
        assert "is_requested" in data
        
        print(f"✅ Follow status retrieved: is_following={data['is_following']}")
        time.sleep(0.3)


class TestThemeEndpoints:
    """Theme API endpoint tests"""
    
    def test_10_get_all_themes(self, auth_session):
        """GET /api/themes - Get all themes"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/themes")
        
        assert response.status_code == 200, f"Get themes failed: {response.text}"
        data = response.json()
        
        assert "app_themes" in data
        assert "profile_themes" in data
        assert isinstance(data["app_themes"], list)
        assert isinstance(data["profile_themes"], list)
        assert len(data["app_themes"]) >= 6  # dark, light, midnight, sunset, forest, neon
        assert len(data["profile_themes"]) >= 7
        
        # Check theme structure
        for theme in data["app_themes"]:
            assert "id" in theme
            assert "name" in theme
            assert "colors" in theme
        
        print(f"✅ Themes retrieved: {len(data['app_themes'])} app themes, {len(data['profile_themes'])} profile themes")
        time.sleep(0.3)
    
    def test_11_get_app_themes(self, auth_session):
        """GET /api/themes/app - Get app themes only"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/themes/app")
        
        assert response.status_code == 200, f"Get app themes failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 6
        
        # Verify expected themes exist
        theme_ids = [t["id"] for t in data]
        assert "dark" in theme_ids
        assert "light" in theme_ids
        assert "midnight" in theme_ids
        assert "sunset" in theme_ids
        assert "forest" in theme_ids
        assert "neon" in theme_ids
        
        print(f"✅ App themes retrieved: {theme_ids}")
        time.sleep(0.3)
    
    def test_12_get_user_theme_settings(self, auth_session):
        """GET /api/themes/user - Get user's theme settings"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/themes/user")
        
        assert response.status_code == 200, f"Get user theme settings failed: {response.text}"
        data = response.json()
        
        assert "app_theme" in data
        assert "profile_theme" in data
        assert "app_theme_id" in data
        assert "profile_theme_id" in data
        
        print(f"✅ User theme settings: app={data['app_theme_id']}, profile={data['profile_theme_id']}")
        time.sleep(0.3)
    
    def test_13_update_app_theme(self, auth_session):
        """PUT /api/themes/user/app - Update user's app theme"""
        session = auth_session["session"]
        
        # Update to midnight theme
        response = session.put(f"{BASE_URL}/api/themes/user/app?theme_id=midnight")
        
        assert response.status_code == 200, f"Update app theme failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "theme" in data
        assert data["theme"]["id"] == "midnight"
        
        print("✅ App theme updated to midnight")
        time.sleep(0.3)
        
        # Revert to dark theme
        session.put(f"{BASE_URL}/api/themes/user/app?theme_id=dark")
        time.sleep(0.3)


class TestStoryEndpoints:
    """Story system endpoint tests"""
    
    created_story_ids = []
    
    def test_14_get_stories_feed(self, auth_session):
        """GET /api/stories/feed - Get story feed"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/stories/feed")
        
        assert response.status_code == 200, f"Get stories feed failed: {response.text}"
        data = response.json()
        
        # Feed returns grouped stories by user
        assert isinstance(data, list)
        
        # Check structure if there are stories
        for user_group in data:
            assert "user_id" in user_group
            assert "username" in user_group
            assert "stories" in user_group
            assert "has_unviewed" in user_group
        
        print(f"✅ Stories feed retrieved: {len(data)} user groups")
        time.sleep(0.3)
    
    def test_15_create_story(self, auth_session):
        """POST /api/stories - Create a story"""
        session = auth_session["session"]
        
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Regression test story",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["story_type"] == "text"
        assert "created_at" in data
        assert "expires_at" in data
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Story created: {data['id']}")
        time.sleep(0.3)
    
    def test_16_get_my_stories(self, auth_session):
        """GET /api/stories/my - Get current user's stories"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/stories/my")
        
        assert response.status_code == 200, f"Get my stories failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ My stories retrieved: {len(data)} stories")
        time.sleep(0.3)
    
    def test_17_delete_story(self, auth_session):
        """DELETE /api/stories/{id} - Delete a story"""
        session = auth_session["session"]
        
        # Create a story to delete
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Story to delete"
        }
        create_response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        story_id = create_response.json()["id"]
        
        time.sleep(0.3)
        
        # Delete the story
        response = session.delete(f"{BASE_URL}/api/stories/{story_id}")
        
        assert response.status_code == 200, f"Delete story failed: {response.text}"
        data = response.json()
        assert data["message"] == "Story deleted"
        
        print(f"✅ Story deleted: {story_id}")
        time.sleep(0.3)


class TestLibraryEndpoints:
    """Library favorites endpoint tests"""
    
    def test_18_get_library_favorites(self, auth_session):
        """GET /api/library/favorites - Get favorite tracks"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/library/favorites")
        
        assert response.status_code == 200, f"Get favorites failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Check track structure if there are favorites
        for track in data:
            assert "id" in track
            assert "title" in track
            assert "artist" in track
        
        print(f"✅ Library favorites retrieved: {len(data)} tracks")
        time.sleep(0.3)
    
    def test_19_add_remove_favorite(self, auth_session):
        """POST/DELETE /api/library/favorites/{track_id} - Add/remove favorite"""
        session = auth_session["session"]
        
        # Use existing mock track ID that exists in the system
        track_id = "t1"
        
        # Add to favorites
        add_response = session.post(f"{BASE_URL}/api/library/favorites/{track_id}")
        assert add_response.status_code == 200, f"Add to favorites failed: {add_response.text}"
        
        time.sleep(0.3)
        
        # Remove from favorites
        remove_response = session.delete(f"{BASE_URL}/api/library/favorites/{track_id}")
        assert remove_response.status_code == 200, f"Remove from favorites failed: {remove_response.text}"
        
        print("✅ Add/remove favorites working")
        time.sleep(0.3)


class TestPlaylistEndpoints:
    """Playlist endpoint tests"""
    
    def test_20_get_playlists(self, auth_session):
        """GET /api/playlists - Get user's playlists"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/playlists")
        
        assert response.status_code == 200, f"Get playlists failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Check playlist structure
        for playlist in data:
            assert "id" in playlist
            assert "name" in playlist
        
        print(f"✅ Playlists retrieved: {len(data)} playlists")
        time.sleep(0.3)
    
    def test_21_create_and_delete_playlist(self, auth_session):
        """POST/DELETE /api/playlists - Create and delete playlist"""
        session = auth_session["session"]
        
        playlist_data = {
            "name": f"{TEST_PREFIX}Test Playlist",
            "description": "Regression test playlist",
            "is_public": True
        }
        
        # Create playlist
        create_response = session.post(
            f"{BASE_URL}/api/playlists",
            json=playlist_data
        )
        
        assert create_response.status_code == 200, f"Create playlist failed: {create_response.text}"
        data = create_response.json()
        
        assert "id" in data
        assert data["name"] == playlist_data["name"]
        
        playlist_id = data["id"]
        print(f"✅ Playlist created: {playlist_id}")
        
        time.sleep(0.3)
        
        # Delete playlist
        delete_response = session.delete(f"{BASE_URL}/api/playlists/{playlist_id}")
        assert delete_response.status_code == 200, f"Delete playlist failed: {delete_response.text}"
        
        print(f"✅ Playlist deleted: {playlist_id}")
        time.sleep(0.3)


class TestMusicSearchEndpoints:
    """Music search endpoint tests"""
    
    def test_22_music_search(self, auth_session):
        """GET /api/music/search/{query} - Search for music"""
        session = auth_session["session"]
        
        query = "test"
        response = session.get(f"{BASE_URL}/api/music/search/{query}")
        
        assert response.status_code == 200, f"Music search failed: {response.text}"
        data = response.json()
        
        assert "results" in data
        assert "query" in data
        assert data["query"] == query
        
        print(f"✅ Music search returned: {len(data['results'])} results")
        time.sleep(0.3)


class TestKaraokeEndpoints:
    """Karaoke/Lyrics endpoint tests"""
    
    def test_23_get_karaoke_lyrics(self, auth_session):
        """GET /api/karaoke/lyrics/{track_id} - Get lyrics for karaoke"""
        session = auth_session["session"]
        
        track_id = "test_track"
        response = session.get(f"{BASE_URL}/api/karaoke/lyrics/{track_id}")
        
        assert response.status_code == 200, f"Get karaoke lyrics failed: {response.text}"
        data = response.json()
        
        assert "lyrics" in data
        assert "synced" in data
        assert "source" in data
        
        print(f"✅ Karaoke lyrics retrieved: source={data['source']}")
        time.sleep(0.3)
    
    def test_24_search_lyrics(self, auth_session):
        """GET /api/karaoke/search - Search for lyrics"""
        session = auth_session["session"]
        
        response = session.get(
            f"{BASE_URL}/api/karaoke/search",
            params={"track": "test", "artist": "test"}
        )
        
        assert response.status_code == 200, f"Search lyrics failed: {response.text}"
        data = response.json()
        
        # Response should have lyrics or message
        assert "lyrics" in data or "message" in data
        
        print("✅ Lyrics search endpoint working")
        time.sleep(0.3)


class TestAuthRequiredEndpoints:
    """Test that endpoints require authentication"""
    
    def test_25_stories_feed_requires_auth(self):
        """GET /api/stories/feed - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/stories/feed")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Stories feed requires authentication")
        time.sleep(0.3)
    
    def test_26_social_feed_requires_auth(self):
        """GET /api/social/feed - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/social/feed")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Social feed requires authentication")
        time.sleep(0.3)
    
    def test_27_themes_requires_auth(self):
        """GET /api/themes - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/themes")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Themes API requires authentication")
        time.sleep(0.3)
    
    def test_28_library_favorites_requires_auth(self):
        """GET /api/library/favorites - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/library/favorites")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Library favorites requires authentication")
        time.sleep(0.3)
    
    def test_29_playlists_requires_auth(self):
        """GET /api/playlists - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/playlists")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Playlists API requires authentication")
        time.sleep(0.3)


class TestCleanup:
    """Cleanup test data"""
    
    def test_99_cleanup(self, auth_session):
        """Cleanup created test data"""
        session = auth_session["session"]
        
        # Cleanup stories
        for story_id in TestStoryEndpoints.created_story_ids:
            try:
                session.delete(f"{BASE_URL}/api/stories/{story_id}")
            except:
                pass
        
        # Cleanup posts
        for post_id in TestSocialEndpoints.created_post_ids:
            try:
                session.delete(f"{BASE_URL}/api/social/posts/{post_id}")
            except:
                pass
        
        print("✅ Test data cleanup completed")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
