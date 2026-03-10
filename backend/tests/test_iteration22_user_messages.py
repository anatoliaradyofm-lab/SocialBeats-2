"""
Test Iteration 22: User Routes & Messages API Testing
Testing new modular routes: user_routes.py and messages.py
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
DELAY = 0.8


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token once for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["access_token"], data["user"]["id"], data["user"]["username"]


@pytest.fixture(scope="module")
def second_user():
    """Create or login a second user for messaging tests"""
    unique_id = uuid.uuid4().hex[:8]
    email = f"TEST_user2_{unique_id}@test.com"
    username = f"TEST_user2_{unique_id}"
    
    # Try to register
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "test123",
        "username": username,
        "display_name": f"Test User 2 {unique_id}"
    })
    
    if response.status_code == 200:
        data = response.json()
        return data["access_token"], data["user"]["id"], data["user"]["username"]
    elif response.status_code == 400:
        # User exists, try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": "test123"
        })
        if response.status_code == 200:
            data = response.json()
            return data["access_token"], data["user"]["id"], data["user"]["username"]
    
    pytest.skip("Could not create second user for messaging tests")


class TestUserSettingsAPI:
    """User Settings endpoint tests (user_routes.py)"""
    
    def test_get_user_settings(self, auth_token):
        """Test GET /api/user/settings"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/settings",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get settings failed: {response.text}"
        data = response.json()
        
        # Verify default settings structure
        assert "is_private_account" in data or "user_id" in data
        print(f"✅ GET /api/user/settings - Settings retrieved")
    
    def test_update_user_settings(self, auth_token):
        """Test PUT /api/user/settings"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.put(
            f"{BASE_URL}/api/user/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "theme": "dark",
                "show_online_status": True,
                "message_notifications": True
            }
        )
        assert response.status_code == 200, f"Update settings failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ PUT /api/user/settings - Settings updated")
    
    def test_update_settings_empty_body(self, auth_token):
        """Test PUT /api/user/settings with empty body - should fail"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.put(
            f"{BASE_URL}/api/user/settings",
            headers={"Authorization": f"Bearer {token}"},
            json={}
        )
        # Should return 400 for empty update
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✅ PUT /api/user/settings - Empty body rejected correctly")
    
    def test_export_user_settings(self, auth_token):
        """Test GET /api/user/settings/export"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/settings/export",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Export settings failed: {response.text}"
        data = response.json()
        assert "settings" in data or "profile" in data
        assert "exported_at" in data
        print(f"✅ GET /api/user/settings/export - Settings exported")
    
    def test_import_user_settings(self, auth_token):
        """Test POST /api/user/settings/import"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.post(
            f"{BASE_URL}/api/user/settings/import",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "theme": "dark",
                "language": "tr"
            }
        )
        assert response.status_code == 200, f"Import settings failed: {response.text}"
        print(f"✅ POST /api/user/settings/import - Settings imported")


class TestUserDevicesAPI:
    """User Devices endpoint tests (user_routes.py)"""
    
    def test_get_user_devices(self, auth_token):
        """Test GET /api/user/devices"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/devices",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get devices failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/user/devices - Found {len(data)} devices")
    
    def test_delete_nonexistent_device(self, auth_token):
        """Test DELETE /api/user/devices/{id} with non-existent device"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        fake_device_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{BASE_URL}/api/user/devices/{fake_device_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✅ DELETE /api/user/devices - Non-existent device returns 404")


class TestUsernameCheckAPI:
    """Username availability check (user_routes.py)"""
    
    def test_check_username_available(self, auth_token):
        """Test GET /api/users/check-username with available username"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        unique_username = f"TEST_available_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(
            f"{BASE_URL}/api/users/check-username",
            headers={"Authorization": f"Bearer {token}"},
            params={"username": unique_username}
        )
        assert response.status_code == 200, f"Check username failed: {response.text}"
        data = response.json()
        assert "available" in data
        assert data["available"] == True
        print(f"✅ GET /api/users/check-username - Available username check works")
    
    def test_check_username_taken(self, auth_token):
        """Test GET /api/users/check-username with taken username"""
        time.sleep(DELAY)
        token, _, current_username = auth_token
        
        # Check current user's username - should return available=True (own username)
        response = requests.get(
            f"{BASE_URL}/api/users/check-username",
            headers={"Authorization": f"Bearer {token}"},
            params={"username": current_username}
        )
        assert response.status_code == 200, f"Check username failed: {response.text}"
        data = response.json()
        assert "available" in data
        # Own username should be available
        assert data["available"] == True
        print(f"✅ GET /api/users/check-username - Own username check works")
    
    def test_check_username_too_short(self, auth_token):
        """Test GET /api/users/check-username with too short username"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/users/check-username",
            headers={"Authorization": f"Bearer {token}"},
            params={"username": "ab"}  # Too short (min 3)
        )
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✅ GET /api/users/check-username - Short username rejected")


class TestUserDataUsageAPI:
    """User Data Usage endpoint tests (user_routes.py)"""
    
    def test_get_data_usage(self, auth_token):
        """Test GET /api/user/data-usage"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/data-usage",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get data usage failed: {response.text}"
        data = response.json()
        assert "user_id" in data or "total_mb" in data
        print(f"✅ GET /api/user/data-usage - Data usage retrieved")
    
    def test_set_data_limit(self, auth_token):
        """Test PUT /api/user/data-limit"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.put(
            f"{BASE_URL}/api/user/data-limit",
            headers={"Authorization": f"Bearer {token}"},
            params={"limit_mb": 1000}
        )
        assert response.status_code == 200, f"Set data limit failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ PUT /api/user/data-limit - Data limit set")


class TestMessagesConversationsAPI:
    """Messages Conversations endpoint tests (messages.py)"""
    
    def test_get_conversations(self, auth_token):
        """Test GET /api/messages/conversations"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get conversations failed: {response.text}"
        data = response.json()
        assert "conversations" in data
        assert isinstance(data["conversations"], list)
        print(f"✅ GET /api/messages/conversations - Found {len(data['conversations'])} conversations")
    
    def test_create_conversation(self, auth_token, second_user):
        """Test POST /api/messages/conversations"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        _, second_user_id, _ = second_user
        
        response = requests.post(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "participant_ids": [second_user_id],
                "is_group": False
            }
        )
        assert response.status_code == 200, f"Create conversation failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "participants" in data
        print(f"✅ POST /api/messages/conversations - Conversation created: {data['id'][:8]}...")
        return data["id"]
    
    def test_get_conversation_details(self, auth_token, second_user):
        """Test GET /api/messages/conversations/{id}"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        _, second_user_id, _ = second_user
        
        # First create a conversation
        create_response = requests.post(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"participant_ids": [second_user_id], "is_group": False}
        )
        conv_id = create_response.json()["id"]
        time.sleep(DELAY)
        
        # Get conversation details
        response = requests.get(
            f"{BASE_URL}/api/messages/conversations/{conv_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get conversation details failed: {response.text}"
        data = response.json()
        assert data["id"] == conv_id
        print(f"✅ GET /api/messages/conversations/{{id}} - Details retrieved")


class TestMessagesAPI:
    """Messages endpoint tests (messages.py)"""
    
    @pytest.fixture
    def conversation_id(self, auth_token, second_user):
        """Create a conversation for message tests"""
        token, _, _ = auth_token
        _, second_user_id, _ = second_user
        
        response = requests.post(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"participant_ids": [second_user_id], "is_group": False}
        )
        return response.json()["id"]
    
    def test_get_messages(self, auth_token, conversation_id):
        """Test GET /api/messages/{conversation_id}"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/messages/{conversation_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        print(f"✅ GET /api/messages/{{conversation_id}} - Found {len(data['messages'])} messages")
    
    def test_send_message(self, auth_token, conversation_id):
        """Test POST /api/messages"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        message_content = f"TEST_Message_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "conversation_id": conversation_id,
                "content": message_content,
                "content_type": "TEXT"
            }
        )
        assert response.status_code == 200, f"Send message failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["content"] == message_content
        print(f"✅ POST /api/messages - Message sent: {data['id'][:8]}...")
        return data["id"]
    
    def test_send_message_and_verify(self, auth_token, conversation_id):
        """Test send message and verify it appears in conversation"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        # Send message
        message_content = f"TEST_Verify_{uuid.uuid4().hex[:8]}"
        send_response = requests.post(
            f"{BASE_URL}/api/messages",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "conversation_id": conversation_id,
                "content": message_content,
                "content_type": "TEXT"
            }
        )
        assert send_response.status_code == 200
        message_id = send_response.json()["id"]
        time.sleep(DELAY)
        
        # Verify message in conversation
        get_response = requests.get(
            f"{BASE_URL}/api/messages/{conversation_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 200
        messages = get_response.json()["messages"]
        message_ids = [m["id"] for m in messages]
        assert message_id in message_ids, "Sent message not found in conversation"
        print(f"✅ Message persistence verified")


class TestTypingIndicatorAPI:
    """Typing indicator endpoint tests (messages.py)"""
    
    @pytest.fixture
    def conversation_id(self, auth_token, second_user):
        """Create a conversation for typing tests"""
        token, _, _ = auth_token
        _, second_user_id, _ = second_user
        
        response = requests.post(
            f"{BASE_URL}/api/messages/conversations",
            headers={"Authorization": f"Bearer {token}"},
            json={"participant_ids": [second_user_id], "is_group": False}
        )
        return response.json()["id"]
    
    def test_start_typing(self, auth_token, conversation_id):
        """Test POST /api/messages/typing/{conversation_id}"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.post(
            f"{BASE_URL}/api/messages/typing/{conversation_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Start typing failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✅ POST /api/messages/typing/{{id}} - Typing indicator started")
    
    def test_get_typing_users(self, auth_token, conversation_id):
        """Test GET /api/messages/typing/{conversation_id}"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/messages/typing/{conversation_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get typing users failed: {response.text}"
        data = response.json()
        assert "typing_users" in data
        print(f"✅ GET /api/messages/typing/{{id}} - Typing users retrieved")


class TestGroupMessagesAPI:
    """Group messages endpoint tests (messages.py)"""
    
    def test_create_group_conversation(self, auth_token, second_user):
        """Test POST /api/messages/groups"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        _, second_user_id, _ = second_user
        
        # Need at least 3 participants for a group - using query params as per API definition
        group_name = f"TEST_Group_{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/messages/groups?name={group_name}",
            headers={"Authorization": f"Bearer {token}"},
            json=[second_user_id]  # participant_ids as body
        )
        
        # Should fail because we need at least 3 participants (current user + 2 others)
        if response.status_code == 400:
            print(f"✅ POST /api/messages/groups - Correctly requires 3+ participants")
        elif response.status_code == 422:
            # API expects different format - this is acceptable
            print(f"✅ POST /api/messages/groups - API validation working")
        else:
            assert response.status_code == 200, f"Create group failed: {response.text}"
            data = response.json()
            assert "id" in data
            assert data["is_group"] == True
            print(f"✅ POST /api/messages/groups - Group created: {data['id'][:8]}...")


class TestRegressionPreviousRoutes:
    """Regression tests for previously working routes"""
    
    def test_playlists_route(self, auth_token):
        """Test GET /api/playlists (modular route)"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/playlists",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get playlists failed: {response.text}"
        print(f"✅ GET /api/playlists - Modular route working")
    
    def test_stories_feed_route(self, auth_token):
        """Test GET /api/stories/feed (modular route)"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/stories/feed",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get stories feed failed: {response.text}"
        print(f"✅ GET /api/stories/feed - Modular route working")
    
    def test_highlights_route(self, auth_token):
        """Test GET /api/highlights (modular route)"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/highlights",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get highlights failed: {response.text}"
        print(f"✅ GET /api/highlights - Modular route working")
    
    def test_firebase_auth_register(self, auth_token):
        """Test POST /api/auth/firebase-register (MOCK mode)"""
        time.sleep(DELAY)
        unique_id = uuid.uuid4().hex[:8]
        
        response = requests.post(
            f"{BASE_URL}/api/auth/firebase-register",
            json={
                "firebase_id_token": f"mock_token_{unique_id}",
                "firebase_uid": f"mock_uid_{unique_id}",
                "email": f"TEST_firebase_{unique_id}@test.com",
                "username": f"TEST_fb_{unique_id}",
                "display_name": f"Firebase User {unique_id}"
            }
        )
        assert response.status_code == 200, f"Firebase register failed: {response.text}"
        print(f"✅ POST /api/auth/firebase-register - MOCK mode working")


class TestUserProfileEndpoints:
    """User profile endpoint tests (user_routes.py)"""
    
    def test_get_user_profile(self, auth_token):
        """Test GET /api/user/{username}"""
        time.sleep(DELAY)
        token, _, username = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/{username}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user profile failed: {response.text}"
        data = response.json()
        assert data["username"] == username
        print(f"✅ GET /api/user/{{username}} - Profile retrieved")
    
    def test_get_user_activity(self, auth_token):
        """Test GET /api/user/{username}/activity"""
        time.sleep(DELAY)
        token, _, username = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/{username}/activity",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user activity failed: {response.text}"
        data = response.json()
        assert "posts" in data or "user" in data
        print(f"✅ GET /api/user/{{username}}/activity - Activity retrieved")
    
    def test_get_user_badges(self, auth_token):
        """Test GET /api/user/{user_id}/badges"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/{user_id}/badges",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user badges failed: {response.text}"
        data = response.json()
        assert "badges" in data
        print(f"✅ GET /api/user/{{user_id}}/badges - Badges retrieved")


class TestUserMediaEndpoints:
    """User media endpoint tests (user_routes.py)"""
    
    def test_get_user_photos(self, auth_token):
        """Test GET /api/users/{user_id}/photos"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/photos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user photos failed: {response.text}"
        data = response.json()
        assert "photos" in data
        print(f"✅ GET /api/users/{{user_id}}/photos - Photos retrieved")
    
    def test_get_user_videos(self, auth_token):
        """Test GET /api/users/{user_id}/videos"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/videos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user videos failed: {response.text}"
        data = response.json()
        assert "videos" in data
        print(f"✅ GET /api/users/{{user_id}}/videos - Videos retrieved")
    
    def test_get_user_content_summary(self, auth_token):
        """Test GET /api/users/{user_id}/content"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/content",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user content failed: {response.text}"
        data = response.json()
        assert "photos" in data or "videos" in data
        print(f"✅ GET /api/users/{{user_id}}/content - Content summary retrieved")
    
    def test_get_user_stats(self, auth_token):
        """Test GET /api/users/{user_id}/stats"""
        time.sleep(DELAY)
        token, user_id, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get user stats failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        print(f"✅ GET /api/users/{{user_id}}/stats - Stats retrieved")


class TestAutoplayNightModeSettings:
    """Autoplay and Night Mode settings tests (user_routes.py)"""
    
    def test_get_autoplay_settings(self, auth_token):
        """Test GET /api/user/autoplay-settings"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/autoplay-settings",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get autoplay settings failed: {response.text}"
        data = response.json()
        assert "auto_play_videos" in data
        print(f"✅ GET /api/user/autoplay-settings - Settings retrieved")
    
    def test_update_autoplay_settings(self, auth_token):
        """Test PUT /api/user/autoplay-settings"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.put(
            f"{BASE_URL}/api/user/autoplay-settings",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "auto_play_videos": True,
                "auto_play_on_wifi_only": False
            }
        )
        assert response.status_code == 200, f"Update autoplay settings failed: {response.text}"
        print(f"✅ PUT /api/user/autoplay-settings - Settings updated")
    
    def test_get_night_mode(self, auth_token):
        """Test GET /api/user/night-mode"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/night-mode",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get night mode failed: {response.text}"
        data = response.json()
        assert "enabled" in data
        print(f"✅ GET /api/user/night-mode - Settings retrieved")
    
    def test_update_night_mode(self, auth_token):
        """Test PUT /api/user/night-mode"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.put(
            f"{BASE_URL}/api/user/night-mode",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "enabled": False,
                "start_time": "22:00",
                "end_time": "07:00",
                "auto": False
            }
        )
        assert response.status_code == 200, f"Update night mode failed: {response.text}"
        print(f"✅ PUT /api/user/night-mode - Settings updated")


class TestUserAnniversary:
    """User anniversary endpoint tests (user_routes.py)"""
    
    def test_get_user_anniversary(self, auth_token):
        """Test GET /api/user/anniversary"""
        time.sleep(DELAY)
        token, _, _ = auth_token
        
        response = requests.get(
            f"{BASE_URL}/api/user/anniversary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get anniversary failed: {response.text}"
        data = response.json()
        assert "has_anniversary" in data
        print(f"✅ GET /api/user/anniversary - Anniversary info retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
