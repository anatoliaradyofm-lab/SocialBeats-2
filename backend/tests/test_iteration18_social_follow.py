"""
Iteration 18 - Social Follow Features Test Suite
Tests for:
- GET /api/social/follow-status/{user_id} - Check follow status
- POST /api/social/follow-request/{user_id} - Send follow request
- DELETE /api/social/follow-request/{user_id}/cancel - Cancel follow request
- POST /api/social/follow/{user_id} - Follow user
- DELETE /api/social/unfollow/{user_id} - Unfollow user
- GET /api/social/followers/{user_id} - Get followers list
- GET /api/social/following/{user_id} - Get following list
- GET /api/user/{username} - Get user profile by username
- GET /api/themes - Theme API still working
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@test.com"
TEST_USER_PASSWORD = "test123"

# Second test user for follow tests
TEST_USER2_EMAIL = f"testuser2_{uuid.uuid4().hex[:8]}@test.com"
TEST_USER2_PASSWORD = "test123"
TEST_USER2_USERNAME = f"testuser2_{uuid.uuid4().hex[:8]}"


class TestSetup:
    """Setup tests - verify backend is healthy and login works"""
    
    def test_health_check(self):
        """Test backend health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Backend health check passed")
    
    def test_login_test_user(self):
        """Test login with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✅ Login successful for {TEST_USER_EMAIL}")
        return data


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def test_user_data():
    """Get test user data"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("user")
    pytest.skip("Could not get test user data")


@pytest.fixture(scope="module")
def second_user_data():
    """Create or get second test user for follow tests"""
    # Try to register a new user
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_USER2_EMAIL,
        "password": TEST_USER2_PASSWORD,
        "username": TEST_USER2_USERNAME,
        "display_name": "Test User 2"
    })
    
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data.get("access_token"),
            "user": data.get("user")
        }
    elif response.status_code == 400:
        # User might already exist, try to login
        # For this test, we'll create a unique user each time
        unique_email = f"testuser_{uuid.uuid4().hex[:8]}@test.com"
        unique_username = f"testuser_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": TEST_USER2_PASSWORD,
            "username": unique_username,
            "display_name": "Test User 2"
        })
        if response.status_code == 200:
            data = response.json()
            return {
                "token": data.get("access_token"),
                "user": data.get("user")
            }
    
    pytest.skip("Could not create second test user")


@pytest.fixture
def auth_headers(auth_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestThemeAPI:
    """Test Theme API is still working after modularization"""
    
    def test_get_all_themes(self, auth_headers):
        """GET /api/themes - Get all themes"""
        response = requests.get(f"{BASE_URL}/api/themes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "app_themes" in data
        assert "profile_themes" in data
        assert len(data["app_themes"]) >= 6  # dark, light, midnight, sunset, forest, neon
        print(f"✅ GET /api/themes - Found {len(data['app_themes'])} app themes")
    
    def test_get_app_themes(self, auth_headers):
        """GET /api/themes/app - Get app themes only"""
        response = requests.get(f"{BASE_URL}/api/themes/app", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        theme_ids = [t["id"] for t in data]
        assert "dark" in theme_ids
        assert "light" in theme_ids
        print(f"✅ GET /api/themes/app - Found {len(data)} app themes")
    
    def test_get_user_theme_settings(self, auth_headers):
        """GET /api/themes/user - Get user's current theme"""
        response = requests.get(f"{BASE_URL}/api/themes/user", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "app_theme" in data
        assert "profile_theme" in data
        assert "app_theme_id" in data
        print(f"✅ GET /api/themes/user - Current theme: {data['app_theme_id']}")


class TestUserProfile:
    """Test user profile endpoints"""
    
    def test_get_user_by_username(self, auth_headers, test_user_data):
        """GET /api/user/{username} - Get user profile by username"""
        username = test_user_data.get("username")
        response = requests.get(f"{BASE_URL}/api/user/{username}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("username") == username
        assert "id" in data
        assert "followers_count" in data
        assert "following_count" in data
        assert "is_following" in data
        print(f"✅ GET /api/user/{username} - Profile retrieved successfully")
    
    def test_get_nonexistent_user(self, auth_headers):
        """GET /api/user/{username} - Should return 404 for nonexistent user"""
        response = requests.get(f"{BASE_URL}/api/user/nonexistent_user_12345", headers=auth_headers)
        assert response.status_code == 404
        print("✅ GET /api/user/nonexistent - Returns 404 as expected")


class TestFollowStatus:
    """Test follow status endpoint"""
    
    def test_get_follow_status(self, auth_headers, second_user_data):
        """GET /api/social/follow-status/{user_id} - Check follow status"""
        target_user_id = second_user_data["user"]["id"]
        response = requests.get(
            f"{BASE_URL}/api/social/follow-status/{target_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_following" in data
        assert "is_requested" in data
        assert isinstance(data["is_following"], bool)
        assert isinstance(data["is_requested"], bool)
        print(f"✅ GET /api/social/follow-status - is_following: {data['is_following']}, is_requested: {data['is_requested']}")
    
    def test_get_follow_status_self(self, auth_headers, test_user_data):
        """GET /api/social/follow-status/{user_id} - Check status for self"""
        own_user_id = test_user_data["id"]
        response = requests.get(
            f"{BASE_URL}/api/social/follow-status/{own_user_id}",
            headers=auth_headers
        )
        # Should return status (not following self)
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == False
        print("✅ GET /api/social/follow-status (self) - Returns not following")


class TestFollowUser:
    """Test follow/unfollow user endpoints"""
    
    def test_follow_user(self, auth_headers, second_user_data):
        """POST /api/social/follow/{user_id} - Follow a user"""
        target_user_id = second_user_data["user"]["id"]
        
        # First, make sure we're not following
        # Try to unfollow first (ignore errors)
        requests.delete(
            f"{BASE_URL}/api/social/unfollow/{target_user_id}",
            headers=auth_headers
        )
        
        # Now follow
        response = requests.post(
            f"{BASE_URL}/api/social/follow/{target_user_id}",
            headers=auth_headers
        )
        
        # Should succeed or already following
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✅ POST /api/social/follow - Successfully followed user")
        else:
            print(f"✅ POST /api/social/follow - Already following (expected)")
    
    def test_follow_self_should_fail(self, auth_headers, test_user_data):
        """POST /api/social/follow/{user_id} - Cannot follow yourself"""
        own_user_id = test_user_data["id"]
        response = requests.post(
            f"{BASE_URL}/api/social/follow/{own_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print("✅ POST /api/social/follow (self) - Returns 400 as expected")
    
    def test_follow_nonexistent_user(self, auth_headers):
        """POST /api/social/follow/{user_id} - Cannot follow nonexistent user"""
        fake_user_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/social/follow/{fake_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✅ POST /api/social/follow (nonexistent) - Returns 404 as expected")
    
    def test_unfollow_user(self, auth_headers, second_user_data):
        """DELETE /api/social/unfollow/{user_id} - Unfollow a user"""
        target_user_id = second_user_data["user"]["id"]
        
        # First make sure we're following
        requests.post(
            f"{BASE_URL}/api/social/follow/{target_user_id}",
            headers=auth_headers
        )
        
        # Now unfollow
        response = requests.delete(
            f"{BASE_URL}/api/social/unfollow/{target_user_id}",
            headers=auth_headers
        )
        
        # Should succeed or not following
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✅ DELETE /api/social/unfollow - Successfully unfollowed user")
        else:
            print(f"✅ DELETE /api/social/unfollow - Not following (expected)")


class TestFollowRequest:
    """Test follow request endpoints (for private accounts)"""
    
    def test_send_follow_request(self, auth_headers, second_user_data):
        """POST /api/social/follow-request/{user_id} - Send follow request"""
        target_user_id = second_user_data["user"]["id"]
        
        # First, make sure we're not following and no pending request
        requests.delete(
            f"{BASE_URL}/api/social/unfollow/{target_user_id}",
            headers=auth_headers
        )
        requests.delete(
            f"{BASE_URL}/api/social/follow-request/{target_user_id}/cancel",
            headers=auth_headers
        )
        
        # Send follow request
        response = requests.post(
            f"{BASE_URL}/api/social/follow-request/{target_user_id}",
            headers=auth_headers
        )
        
        # Should succeed or already sent/following
        assert response.status_code in [200, 400]
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✅ POST /api/social/follow-request - Request sent successfully")
        else:
            data = response.json()
            print(f"✅ POST /api/social/follow-request - {data.get('detail', 'Already sent/following')}")
    
    def test_send_follow_request_self_should_fail(self, auth_headers, test_user_data):
        """POST /api/social/follow-request/{user_id} - Cannot send request to yourself"""
        own_user_id = test_user_data["id"]
        response = requests.post(
            f"{BASE_URL}/api/social/follow-request/{own_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 400
        print("✅ POST /api/social/follow-request (self) - Returns 400 as expected")
    
    def test_cancel_follow_request(self, auth_headers, second_user_data):
        """DELETE /api/social/follow-request/{user_id}/cancel - Cancel follow request"""
        target_user_id = second_user_data["user"]["id"]
        
        # First send a request
        requests.delete(
            f"{BASE_URL}/api/social/unfollow/{target_user_id}",
            headers=auth_headers
        )
        requests.post(
            f"{BASE_URL}/api/social/follow-request/{target_user_id}",
            headers=auth_headers
        )
        
        # Now cancel it
        response = requests.delete(
            f"{BASE_URL}/api/social/follow-request/{target_user_id}/cancel",
            headers=auth_headers
        )
        
        # Should succeed or no pending request
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✅ DELETE /api/social/follow-request/cancel - Request cancelled")
        else:
            print(f"✅ DELETE /api/social/follow-request/cancel - No pending request")


class TestFollowersList:
    """Test followers and following list endpoints"""
    
    def test_get_followers(self, auth_headers, test_user_data):
        """GET /api/social/followers/{user_id} - Get user's followers"""
        user_id = test_user_data["id"]
        response = requests.get(
            f"{BASE_URL}/api/social/followers/{user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/followers - Found {len(data)} followers")
    
    def test_get_following(self, auth_headers, test_user_data):
        """GET /api/social/following/{user_id} - Get users being followed"""
        user_id = test_user_data["id"]
        response = requests.get(
            f"{BASE_URL}/api/social/following/{user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/following - Following {len(data)} users")
    
    def test_followers_list_contains_user_info(self, auth_headers, second_user_data, test_user_data):
        """Verify followers list contains proper user info"""
        # First, have second user follow test user
        second_user_headers = {"Authorization": f"Bearer {second_user_data['token']}"}
        test_user_id = test_user_data["id"]
        
        # Second user follows test user
        requests.post(
            f"{BASE_URL}/api/social/follow/{test_user_id}",
            headers=second_user_headers
        )
        
        # Now get test user's followers
        response = requests.get(
            f"{BASE_URL}/api/social/followers/{test_user_id}",
            headers={"Authorization": f"Bearer {second_user_data['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check if list contains user objects with expected fields
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "username" in user
            # is_following flag should be present
            assert "is_following" in user
            print(f"✅ Followers list contains proper user info with is_following flag")
        else:
            print(f"✅ Followers list is empty (no followers yet)")


class TestFollowFlow:
    """Test complete follow/unfollow flow"""
    
    def test_complete_follow_flow(self, auth_headers, second_user_data, test_user_data):
        """Test complete follow flow: check status -> follow -> verify -> unfollow -> verify"""
        target_user_id = second_user_data["user"]["id"]
        
        # Step 1: Ensure not following
        requests.delete(
            f"{BASE_URL}/api/social/unfollow/{target_user_id}",
            headers=auth_headers
        )
        
        # Step 2: Check initial status
        response = requests.get(
            f"{BASE_URL}/api/social/follow-status/{target_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == False
        print("✅ Step 1: Initial status - not following")
        
        # Step 3: Follow user
        response = requests.post(
            f"{BASE_URL}/api/social/follow/{target_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print("✅ Step 2: Followed user successfully")
        
        # Step 4: Verify follow status
        response = requests.get(
            f"{BASE_URL}/api/social/follow-status/{target_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == True
        print("✅ Step 3: Verified - now following")
        
        # Step 5: Unfollow user
        response = requests.delete(
            f"{BASE_URL}/api/social/unfollow/{target_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print("✅ Step 4: Unfollowed user successfully")
        
        # Step 6: Verify unfollow
        response = requests.get(
            f"{BASE_URL}/api/social/follow-status/{target_user_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == False
        print("✅ Step 5: Verified - no longer following")
        
        print("✅ Complete follow flow test passed!")


class TestUnauthorizedAccess:
    """Test endpoints require authentication"""
    
    def test_follow_status_unauthorized(self):
        """GET /api/social/follow-status - Should require auth"""
        response = requests.get(f"{BASE_URL}/api/social/follow-status/some-user-id")
        assert response.status_code in [401, 403]
        print("✅ GET /api/social/follow-status - Requires authentication")
    
    def test_follow_unauthorized(self):
        """POST /api/social/follow - Should require auth"""
        response = requests.post(f"{BASE_URL}/api/social/follow/some-user-id")
        assert response.status_code in [401, 403]
        print("✅ POST /api/social/follow - Requires authentication")
    
    def test_followers_list_unauthorized(self):
        """GET /api/social/followers - Should require auth"""
        response = requests.get(f"{BASE_URL}/api/social/followers/some-user-id")
        assert response.status_code in [401, 403]
        print("✅ GET /api/social/followers - Requires authentication")
    
    def test_user_profile_unauthorized(self):
        """GET /api/user/{username} - Should require auth"""
        response = requests.get(f"{BASE_URL}/api/user/testuser")
        assert response.status_code in [401, 403]
        print("✅ GET /api/user/{username} - Requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
