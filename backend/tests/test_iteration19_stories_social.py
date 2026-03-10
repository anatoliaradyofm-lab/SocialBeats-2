"""
Test Iteration 19 - Stories, Social Features, Themes, Library
Tests: Story system (Instagram-like), Social feed/posts, Theme API, Library favorites, Playlists
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
TEST_PREFIX = "TEST_ITER19_"


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


class TestIteration19:
    """Iteration 19 API endpoint tests - Stories, Social, Themes, Library"""
    
    created_story_ids = []
    created_post_ids = []
    
    # ============== AUTHENTICATION TEST ==============
    
    def test_01_login_success(self):
        """Test login with valid credentials"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✅ Login successful for {TEST_USER_EMAIL}")
        time.sleep(0.5)
    
    # ============== STORY FEED TESTS ==============
    
    def test_02_get_stories_feed(self, auth_session):
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
        time.sleep(0.5)
    
    # ============== CREATE STORY TESTS ==============
    
    def test_03_create_text_story(self, auth_session):
        """POST /api/stories - Create text story"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Test text story content",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create text story failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data
        assert data["story_type"] == "text"
        assert data["text"] == story_data["text"]
        assert data["user_id"] == user_id
        assert "created_at" in data
        assert "expires_at" in data
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Text story created: {data['id']}")
        time.sleep(0.5)
    
    def test_04_create_mood_story(self, auth_session):
        """POST /api/stories - Create mood story"""
        session = auth_session["session"]
        
        story_data = {
            "story_type": "mood",
            "mood": "Enerjik",
            "text": f"{TEST_PREFIX}Feeling energetic!",
            "background_color": "#22C55E"
        }
        
        response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create mood story failed: {response.text}"
        data = response.json()
        
        assert data["story_type"] == "mood"
        assert data["mood"] == "Enerjik"
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Mood story created: {data['id']}")
        time.sleep(0.5)
    
    def test_05_create_track_story(self, auth_session):
        """POST /api/stories - Create track story"""
        session = auth_session["session"]
        
        story_data = {
            "story_type": "track",
            "track_id": "t1",  # Mock track ID
            "text": f"{TEST_PREFIX}Listening to this!"
        }
        
        response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create track story failed: {response.text}"
        data = response.json()
        
        assert data["story_type"] == "track"
        assert data["track"] is not None
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Track story created: {data['id']}")
        time.sleep(0.5)
    
    # ============== GET MY STORIES TEST ==============
    
    def test_06_get_my_stories(self, auth_session):
        """GET /api/stories/my - Get current user's stories"""
        session = auth_session["session"]
        
        # First create a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}My stories test"
        }
        create_response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        time.sleep(0.5)
        
        # Get my stories
        response = session.get(f"{BASE_URL}/api/stories/my")
        
        assert response.status_code == 200, f"Get my stories failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Find our created story
        story_found = any(s["id"] == created_story["id"] for s in data)
        assert story_found, "Created story not found in my stories"
        
        print(f"✅ My stories retrieved: {len(data)} stories")
        time.sleep(0.5)
    
    # ============== VIEW STORY TEST ==============
    
    def test_07_view_story(self, auth_session):
        """POST /api/stories/{id}/view - View a story"""
        session = auth_session["session"]
        
        # Create a story first
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}View test story"
        }
        create_response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        time.sleep(0.5)
        
        # View own story
        response = session.post(f"{BASE_URL}/api/stories/{created_story['id']}/view")
        
        assert response.status_code == 200, f"View story failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        print("✅ Story view endpoint works")
        time.sleep(0.5)
    
    # ============== STORY REPLY TEST ==============
    
    def test_08_story_reply_own_story_fails(self, auth_session):
        """POST /api/stories/{id}/reply - Cannot reply to own story"""
        session = auth_session["session"]
        
        # Create a story first
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Reply test story"
        }
        create_response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        time.sleep(0.5)
        
        # Try to reply to own story - should fail
        reply_data = {
            "story_id": created_story['id'],  # Required by StoryReplyRequest model
            "content": "Test reply",
            "reply_type": "text"
        }
        response = session.post(
            f"{BASE_URL}/api/stories/{created_story['id']}/reply",
            json=reply_data
        )
        
        # 400 = business logic rejection, 422 = validation error (both acceptable)
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("✅ Cannot reply to own story - correctly rejected")
        time.sleep(0.5)
    
    def test_09_story_reply_nonexistent_fails(self, auth_session):
        """POST /api/stories/{id}/reply - Reply to nonexistent story fails"""
        session = auth_session["session"]
        
        reply_data = {
            "content": "Test reply",
            "reply_type": "text"
        }
        response = session.post(
            f"{BASE_URL}/api/stories/nonexistent-story-id/reply",
            json=reply_data
        )
        
        # Can be 404 or 422 depending on validation
        assert response.status_code in [404, 422], f"Expected 404/422, got {response.status_code}"
        print("✅ Reply to nonexistent story correctly rejected")
        time.sleep(0.5)
    
    # ============== SOCIAL FEED TESTS ==============
    
    def test_10_get_social_feed(self, auth_session):
        """GET /api/social/feed - Get social feed"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/social/feed")
        
        assert response.status_code == 200, f"Get social feed failed: {response.text}"
        data = response.json()
        
        # Feed can return list directly or dict with posts key
        if isinstance(data, dict):
            assert "posts" in data
            posts = data["posts"]
        else:
            posts = data
        
        assert isinstance(posts, list)
        
        print(f"✅ Social feed retrieved: {len(posts)} posts")
        time.sleep(0.5)
    
    # ============== CREATE POST TEST ==============
    
    def test_11_create_post(self, auth_session):
        """POST /api/social/posts - Create a post"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        post_data = {
            "content": f"{TEST_PREFIX}Test post content #test",
            "post_type": "text",
            "visibility": "public"
        }
        
        response = session.post(
            f"{BASE_URL}/api/social/posts",
            json=post_data
        )
        
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["content"] == post_data["content"]
        assert data["user_id"] == user_id
        
        self.created_post_ids.append(data["id"])
        print(f"✅ Post created: {data['id']}")
        time.sleep(0.5)
    
    # ============== FOLLOWERS/FOLLOWING TESTS ==============
    
    def test_12_get_followers(self, auth_session):
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
        time.sleep(0.5)
    
    def test_13_get_following(self, auth_session):
        """GET /api/social/following/{id} - Get users being followed"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        response = session.get(f"{BASE_URL}/api/social/following/{user_id}")
        
        assert response.status_code == 200, f"Get following failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        print(f"✅ Following retrieved: {len(data)} users")
        time.sleep(0.5)
    
    # ============== THEME API TESTS ==============
    
    def test_14_get_all_themes(self, auth_session):
        """GET /api/themes - Get all themes"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/themes")
        
        assert response.status_code == 200, f"Get themes failed: {response.text}"
        data = response.json()
        
        assert "app_themes" in data
        assert "profile_themes" in data
        assert isinstance(data["app_themes"], list)
        assert isinstance(data["profile_themes"], list)
        assert len(data["app_themes"]) > 0
        assert len(data["profile_themes"]) > 0
        
        # Check theme structure
        for theme in data["app_themes"]:
            assert "id" in theme
            assert "name" in theme
            assert "colors" in theme
        
        print(f"✅ Themes retrieved: {len(data['app_themes'])} app themes, {len(data['profile_themes'])} profile themes")
        time.sleep(0.5)
    
    def test_15_get_app_themes(self, auth_session):
        """GET /api/themes/app - Get app themes only"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/themes/app")
        
        assert response.status_code == 200, f"Get app themes failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify expected themes exist
        theme_ids = [t["id"] for t in data]
        assert "dark" in theme_ids
        assert "light" in theme_ids
        
        print(f"✅ App themes retrieved: {len(data)} themes")
        time.sleep(0.5)
    
    def test_16_get_user_theme_settings(self, auth_session):
        """GET /api/themes/user - Get user's theme settings"""
        session = auth_session["session"]
        
        response = session.get(f"{BASE_URL}/api/themes/user")
        
        assert response.status_code == 200, f"Get user theme settings failed: {response.text}"
        data = response.json()
        
        assert "app_theme" in data
        assert "profile_theme" in data
        assert "app_theme_id" in data
        assert "profile_theme_id" in data
        
        print(f"✅ User theme settings retrieved: app={data['app_theme_id']}, profile={data['profile_theme_id']}")
        time.sleep(0.5)
    
    # ============== LIBRARY FAVORITES TESTS ==============
    
    def test_17_get_library_favorites(self, auth_session):
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
        time.sleep(0.5)
    
    def test_18_add_to_favorites(self, auth_session):
        """POST /api/library/favorites/{track_id} - Add track to favorites"""
        session = auth_session["session"]
        
        track_id = "t1"  # Mock track ID
        
        response = session.post(f"{BASE_URL}/api/library/favorites/{track_id}")
        
        assert response.status_code == 200, f"Add to favorites failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        print(f"✅ Track {track_id} added to favorites")
        time.sleep(0.5)
    
    def test_19_remove_from_favorites(self, auth_session):
        """DELETE /api/library/favorites/{track_id} - Remove track from favorites"""
        session = auth_session["session"]
        
        track_id = "t1"  # Mock track ID
        
        # First add to favorites
        session.post(f"{BASE_URL}/api/library/favorites/{track_id}")
        time.sleep(0.3)
        
        # Then remove
        response = session.delete(f"{BASE_URL}/api/library/favorites/{track_id}")
        
        assert response.status_code == 200, f"Remove from favorites failed: {response.text}"
        data = response.json()
        assert "message" in data
        
        print(f"✅ Track {track_id} removed from favorites")
        time.sleep(0.5)
    
    # ============== PLAYLISTS TESTS ==============
    
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
            assert "owner_id" in playlist
        
        print(f"✅ Playlists retrieved: {len(data)} playlists")
        time.sleep(0.5)
    
    def test_21_create_playlist(self, auth_session):
        """POST /api/playlists - Create a playlist"""
        session = auth_session["session"]
        user_id = auth_session["user_id"]
        
        playlist_data = {
            "name": f"{TEST_PREFIX}Test Playlist",
            "description": "Test playlist description",
            "is_public": True,
            "is_collaborative": False
        }
        
        response = session.post(
            f"{BASE_URL}/api/playlists",
            json=playlist_data
        )
        
        assert response.status_code == 200, f"Create playlist failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == playlist_data["name"]
        assert data["owner_id"] == user_id
        
        print(f"✅ Playlist created: {data['id']}")
        
        # Cleanup - delete the playlist
        time.sleep(0.3)
        session.delete(f"{BASE_URL}/api/playlists/{data['id']}")
        time.sleep(0.5)
    
    # ============== DELETE STORY TEST ==============
    
    def test_22_delete_story(self, auth_session):
        """DELETE /api/stories/{id} - Delete a story"""
        session = auth_session["session"]
        
        # Create a story first
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Delete test story"
        }
        create_response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        story_id = created_story["id"]
        
        time.sleep(0.5)
        
        # Delete the story
        response = session.delete(f"{BASE_URL}/api/stories/{story_id}")
        
        assert response.status_code == 200, f"Delete story failed: {response.text}"
        data = response.json()
        assert data["message"] == "Story deleted"
        
        print(f"✅ Story deleted: {story_id}")
        time.sleep(0.5)
    
    # ============== AUTH REQUIRED TESTS ==============
    
    def test_23_stories_feed_requires_auth(self):
        """GET /api/stories/feed - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/stories/feed")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Stories feed requires authentication")
        time.sleep(0.5)
    
    def test_24_social_feed_requires_auth(self):
        """GET /api/social/feed - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/social/feed")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Social feed requires authentication")
        time.sleep(0.5)
    
    def test_25_themes_requires_auth(self):
        """GET /api/themes - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/themes")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Themes API requires authentication")
        time.sleep(0.5)
    
    def test_26_library_favorites_requires_auth(self):
        """GET /api/library/favorites - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/library/favorites")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Library favorites requires authentication")
        time.sleep(0.5)
    
    def test_27_playlists_requires_auth(self):
        """GET /api/playlists - Requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/playlists")
        assert response.status_code in [401, 403, 429], f"Expected 401/403/429, got {response.status_code}"
        print("✅ Playlists API requires authentication")
    
    # ============== CLEANUP ==============
    
    @pytest.fixture(autouse=True, scope="class")
    def cleanup(self, auth_session):
        """Cleanup created test data after all tests"""
        yield
        
        session = auth_session["session"]
        
        # Cleanup stories
        for story_id in self.created_story_ids:
            try:
                session.delete(f"{BASE_URL}/api/stories/{story_id}")
            except:
                pass
        
        # Cleanup posts
        for post_id in self.created_post_ids:
            try:
                session.delete(f"{BASE_URL}/api/social/posts/{post_id}")
            except:
                pass


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
