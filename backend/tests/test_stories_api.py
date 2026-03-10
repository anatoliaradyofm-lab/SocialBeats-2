"""
Test Stories API Endpoints for SocialBeats
Tests: POST /api/stories, GET /api/stories/feed, GET /api/stories/my, 
       POST /api/stories/{id}/view, GET /api/stories/{id}/viewers, DELETE /api/stories/{id}
       GET /api/stories/user/{user_id}
"""

import pytest
import requests
import os
import time
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "testuser2@test.com"
TEST_USER_PASSWORD = "password123"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_STORY_"


class TestStoriesAPI:
    """Stories API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
        self.user_id = None
        self.created_story_ids = []
        
        # Login to get auth token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.auth_token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        yield
        
        # Cleanup: Delete created stories
        for story_id in self.created_story_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/stories/{story_id}")
            except:
                pass
    
    # ============== AUTHENTICATION TESTS ==============
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✅ Login successful for {TEST_USER_EMAIL}")
    
    # ============== CREATE STORY TESTS ==============
    
    def test_create_text_story(self):
        """Test creating a text story"""
        assert self.auth_token, "Authentication required"
        
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Test text story content",
            "emoji": "🎵",
            "background_color": "#FF5733"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create text story failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data
        assert data["story_type"] == "text"
        assert data["text"] == story_data["text"]
        assert data["emoji"] == story_data["emoji"]
        assert data["background_color"] == story_data["background_color"]
        assert data["user_id"] == self.user_id
        assert "created_at" in data
        assert "expires_at" in data
        assert data["viewers_count"] == 0
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Text story created: {data['id']}")
        return data["id"]
    
    def test_create_mood_story(self):
        """Test creating a mood story"""
        assert self.auth_token, "Authentication required"
        
        story_data = {
            "story_type": "mood",
            "mood": "Enerjik",
            "text": f"{TEST_PREFIX}Feeling energetic today!",
            "background_color": "#8B5CF6"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create mood story failed: {response.text}"
        data = response.json()
        
        assert data["story_type"] == "mood"
        assert data["mood"] == "Enerjik"
        assert data["text"] == story_data["text"]
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Mood story created: {data['id']}")
        return data["id"]
    
    def test_create_track_story(self):
        """Test creating a track story with mock track"""
        assert self.auth_token, "Authentication required"
        
        story_data = {
            "story_type": "track",
            "track_id": "t1",  # Mock track ID from MOCK_TRACKS
            "text": f"{TEST_PREFIX}Listening to this amazing song!"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create track story failed: {response.text}"
        data = response.json()
        
        assert data["story_type"] == "track"
        assert data["track"] is not None
        assert data["track"]["id"] == "t1"
        assert data["track"]["title"] == "Yıldızların Altında"
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Track story created: {data['id']}")
        return data["id"]
    
    def test_create_photo_story(self):
        """Test creating a photo story"""
        assert self.auth_token, "Authentication required"
        
        story_data = {
            "story_type": "photo",
            "media_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300",
            "media_type": "photo",
            "text": f"{TEST_PREFIX}Check out this photo!"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create photo story failed: {response.text}"
        data = response.json()
        
        assert data["story_type"] == "photo"
        assert data["media_url"] == story_data["media_url"]
        assert data["media_type"] == "photo"
        assert data["duration"] == 30  # Photo default duration
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Photo story created: {data['id']}")
        return data["id"]
    
    def test_create_video_story(self):
        """Test creating a video story"""
        assert self.auth_token, "Authentication required"
        
        story_data = {
            "story_type": "video",
            "media_url": "https://example.com/video.mp4",
            "media_type": "video",
            "text": f"{TEST_PREFIX}Watch this video!"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create video story failed: {response.text}"
        data = response.json()
        
        assert data["story_type"] == "video"
        assert data["media_type"] == "video"
        assert data["duration"] == 60  # Video default duration
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Video story created: {data['id']}")
        return data["id"]
    
    def test_create_story_custom_duration(self):
        """Test creating a story with custom duration"""
        assert self.auth_token, "Authentication required"
        
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Custom duration story",
            "duration": 15
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code == 200, f"Create story with custom duration failed: {response.text}"
        data = response.json()
        
        assert data["duration"] == 15
        
        self.created_story_ids.append(data["id"])
        print(f"✅ Story with custom duration created: {data['id']}")
    
    def test_create_story_without_auth(self):
        """Test creating a story without authentication - should fail"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        story_data = {
            "story_type": "text",
            "text": "Unauthorized story"
        }
        
        response = session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Create story without auth correctly rejected")
    
    # ============== GET STORIES FEED TESTS ==============
    
    def test_get_stories_feed(self):
        """Test getting stories feed"""
        assert self.auth_token, "Authentication required"
        
        # First create a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Feed test story"
        }
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        # Get feed
        response = self.session.get(f"{BASE_URL}/api/stories/feed")
        
        assert response.status_code == 200, f"Get stories feed failed: {response.text}"
        data = response.json()
        
        # Feed returns grouped stories by user
        assert isinstance(data, list)
        
        # Find our user's stories in the feed
        user_found = False
        for user_group in data:
            assert "user_id" in user_group
            assert "username" in user_group
            assert "stories" in user_group
            assert "has_unviewed" in user_group
            
            if user_group["user_id"] == self.user_id:
                user_found = True
                assert len(user_group["stories"]) > 0
                
                # Check story structure
                for story in user_group["stories"]:
                    assert "id" in story
                    assert "story_type" in story
                    assert "is_viewed" in story
                    assert "is_expired" in story
        
        print(f"✅ Stories feed retrieved: {len(data)} user groups")
    
    def test_get_stories_feed_without_auth(self):
        """Test getting stories feed without authentication - should fail"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/stories/feed")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Get stories feed without auth correctly rejected")
    
    # ============== GET MY STORIES TESTS ==============
    
    def test_get_my_stories(self):
        """Test getting current user's stories"""
        assert self.auth_token, "Authentication required"
        
        # First create a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}My stories test"
        }
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        # Get my stories
        response = self.session.get(f"{BASE_URL}/api/stories/my")
        
        assert response.status_code == 200, f"Get my stories failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Find our created story
        story_found = False
        for story in data:
            assert "id" in story
            assert "story_type" in story
            assert "is_viewed" in story
            assert story["is_viewed"] == True  # Own stories are always viewed
            assert story["is_expired"] == False
            
            if story["id"] == created_story["id"]:
                story_found = True
        
        assert story_found, "Created story not found in my stories"
        print(f"✅ My stories retrieved: {len(data)} stories")
    
    def test_get_my_stories_without_auth(self):
        """Test getting my stories without authentication - should fail"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/stories/my")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Get my stories without auth correctly rejected")
    
    # ============== VIEW STORY TESTS ==============
    
    def test_view_own_story(self):
        """Test viewing own story - should not count as view"""
        assert self.auth_token, "Authentication required"
        
        # Create a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}View own story test"
        }
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        # View own story
        response = self.session.post(f"{BASE_URL}/api/stories/{created_story['id']}/view")
        
        assert response.status_code == 200, f"View own story failed: {response.text}"
        data = response.json()
        assert data["message"] == "Own story viewed"
        print("✅ View own story handled correctly")
    
    def test_view_nonexistent_story(self):
        """Test viewing a non-existent story - should return 404"""
        assert self.auth_token, "Authentication required"
        
        response = self.session.post(f"{BASE_URL}/api/stories/nonexistent-story-id/view")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ View non-existent story correctly returns 404")
    
    def test_view_story_without_auth(self):
        """Test viewing a story without authentication - should fail"""
        session = requests.Session()
        
        response = session.post(f"{BASE_URL}/api/stories/some-story-id/view")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ View story without auth correctly rejected")
    
    # ============== GET STORY VIEWERS TESTS ==============
    
    def test_get_story_viewers_own_story(self):
        """Test getting viewers of own story"""
        assert self.auth_token, "Authentication required"
        
        # Create a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Viewers test story"
        }
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        # Get viewers
        response = self.session.get(f"{BASE_URL}/api/stories/{created_story['id']}/viewers")
        
        assert response.status_code == 200, f"Get story viewers failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        # Initially no viewers
        assert len(data) == 0
        print("✅ Get story viewers for own story works correctly")
    
    def test_get_story_viewers_nonexistent_story(self):
        """Test getting viewers of non-existent story - should return 404"""
        assert self.auth_token, "Authentication required"
        
        response = self.session.get(f"{BASE_URL}/api/stories/nonexistent-story-id/viewers")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Get viewers of non-existent story correctly returns 404")
    
    def test_get_story_viewers_without_auth(self):
        """Test getting story viewers without authentication - should fail"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/stories/some-story-id/viewers")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Get story viewers without auth correctly rejected")
    
    # ============== DELETE STORY TESTS ==============
    
    def test_delete_own_story(self):
        """Test deleting own story"""
        assert self.auth_token, "Authentication required"
        
        # Create a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Delete test story"
        }
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        story_id = created_story["id"]
        
        # Delete the story
        response = self.session.delete(f"{BASE_URL}/api/stories/{story_id}")
        
        assert response.status_code == 200, f"Delete story failed: {response.text}"
        data = response.json()
        assert data["message"] == "Story deleted"
        
        # Verify story is deleted - should not appear in my stories
        my_stories_response = self.session.get(f"{BASE_URL}/api/stories/my")
        assert my_stories_response.status_code == 200
        my_stories = my_stories_response.json()
        
        story_ids = [s["id"] for s in my_stories]
        assert story_id not in story_ids, "Deleted story still appears in my stories"
        
        print(f"✅ Story deleted successfully: {story_id}")
    
    def test_delete_nonexistent_story(self):
        """Test deleting a non-existent story - should return 404"""
        assert self.auth_token, "Authentication required"
        
        response = self.session.delete(f"{BASE_URL}/api/stories/nonexistent-story-id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Delete non-existent story correctly returns 404")
    
    def test_delete_story_without_auth(self):
        """Test deleting a story without authentication - should fail"""
        session = requests.Session()
        
        response = session.delete(f"{BASE_URL}/api/stories/some-story-id")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Delete story without auth correctly rejected")
    
    # ============== GET USER STORIES TESTS ==============
    
    def test_get_user_stories(self):
        """Test getting stories from a specific user"""
        assert self.auth_token, "Authentication required"
        
        # Create a story first
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}User stories test"
        }
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        self.created_story_ids.append(created_story["id"])
        
        # Get user stories
        response = self.session.get(f"{BASE_URL}/api/stories/user/{self.user_id}")
        
        assert response.status_code == 200, f"Get user stories failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # Find our created story
        story_found = False
        for story in data:
            assert "id" in story
            assert "story_type" in story
            assert "is_viewed" in story
            assert "is_expired" in story
            
            if story["id"] == created_story["id"]:
                story_found = True
        
        assert story_found, "Created story not found in user stories"
        print(f"✅ User stories retrieved: {len(data)} stories")
    
    def test_get_user_stories_without_auth(self):
        """Test getting user stories without authentication - should fail"""
        session = requests.Session()
        
        response = session.get(f"{BASE_URL}/api/stories/user/some-user-id")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ Get user stories without auth correctly rejected")
    
    # ============== FULL FLOW TESTS ==============
    
    def test_full_story_lifecycle(self):
        """Test complete story lifecycle: create -> view -> get viewers -> delete"""
        assert self.auth_token, "Authentication required"
        
        # 1. Create story
        story_data = {
            "story_type": "mood",
            "mood": "Mutlu",
            "text": f"{TEST_PREFIX}Full lifecycle test",
            "emoji": "😊",
            "background_color": "#00FF00"
        }
        
        create_response = self.session.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        assert create_response.status_code == 200
        created_story = create_response.json()
        story_id = created_story["id"]
        print(f"  1. Story created: {story_id}")
        
        # 2. Verify in my stories
        my_stories_response = self.session.get(f"{BASE_URL}/api/stories/my")
        assert my_stories_response.status_code == 200
        my_stories = my_stories_response.json()
        story_ids = [s["id"] for s in my_stories]
        assert story_id in story_ids
        print("  2. Story appears in my stories")
        
        # 3. Verify in feed
        feed_response = self.session.get(f"{BASE_URL}/api/stories/feed")
        assert feed_response.status_code == 200
        feed = feed_response.json()
        
        story_in_feed = False
        for user_group in feed:
            for story in user_group.get("stories", []):
                if story["id"] == story_id:
                    story_in_feed = True
                    break
        assert story_in_feed
        print("  3. Story appears in feed")
        
        # 4. View own story (should not count)
        view_response = self.session.post(f"{BASE_URL}/api/stories/{story_id}/view")
        assert view_response.status_code == 200
        print("  4. Own story view handled")
        
        # 5. Get viewers (should be empty)
        viewers_response = self.session.get(f"{BASE_URL}/api/stories/{story_id}/viewers")
        assert viewers_response.status_code == 200
        viewers = viewers_response.json()
        assert len(viewers) == 0
        print("  5. Viewers list is empty (own view not counted)")
        
        # 6. Delete story
        delete_response = self.session.delete(f"{BASE_URL}/api/stories/{story_id}")
        assert delete_response.status_code == 200
        print("  6. Story deleted")
        
        # 7. Verify deletion
        my_stories_response = self.session.get(f"{BASE_URL}/api/stories/my")
        assert my_stories_response.status_code == 200
        my_stories = my_stories_response.json()
        story_ids = [s["id"] for s in my_stories]
        assert story_id not in story_ids
        print("  7. Story no longer in my stories")
        
        print("✅ Full story lifecycle test passed")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
