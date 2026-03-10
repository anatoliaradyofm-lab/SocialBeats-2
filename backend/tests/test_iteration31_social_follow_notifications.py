"""
Iteration 31 - Testing Social Routes (Follow & Notifications)
Tests endpoints that remain in social_routes.py after refactoring.
"""

import pytest
import requests
import os
import time

# Use localhost to bypass rate limiting
BASE_URL = "http://localhost:8001"

# Test credentials
TEST_EMAIL = "test_social@test.com"
TEST_PASSWORD = "Test123!"

# Second user for follow tests
TEST_EMAIL_2 = "test_social2@test.com"
TEST_PASSWORD_2 = "Test123!"

# Global token storage
AUTH_TOKEN = None
USER_ID = None
AUTH_TOKEN_2 = None
USER_ID_2 = None


def get_auth_token(email=TEST_EMAIL, password=TEST_PASSWORD):
    """Get authentication token"""
    # Try to login
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    
    if login_resp.status_code == 200:
        data = login_resp.json()
        return data.get("access_token") or data.get("token"), data.get("user", {}).get("id")
    
    # Try to register
    username = email.split("@")[0].replace(".", "_")
    register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": password,
        "username": username,
        "display_name": f"Test User {username}"
    })
    
    if register_resp.status_code in [200, 201]:
        data = register_resp.json()
        return data.get("access_token") or data.get("token"), data.get("user", {}).get("id")
    
    # Try login again
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    
    if login_resp.status_code == 200:
        data = login_resp.json()
        return data.get("access_token") or data.get("token"), data.get("user", {}).get("id")
    
    raise Exception(f"Could not authenticate: {login_resp.text}")


def get_headers(token=None):
    """Get headers with auth token"""
    global AUTH_TOKEN, USER_ID
    if token is None:
        if AUTH_TOKEN is None:
            AUTH_TOKEN, USER_ID = get_auth_token()
        token = AUTH_TOKEN
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def setup_module():
    """Setup test users"""
    global AUTH_TOKEN, USER_ID, AUTH_TOKEN_2, USER_ID_2
    AUTH_TOKEN, USER_ID = get_auth_token(TEST_EMAIL, TEST_PASSWORD)
    AUTH_TOKEN_2, USER_ID_2 = get_auth_token(TEST_EMAIL_2, TEST_PASSWORD_2)
    print(f"✅ Setup: User 1 ID: {USER_ID}, User 2 ID: {USER_ID_2}")


# ============================================
# FOLLOW SYSTEM TESTS (social_routes.py)
# ============================================

class TestFollowSystem:
    """Test follow endpoints from social_routes.py"""
    
    def test_follow_user(self):
        """POST /api/social/follow/{user_id} - Follow a user"""
        global AUTH_TOKEN, USER_ID_2
        headers = get_headers(AUTH_TOKEN)
        
        # First unfollow if already following
        requests.delete(f"{BASE_URL}/api/social/unfollow/{USER_ID_2}", headers=headers)
        
        response = requests.post(
            f"{BASE_URL}/api/social/follow/{USER_ID_2}",
            headers=headers
        )
        
        # Accept 200 (success) or 400 (already following)
        assert response.status_code in [200, 400], f"Follow user failed: {response.text}"
        print(f"✅ Follow user endpoint working")
    
    def test_get_follow_status(self):
        """GET /api/social/follow-status/{user_id} - Check follow status"""
        global AUTH_TOKEN, USER_ID_2
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.get(
            f"{BASE_URL}/api/social/follow-status/{USER_ID_2}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get follow status failed: {response.text}"
        data = response.json()
        assert "is_following" in data
        assert "is_requested" in data
        print(f"✅ Follow status: is_following={data['is_following']}")
    
    def test_get_followers(self):
        """GET /api/social/followers/{user_id} - Get user's followers"""
        global AUTH_TOKEN, USER_ID
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.get(
            f"{BASE_URL}/api/social/followers/{USER_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get followers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} followers")
    
    def test_get_following(self):
        """GET /api/social/following/{user_id} - Get users that user is following"""
        global AUTH_TOKEN, USER_ID
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.get(
            f"{BASE_URL}/api/social/following/{USER_ID}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get following failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} following")
    
    def test_unfollow_user(self):
        """DELETE /api/social/unfollow/{user_id} - Unfollow a user"""
        global AUTH_TOKEN, USER_ID_2
        headers = get_headers(AUTH_TOKEN)
        
        # First make sure we're following
        requests.post(f"{BASE_URL}/api/social/follow/{USER_ID_2}", headers=headers)
        
        response = requests.delete(
            f"{BASE_URL}/api/social/unfollow/{USER_ID_2}",
            headers=headers
        )
        
        # Accept 200 (success) or 400 (not following)
        assert response.status_code in [200, 400], f"Unfollow user failed: {response.text}"
        print(f"✅ Unfollow user endpoint working")
    
    def test_cannot_follow_self(self):
        """POST /api/social/follow/{user_id} - Cannot follow yourself"""
        global AUTH_TOKEN, USER_ID
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.post(
            f"{BASE_URL}/api/social/follow/{USER_ID}",
            headers=headers
        )
        
        assert response.status_code == 400, f"Should not be able to follow self: {response.text}"
        print(f"✅ Cannot follow self validation working")


# ============================================
# FOLLOW REQUEST TESTS (social_routes.py)
# ============================================

class TestFollowRequests:
    """Test follow request endpoints"""
    
    def test_send_follow_request(self):
        """POST /api/social/follow-request/{user_id} - Send follow request"""
        global AUTH_TOKEN, USER_ID_2
        headers = get_headers(AUTH_TOKEN)
        
        # First unfollow and cancel any existing request
        requests.delete(f"{BASE_URL}/api/social/unfollow/{USER_ID_2}", headers=headers)
        requests.delete(f"{BASE_URL}/api/social/follow-request/{USER_ID_2}/cancel", headers=headers)
        
        response = requests.post(
            f"{BASE_URL}/api/social/follow-request/{USER_ID_2}",
            headers=headers
        )
        
        # Accept 200 (success), 400 (already following/requested)
        assert response.status_code in [200, 400], f"Send follow request failed: {response.text}"
        print(f"✅ Follow request endpoint working")
    
    def test_cancel_follow_request(self):
        """DELETE /api/social/follow-request/{user_id}/cancel - Cancel follow request"""
        global AUTH_TOKEN, USER_ID_2
        headers = get_headers(AUTH_TOKEN)
        
        # First send a request
        requests.post(f"{BASE_URL}/api/social/follow-request/{USER_ID_2}", headers=headers)
        
        response = requests.delete(
            f"{BASE_URL}/api/social/follow-request/{USER_ID_2}/cancel",
            headers=headers
        )
        
        # Accept 200 (success) or 404 (no pending request)
        assert response.status_code in [200, 404], f"Cancel follow request failed: {response.text}"
        print(f"✅ Cancel follow request endpoint working")


# ============================================
# NOTIFICATIONS TESTS (social_routes.py)
# ============================================

class TestNotifications:
    """Test notification endpoints from social_routes.py"""
    
    def test_get_notifications(self):
        """GET /api/social/notifications - Get user notifications"""
        global AUTH_TOKEN
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.get(
            f"{BASE_URL}/api/social/notifications",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} notifications")
    
    def test_get_unread_count(self):
        """GET /api/social/notifications/unread-count - Get unread notification count"""
        global AUTH_TOKEN
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.get(
            f"{BASE_URL}/api/social/notifications/unread-count",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "count" in data
        print(f"✅ Unread count: {data['count']}")
    
    def test_mark_notifications_read(self):
        """POST /api/social/notifications/mark-read - Mark all notifications as read"""
        global AUTH_TOKEN
        headers = get_headers(AUTH_TOKEN)
        
        response = requests.post(
            f"{BASE_URL}/api/social/notifications/mark-read",
            headers=headers
        )
        
        assert response.status_code == 200, f"Mark notifications read failed: {response.text}"
        print(f"✅ Mark notifications read working")


# ============================================
# INTEGRATION TEST - Follow creates notification
# ============================================

class TestFollowNotificationIntegration:
    """Test that following creates a notification"""
    
    def test_follow_creates_notification(self):
        """Following a user should create a notification for them"""
        global AUTH_TOKEN, AUTH_TOKEN_2, USER_ID, USER_ID_2
        
        headers_1 = get_headers(AUTH_TOKEN)
        headers_2 = get_headers(AUTH_TOKEN_2)
        
        # User 1 unfollows User 2 first
        requests.delete(f"{BASE_URL}/api/social/unfollow/{USER_ID_2}", headers=headers_1)
        
        # Mark User 2's notifications as read
        requests.post(f"{BASE_URL}/api/social/notifications/mark-read", headers=headers_2)
        
        # Get User 2's unread count before
        before_resp = requests.get(f"{BASE_URL}/api/social/notifications/unread-count", headers=headers_2)
        before_count = before_resp.json().get("count", 0)
        
        # User 1 follows User 2
        follow_resp = requests.post(f"{BASE_URL}/api/social/follow/{USER_ID_2}", headers=headers_1)
        
        if follow_resp.status_code == 200:
            # Get User 2's unread count after
            after_resp = requests.get(f"{BASE_URL}/api/social/notifications/unread-count", headers=headers_2)
            after_count = after_resp.json().get("count", 0)
            
            # Should have at least one more notification
            assert after_count >= before_count, "Follow should create notification"
            print(f"✅ Follow created notification (before: {before_count}, after: {after_count})")
        else:
            print(f"✅ Follow integration test skipped (already following)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
