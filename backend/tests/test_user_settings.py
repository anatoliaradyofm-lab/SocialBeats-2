"""
Test file for SocialBeats User Settings API endpoints:
- GET /api/user/settings - Get user settings
- PUT /api/user/settings - Update user settings
- POST /api/auth/change-password - Change password
- POST /api/auth/change-email - Change email
- POST /api/auth/toggle-2fa - Toggle 2FA
- GET /api/auth/sessions - Get active sessions (MOCKED)
- POST /api/auth/sessions/logout-all - Logout all sessions
- POST /api/account/freeze - Freeze account
- POST /api/account/unfreeze - Unfreeze account
- DELETE /api/account/delete - Delete account
- GET /api/social/blocked-users - Get blocked users
- POST /api/social/block/{user_id} - Block user
- DELETE /api/social/unblock/{user_id} - Unblock user
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-music-fix.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials from review request
TEST_USER = {"email": "testuser2@test.com", "password": "password123"}


def get_auth_token(email, password):
    """Helper to get auth token"""
    response = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=10)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    return None


def create_test_user(prefix="settings"):
    """Create a new test user and return token and user info"""
    timestamp = datetime.now().strftime("%H%M%S%f")
    register_data = {
        "email": f"{prefix}_{timestamp}@test.com",
        "username": f"{prefix}_{timestamp}",
        "password": "Test123!",
        "display_name": f"Test User {timestamp}"
    }
    response = requests.post(f"{API}/auth/register", json=register_data, timeout=10)
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data.get("access_token") or data.get("token"),
            "id": data.get("user", {}).get("id"),
            "email": register_data["email"],
            "password": register_data["password"],
            "username": register_data["username"]
        }
    return None


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{API}/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ API Health: {data}")


class TestUserSettings:
    """User settings CRUD tests"""
    
    @pytest.fixture
    def auth_user(self):
        """Create authenticated user for settings tests"""
        user = create_test_user("settings")
        if not user:
            pytest.skip("Could not create test user")
        return user
    
    def test_get_user_settings_default(self, auth_user):
        """Test GET /api/user/settings - returns default settings for new user"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        response = requests.get(f"{API}/user/settings", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify default settings structure
        assert "is_private_account" in data
        assert "show_online_status" in data
        assert "who_can_message" in data
        assert "theme" in data
        assert "language" in data
        
        # Verify default values
        assert data["is_private_account"] == False
        assert data["show_online_status"] == True
        assert data["who_can_message"] == "everyone"
        assert data["theme"] == "dark"
        assert data["language"] == "tr"
        
        print(f"✅ GET /api/user/settings - Default settings returned correctly")
        print(f"   Settings: theme={data['theme']}, language={data['language']}")
    
    def test_update_user_settings_privacy(self, auth_user):
        """Test PUT /api/user/settings - update privacy settings"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        update_data = {
            "is_private_account": True,
            "show_online_status": False,
            "who_can_message": "followers"
        }
        
        response = requests.put(f"{API}/user/settings", json=update_data, headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Ayarlar güncellendi"
        
        # Verify settings were persisted
        get_response = requests.get(f"{API}/user/settings", headers=headers, timeout=10)
        assert get_response.status_code == 200
        settings = get_response.json()
        
        assert settings["is_private_account"] == True
        assert settings["show_online_status"] == False
        assert settings["who_can_message"] == "followers"
        
        print(f"✅ PUT /api/user/settings - Privacy settings updated and persisted")
    
    def test_update_user_settings_notifications(self, auth_user):
        """Test PUT /api/user/settings - update notification settings"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        update_data = {
            "message_notifications": False,
            "like_notifications": False,
            "comment_notifications": True,
            "quiet_hours_enabled": True,
            "quiet_hours_start": "23:00",
            "quiet_hours_end": "07:00"
        }
        
        response = requests.put(f"{API}/user/settings", json=update_data, headers=headers, timeout=10)
        
        assert response.status_code == 200
        
        # Verify persistence
        get_response = requests.get(f"{API}/user/settings", headers=headers, timeout=10)
        settings = get_response.json()
        
        assert settings["message_notifications"] == False
        assert settings["like_notifications"] == False
        assert settings["quiet_hours_enabled"] == True
        
        print(f"✅ PUT /api/user/settings - Notification settings updated")
    
    def test_update_user_settings_app_preferences(self, auth_user):
        """Test PUT /api/user/settings - update app preferences"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        update_data = {
            "theme": "light",
            "font_size": "large",
            "language": "en",
            "auto_play_videos": False,
            "data_saver_mode": True,
            "media_quality": "low"
        }
        
        response = requests.put(f"{API}/user/settings", json=update_data, headers=headers, timeout=10)
        
        assert response.status_code == 200
        
        # Verify persistence
        get_response = requests.get(f"{API}/user/settings", headers=headers, timeout=10)
        settings = get_response.json()
        
        assert settings["theme"] == "light"
        assert settings["font_size"] == "large"
        assert settings["language"] == "en"
        assert settings["data_saver_mode"] == True
        
        print(f"✅ PUT /api/user/settings - App preferences updated")
    
    def test_update_user_settings_empty_body(self, auth_user):
        """Test PUT /api/user/settings - empty body should return error"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        response = requests.put(f"{API}/user/settings", json={}, headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        
        print(f"✅ PUT /api/user/settings - Empty body returns 400 error")


class TestChangePassword:
    """Password change tests"""
    
    @pytest.fixture
    def auth_user(self):
        """Create authenticated user for password tests"""
        user = create_test_user("pwd")
        if not user:
            pytest.skip("Could not create test user")
        return user
    
    def test_change_password_success(self, auth_user):
        """Test POST /api/auth/change-password - successful password change"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        change_data = {
            "current_password": auth_user["password"],
            "new_password": "NewPassword123!"
        }
        
        response = requests.post(f"{API}/auth/change-password", json=change_data, headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Şifre başarıyla değiştirildi"
        
        # Verify can login with new password
        login_response = requests.post(f"{API}/auth/login", json={
            "email": auth_user["email"],
            "password": "NewPassword123!"
        }, timeout=10)
        
        assert login_response.status_code == 200
        print(f"✅ POST /api/auth/change-password - Password changed successfully")
    
    def test_change_password_wrong_current(self, auth_user):
        """Test POST /api/auth/change-password - wrong current password"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        change_data = {
            "current_password": "WrongPassword123!",
            "new_password": "NewPassword123!"
        }
        
        response = requests.post(f"{API}/auth/change-password", json=change_data, headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "yanlış" in data["detail"].lower() or "wrong" in data["detail"].lower()
        
        print(f"✅ POST /api/auth/change-password - Wrong current password returns 400")
    
    def test_change_password_too_short(self, auth_user):
        """Test POST /api/auth/change-password - new password too short"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        change_data = {
            "current_password": auth_user["password"],
            "new_password": "12345"  # Less than 6 characters
        }
        
        response = requests.post(f"{API}/auth/change-password", json=change_data, headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        
        print(f"✅ POST /api/auth/change-password - Short password returns 400")


class TestChangeEmail:
    """Email change tests"""
    
    @pytest.fixture
    def auth_user(self):
        """Create authenticated user for email tests"""
        user = create_test_user("email")
        if not user:
            pytest.skip("Could not create test user")
        return user
    
    def test_change_email_success(self, auth_user):
        """Test POST /api/auth/change-email - successful email change"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        timestamp = datetime.now().strftime("%H%M%S%f")
        new_email = f"newemail_{timestamp}@test.com"
        
        change_data = {
            "new_email": new_email,
            "password": auth_user["password"]
        }
        
        response = requests.post(f"{API}/auth/change-email", json=change_data, headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "E-posta adresi güncellendi"
        
        # Verify can login with new email
        login_response = requests.post(f"{API}/auth/login", json={
            "email": new_email,
            "password": auth_user["password"]
        }, timeout=10)
        
        assert login_response.status_code == 200
        print(f"✅ POST /api/auth/change-email - Email changed successfully")
    
    def test_change_email_wrong_password(self, auth_user):
        """Test POST /api/auth/change-email - wrong password"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        change_data = {
            "new_email": "newemail@test.com",
            "password": "WrongPassword123!"
        }
        
        response = requests.post(f"{API}/auth/change-email", json=change_data, headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        
        print(f"✅ POST /api/auth/change-email - Wrong password returns 400")
    
    def test_change_email_already_exists(self, auth_user):
        """Test POST /api/auth/change-email - email already in use"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        # Create another user
        other_user = create_test_user("other")
        if not other_user:
            pytest.skip("Could not create second test user")
        
        change_data = {
            "new_email": other_user["email"],  # Try to use existing email
            "password": auth_user["password"]
        }
        
        response = requests.post(f"{API}/auth/change-email", json=change_data, headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "kullanımda" in data["detail"].lower() or "exists" in data["detail"].lower()
        
        print(f"✅ POST /api/auth/change-email - Duplicate email returns 400")


class TestTwoFactorAuth:
    """2FA toggle tests"""
    
    @pytest.fixture
    def auth_user(self):
        """Create authenticated user for 2FA tests"""
        user = create_test_user("twofa")
        if not user:
            pytest.skip("Could not create test user")
        return user
    
    def test_enable_2fa(self, auth_user):
        """Test POST /api/auth/toggle-2fa - enable 2FA"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        response = requests.post(f"{API}/auth/toggle-2fa?enabled=true", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "two_factor_enabled" in data
        assert data["two_factor_enabled"] == True
        
        print(f"✅ POST /api/auth/toggle-2fa - 2FA enabled successfully")
    
    def test_disable_2fa(self, auth_user):
        """Test POST /api/auth/toggle-2fa - disable 2FA"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        # First enable
        requests.post(f"{API}/auth/toggle-2fa?enabled=true", headers=headers, timeout=10)
        
        # Then disable
        response = requests.post(f"{API}/auth/toggle-2fa?enabled=false", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert data["two_factor_enabled"] == False
        
        print(f"✅ POST /api/auth/toggle-2fa - 2FA disabled successfully")


class TestSessions:
    """Session management tests (MOCKED endpoint)"""
    
    @pytest.fixture
    def auth_user(self):
        """Create authenticated user for session tests"""
        user = create_test_user("session")
        if not user:
            pytest.skip("Could not create test user")
        return user
    
    def test_get_active_sessions(self, auth_user):
        """Test GET /api/auth/sessions - returns mock session data"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        response = requests.get(f"{API}/auth/sessions", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify session structure
        session = data[0]
        assert "id" in session
        assert "device" in session
        assert "device_type" in session
        assert "location" in session
        assert "is_current" in session
        
        print(f"✅ GET /api/auth/sessions - Returns mock session data (MOCKED)")
        print(f"   Session: device={session['device']}, location={session['location']}")
    
    def test_logout_all_sessions(self, auth_user):
        """Test POST /api/auth/sessions/logout-all"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        response = requests.post(f"{API}/auth/sessions/logout-all", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
        print(f"✅ POST /api/auth/sessions/logout-all - Logout all sessions successful")


class TestAccountFreeze:
    """Account freeze/unfreeze tests"""
    
    @pytest.fixture
    def auth_user(self):
        """Create authenticated user for freeze tests"""
        user = create_test_user("freeze")
        if not user:
            pytest.skip("Could not create test user")
        return user
    
    def test_freeze_account(self, auth_user):
        """Test POST /api/account/freeze"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        response = requests.post(f"{API}/account/freeze", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Hesabınız donduruldu"
        
        print(f"✅ POST /api/account/freeze - Account frozen successfully")
    
    def test_unfreeze_account(self, auth_user):
        """Test POST /api/account/unfreeze"""
        headers = {"Authorization": f"Bearer {auth_user['token']}"}
        
        # First freeze
        requests.post(f"{API}/account/freeze", headers=headers, timeout=10)
        
        # Then unfreeze
        response = requests.post(f"{API}/account/unfreeze", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Hesabınız yeniden etkinleştirildi"
        
        print(f"✅ POST /api/account/unfreeze - Account unfrozen successfully")


class TestAccountDelete:
    """Account deletion tests"""
    
    def test_delete_account_success(self):
        """Test DELETE /api/account/delete - successful deletion"""
        # Create a user specifically for deletion
        user = create_test_user("delete")
        if not user:
            pytest.skip("Could not create test user for deletion")
        
        headers = {"Authorization": f"Bearer {user['token']}"}
        
        response = requests.delete(
            f"{API}/account/delete?password={user['password']}", 
            headers=headers, 
            timeout=10
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Hesabınız kalıcı olarak silindi"
        
        # Verify user cannot login anymore
        login_response = requests.post(f"{API}/auth/login", json={
            "email": user["email"],
            "password": user["password"]
        }, timeout=10)
        
        assert login_response.status_code == 401
        
        print(f"✅ DELETE /api/account/delete - Account deleted and cannot login")
    
    def test_delete_account_wrong_password(self):
        """Test DELETE /api/account/delete - wrong password"""
        user = create_test_user("delete_fail")
        if not user:
            pytest.skip("Could not create test user")
        
        headers = {"Authorization": f"Bearer {user['token']}"}
        
        response = requests.delete(
            f"{API}/account/delete?password=WrongPassword123!", 
            headers=headers, 
            timeout=10
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        
        print(f"✅ DELETE /api/account/delete - Wrong password returns 400")


class TestBlockedUsers:
    """Blocked users management tests"""
    
    @pytest.fixture
    def two_users(self):
        """Create two users for blocking tests"""
        user1 = create_test_user("blocker")
        user2 = create_test_user("blocked")
        
        if not user1 or not user2:
            pytest.skip("Could not create test users")
        
        return {"user1": user1, "user2": user2}
    
    def test_get_blocked_users_empty(self, two_users):
        """Test GET /api/social/blocked-users - empty list for new user"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        
        response = requests.get(f"{API}/social/blocked-users", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        
        print(f"✅ GET /api/social/blocked-users - Returns empty list for new user")
    
    def test_block_user(self, two_users):
        """Test POST /api/social/block/{user_id}"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        target_id = two_users['user2']['id']
        
        response = requests.post(f"{API}/social/block/{target_id}", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Kullanıcı engellendi"
        
        # Verify user appears in blocked list
        blocked_response = requests.get(f"{API}/social/blocked-users", headers=headers, timeout=10)
        blocked_users = blocked_response.json()
        
        assert len(blocked_users) == 1
        assert blocked_users[0]["id"] == target_id
        
        print(f"✅ POST /api/social/block - User blocked and appears in blocked list")
    
    def test_block_user_already_blocked(self, two_users):
        """Test POST /api/social/block/{user_id} - already blocked"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        target_id = two_users['user2']['id']
        
        # Block first time
        requests.post(f"{API}/social/block/{target_id}", headers=headers, timeout=10)
        
        # Try to block again
        response = requests.post(f"{API}/social/block/{target_id}", headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        
        print(f"✅ POST /api/social/block - Already blocked returns 400")
    
    def test_block_self(self, two_users):
        """Test POST /api/social/block/{user_id} - cannot block self"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        self_id = two_users['user1']['id']
        
        response = requests.post(f"{API}/social/block/{self_id}", headers=headers, timeout=10)
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        
        print(f"✅ POST /api/social/block - Cannot block self returns 400")
    
    def test_unblock_user(self, two_users):
        """Test DELETE /api/social/unblock/{user_id}"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        target_id = two_users['user2']['id']
        
        # First block
        requests.post(f"{API}/social/block/{target_id}", headers=headers, timeout=10)
        
        # Then unblock
        response = requests.delete(f"{API}/social/unblock/{target_id}", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Kullanıcının engeli kaldırıldı"
        
        # Verify user no longer in blocked list
        blocked_response = requests.get(f"{API}/social/blocked-users", headers=headers, timeout=10)
        blocked_users = blocked_response.json()
        
        assert len(blocked_users) == 0
        
        print(f"✅ DELETE /api/social/unblock - User unblocked successfully")
    
    def test_unblock_not_blocked(self, two_users):
        """Test DELETE /api/social/unblock/{user_id} - user not blocked"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        target_id = two_users['user2']['id']
        
        response = requests.delete(f"{API}/social/unblock/{target_id}", headers=headers, timeout=10)
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        
        print(f"✅ DELETE /api/social/unblock - Not blocked returns 404")


class TestWithProvidedCredentials:
    """Tests using the provided test credentials"""
    
    def test_login_with_provided_credentials(self):
        """Test login with testuser2@test.com"""
        response = requests.post(f"{API}/auth/login", json=TEST_USER, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data or "token" in data
            print(f"✅ Login with testuser2@test.com successful")
        elif response.status_code == 401:
            # User doesn't exist, create it
            register_data = {
                "email": TEST_USER["email"],
                "username": "testuser2",
                "password": TEST_USER["password"],
                "display_name": "Test User 2"
            }
            reg_response = requests.post(f"{API}/auth/register", json=register_data, timeout=10)
            assert reg_response.status_code == 200
            print(f"✅ Created testuser2@test.com and logged in")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_get_settings_with_provided_credentials(self):
        """Test getting settings with provided credentials"""
        token = get_auth_token(TEST_USER["email"], TEST_USER["password"])
        
        if not token:
            # Create user if doesn't exist
            register_data = {
                "email": TEST_USER["email"],
                "username": "testuser2",
                "password": TEST_USER["password"],
                "display_name": "Test User 2"
            }
            reg_response = requests.post(f"{API}/auth/register", json=register_data, timeout=10)
            if reg_response.status_code == 200:
                token = reg_response.json().get("access_token") or reg_response.json().get("token")
        
        if not token:
            pytest.skip("Could not authenticate with provided credentials")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API}/user/settings", headers=headers, timeout=10)
        
        assert response.status_code == 200
        data = response.json()
        assert "theme" in data
        print(f"✅ GET /api/user/settings with testuser2@test.com - Success")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
