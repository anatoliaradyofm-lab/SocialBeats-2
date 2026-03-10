"""
Test Iteration 21: Push Notifications & Highlights API Testing
With proper rate limiting delays
"""

import pytest
import requests
import os
import time
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "test123"

# Rate limit delay
DELAY = 1.0


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token once for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["access_token"], data["user"]["id"]


class TestAuthAPI:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        time.sleep(DELAY)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✅ Login successful - User: {data['user']['username']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        time.sleep(DELAY)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials rejected correctly")
    
    def test_get_me_authenticated(self, auth_token):
        """Test GET /api/auth/me with valid token"""
        time.sleep(DELAY)
        token, _ = auth_token
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print(f"✅ GET /api/auth/me - User: {data['username']}")


class TestPushNotificationAPI:
    """Push Notification token registration tests"""
    
    def test_register_push_token(self, auth_token):
        """Test POST /api/notifications/register-token"""
        time.sleep(DELAY)
        token, _ = auth_token
        test_expo_token = f"ExponentPushToken[TEST_{uuid.uuid4().hex[:8]}]"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "expo_token": test_expo_token,
                "platform": "android",
                "device_name": "Test Device"
            }
        )
        assert response.status_code == 200, f"Register token failed: {response.text}"
        data = response.json()
        assert data.get("status") == "success" or "message" in data
        print(f"✅ Push token registered: {test_expo_token[:30]}...")
    
    def test_register_push_token_with_expo_push_token_field(self, auth_token):
        """Test register with expo_push_token field"""
        time.sleep(DELAY)
        token, _ = auth_token
        alt_token = f"ExponentPushToken[ALT_{uuid.uuid4().hex[:8]}]"
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "expo_push_token": alt_token,
                "platform": "ios",
                "device_name": "iPhone Test"
            }
        )
        assert response.status_code == 200, f"Register token failed: {response.text}"
        print("✅ Push token registered with expo_push_token field")
    
    def test_register_push_token_missing_token(self, auth_token):
        """Test register without token - should fail"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "platform": "android",
                "device_name": "Test Device"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Missing token rejected correctly")
    
    def test_unregister_push_token(self, auth_token):
        """Test DELETE /api/notifications/unregister-token"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        # First register a token
        register_token = f"ExponentPushToken[UNREG_{uuid.uuid4().hex[:8]}]"
        requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            headers={"Authorization": f"Bearer {token}"},
            json={"expo_token": register_token, "platform": "android"}
        )
        time.sleep(DELAY)
        
        # Now unregister
        response = requests.delete(
            f"{BASE_URL}/api/notifications/unregister-token",
            headers={"Authorization": f"Bearer {token}"},
            json={"expo_token": register_token}
        )
        assert response.status_code == 200, f"Unregister token failed: {response.text}"
        print(f"✅ Push token unregistered successfully")
    
    def test_unregister_all_tokens(self, auth_token):
        """Test unregister without specific token"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.delete(
            f"{BASE_URL}/api/notifications/unregister-token",
            headers={"Authorization": f"Bearer {token}"},
            json={}
        )
        assert response.status_code == 200, f"Unregister all failed: {response.text}"
        print("✅ All push tokens deactivated")


class TestHighlightsAPI:
    """Story Highlights API tests"""
    
    def test_get_highlights(self, auth_token):
        """Test GET /api/highlights"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/highlights",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/highlights - Found {len(data)} highlights")
    
    def test_create_and_delete_highlight(self, auth_token):
        """Test POST and DELETE /api/highlights"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        # Create highlight
        highlight_name = f"TEST_Highlight_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/highlights",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": highlight_name,
                "cover_url": "https://example.com/cover.jpg",
                "story_ids": []
            }
        )
        assert response.status_code == 200, f"Create highlight failed: {response.text}"
        data = response.json()
        assert "id" in data
        highlight_id = data["id"]
        print(f"✅ Created highlight: {highlight_name}")
        
        time.sleep(DELAY)
        
        # Delete highlight
        response = requests.delete(
            f"{BASE_URL}/api/highlights/{highlight_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Delete highlight failed: {response.text}"
        print(f"✅ Deleted highlight: {highlight_id}")
    
    def test_get_profile_highlights(self, auth_token):
        """Test GET /api/user/{user_id}/highlights"""
        time.sleep(DELAY)
        token, user_id = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/{user_id}/highlights",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get profile highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/user/{user_id}/highlights - Found {len(data)} highlights")
    
    def test_update_highlight(self, auth_token):
        """Test PUT /api/highlights/{id}"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        # Create highlight first
        create_response = requests.post(
            f"{BASE_URL}/api/highlights",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": f"TEST_ToUpdate_{uuid.uuid4().hex[:6]}"}
        )
        highlight_id = create_response.json()["id"]
        time.sleep(DELAY)
        
        # Update it
        new_name = f"TEST_Updated_{uuid.uuid4().hex[:6]}"
        response = requests.put(
            f"{BASE_URL}/api/highlights/{highlight_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": new_name,
                "cover_url": "https://example.com/new-cover.jpg"
            }
        )
        assert response.status_code == 200, f"Update highlight failed: {response.text}"
        print(f"✅ Updated highlight to: {new_name}")
        
        # Cleanup
        time.sleep(DELAY)
        requests.delete(
            f"{BASE_URL}/api/highlights/{highlight_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
    
    def test_delete_nonexistent_highlight(self, auth_token):
        """Test delete non-existent highlight"""
        time.sleep(DELAY)
        token, _ = auth_token
        fake_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/highlights/{fake_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Delete non-existent highlight returns 404")


class TestStoryAPI:
    """Story API tests"""
    
    def test_get_story_feed(self, auth_token):
        """Test GET /api/stories/feed"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/stories/feed",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get story feed failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/stories/feed - Found {len(data)} story groups")
    
    def test_create_and_delete_story(self, auth_token):
        """Test POST and DELETE /api/stories"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        # Create story
        response = requests.post(
            f"{BASE_URL}/api/stories",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "story_type": "text",
                "text": f"TEST Story {uuid.uuid4().hex[:6]}",
                "background_color": "#8B5CF6"
            }
        )
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        assert "id" in data
        story_id = data["id"]
        print(f"✅ Created story: {story_id}")
        
        time.sleep(DELAY)
        
        # Delete story
        response = requests.delete(
            f"{BASE_URL}/api/stories/{story_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Delete story failed: {response.text}"
        print(f"✅ Deleted story: {story_id}")
    
    def test_get_my_stories(self, auth_token):
        """Test GET /api/stories/my"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/stories/my",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get my stories failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/stories/my - Found {len(data)} stories")


class TestSocialFeedAPI:
    """Social Feed API tests"""
    
    def test_get_social_feed(self, auth_token):
        """Test GET /api/social/feed"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/social/feed",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get social feed failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/feed - Found {len(data)} posts")


class TestThemeAPI:
    """Theme API tests"""
    
    def test_get_themes(self, auth_token):
        """Test GET /api/themes"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/themes",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get themes failed: {response.text}"
        print(f"✅ GET /api/themes - Themes retrieved")
    
    def test_get_app_themes(self, auth_token):
        """Test GET /api/themes/app"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/themes/app",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get app themes failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/themes/app - Found {len(data)} app themes")


class TestRegressionEndpoints:
    """Regression tests for previously working endpoints"""
    
    def test_library_favorites(self, auth_token):
        """Test GET /api/library/favorites"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/library/favorites",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get favorites failed: {response.text}"
        print("✅ GET /api/library/favorites working")
    
    def test_playlists(self, auth_token):
        """Test GET /api/playlists"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/playlists",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get playlists failed: {response.text}"
        print("✅ GET /api/playlists working")
    
    def test_music_search(self, auth_token):
        """Test GET /api/music/search/{query}"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/music/search/tarkan",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Music search failed: {response.text}"
        print("✅ GET /api/music/search working")
    
    def test_followers(self, auth_token):
        """Test GET /api/social/followers/{id}"""
        time.sleep(DELAY)
        token, user_id = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/social/followers/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get followers failed: {response.text}"
        print("✅ GET /api/social/followers working")
    
    def test_following(self, auth_token):
        """Test GET /api/social/following/{id}"""
        time.sleep(DELAY)
        token, user_id = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/social/following/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get following failed: {response.text}"
        print("✅ GET /api/social/following working")
    
    def test_notifications(self, auth_token):
        """Test GET /api/notifications"""
        time.sleep(DELAY)
        token, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        print("✅ GET /api/notifications working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
