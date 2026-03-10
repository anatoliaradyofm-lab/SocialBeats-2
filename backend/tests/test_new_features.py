"""
Test file for new SocialBeats features:
- Premium subscription upgrade
- Friend request system
- Social share functionality
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-music-fix.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials from review request
TEST_USER_1 = {"email": "free1770666673@test.com", "password": "Free123!"}
TEST_USER_2 = {"email": "test1770666616@test.com", "password": "Test123!"}


def get_auth_token(email, password):
    """Helper to get auth token - handles both 'token' and 'access_token' response formats"""
    response = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=10)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    return None


def create_test_user():
    """Create a new test user and return token"""
    timestamp = datetime.now().strftime("%H%M%S%f")
    register_data = {
        "email": f"test_{timestamp}@test.com",
        "username": f"testuser_{timestamp}",
        "password": "Test123!",
        "display_name": f"Test User {timestamp}"
    }
    response = requests.post(f"{API}/auth/register", json=register_data, timeout=10)
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token"), data.get("user", {}).get("id")
    return None, None


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{API}/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ API Health: {data}")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{API}/", timeout=10)
        assert response.status_code == 200
        print(f"✅ API Root accessible")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_user1(self):
        """Test login for user 1"""
        response = requests.post(f"{API}/auth/login", json=TEST_USER_1, timeout=10)
        assert response.status_code in [200, 401]
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data or "token" in data
            print(f"✅ User 1 login successful")
        else:
            print(f"⚠️ User 1 doesn't exist")
    
    def test_login_user2(self):
        """Test login for user 2"""
        response = requests.post(f"{API}/auth/login", json=TEST_USER_2, timeout=10)
        assert response.status_code in [200, 401]
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data or "token" in data
            print(f"✅ User 2 login successful")
        else:
            print(f"⚠️ User 2 doesn't exist")


class TestPremiumSubscription:
    """Premium subscription feature tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        token = get_auth_token(TEST_USER_1["email"], TEST_USER_1["password"])
        if token:
            return {"Authorization": f"Bearer {token}"}
        
        # Create new user
        token, _ = create_test_user()
        if token:
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not authenticate for premium tests")
    
    def test_subscription_upgrade_endpoint_exists(self, auth_headers):
        """Test POST /api/subscription/upgrade endpoint exists and works"""
        response = requests.post(f"{API}/subscription/upgrade", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "expires_at" in data
        print(f"✅ Premium upgrade successful: {data['message']}")
    
    def test_subscription_status_endpoint(self, auth_headers):
        """Test GET /api/subscription/status endpoint"""
        response = requests.get(f"{API}/subscription/status", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "subscription_type" in data
        print(f"✅ Subscription status: {data['subscription_type']}")


class TestFriendRequestSystem:
    """Friend request system tests"""
    
    @pytest.fixture
    def two_users(self):
        """Create two users for friend request testing"""
        timestamp = datetime.now().strftime("%H%M%S%f")
        
        # User 1
        user1_data = {
            "email": f"friend_test1_{timestamp}@test.com",
            "username": f"friend_test1_{timestamp}",
            "password": "Test123!",
            "display_name": "Friend Test User 1"
        }
        response1 = requests.post(f"{API}/auth/register", json=user1_data, timeout=10)
        if response1.status_code != 200:
            pytest.skip("Could not create user 1")
        user1 = response1.json()
        token1 = user1.get("access_token") or user1.get("token")
        user1_id = user1.get("user", {}).get("id")
        
        # User 2
        user2_data = {
            "email": f"friend_test2_{timestamp}@test.com",
            "username": f"friend_test2_{timestamp}",
            "password": "Test123!",
            "display_name": "Friend Test User 2"
        }
        response2 = requests.post(f"{API}/auth/register", json=user2_data, timeout=10)
        if response2.status_code != 200:
            pytest.skip("Could not create user 2")
        user2 = response2.json()
        token2 = user2.get("access_token") or user2.get("token")
        user2_id = user2.get("user", {}).get("id")
        
        return {
            "user1": {"token": token1, "id": user1_id},
            "user2": {"token": token2, "id": user2_id}
        }
    
    def test_get_friend_requests_endpoint(self, two_users):
        """Test GET /api/social/friend-requests endpoint"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        response = requests.get(f"{API}/social/friend-requests", headers=headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get friend requests: {len(data)} pending requests")
    
    def test_send_friend_request(self, two_users):
        """Test POST /api/social/friend-request/{user_id} endpoint"""
        headers = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        target_user_id = two_users['user2']['id']
        
        response = requests.post(
            f"{API}/social/friend-request/{target_user_id}",
            headers=headers,
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "request_id" in data
        print(f"✅ Friend request sent: {data['message']}")
        return data['request_id']
    
    def test_friend_request_flow(self, two_users):
        """Test complete friend request flow: send -> receive -> accept"""
        headers1 = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        headers2 = {"Authorization": f"Bearer {two_users['user2']['token']}"}
        target_user_id = two_users['user2']['id']
        
        # Send request
        send_response = requests.post(
            f"{API}/social/friend-request/{target_user_id}",
            headers=headers1,
            timeout=10
        )
        assert send_response.status_code == 200
        request_id = send_response.json()['request_id']
        print(f"✅ Step 1: Friend request sent (ID: {request_id})")
        
        # User 2 checks pending requests
        pending_response = requests.get(f"{API}/social/friend-requests", headers=headers2, timeout=10)
        assert pending_response.status_code == 200
        pending_requests = pending_response.json()
        assert len(pending_requests) > 0
        print(f"✅ Step 2: User 2 has {len(pending_requests)} pending request(s)")
        
        # User 2 accepts the request
        accept_response = requests.post(
            f"{API}/social/friend-request/{request_id}/accept",
            headers=headers2,
            timeout=10
        )
        assert accept_response.status_code == 200
        print(f"✅ Step 3: Friend request accepted")
    
    def test_reject_friend_request(self, two_users):
        """Test rejecting a friend request"""
        headers1 = {"Authorization": f"Bearer {two_users['user1']['token']}"}
        headers2 = {"Authorization": f"Bearer {two_users['user2']['token']}"}
        target_user_id = two_users['user2']['id']
        
        # Send request
        send_response = requests.post(
            f"{API}/social/friend-request/{target_user_id}",
            headers=headers1,
            timeout=10
        )
        if send_response.status_code != 200:
            pytest.skip("Could not send friend request (may already be friends)")
        
        request_id = send_response.json()['request_id']
        
        # Reject request
        reject_response = requests.post(
            f"{API}/social/friend-request/{request_id}/reject",
            headers=headers2,
            timeout=10
        )
        assert reject_response.status_code == 200
        print(f"✅ Friend request rejected successfully")


class TestNotifications:
    """Notification system tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        token, _ = create_test_user()
        if token:
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not authenticate for notification tests")
    
    def test_get_notifications(self, auth_headers):
        """Test GET /api/social/notifications endpoint"""
        response = requests.get(f"{API}/social/notifications", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Get notifications: {len(data)} notifications")
    
    def test_get_unread_count(self, auth_headers):
        """Test GET /api/social/notifications/unread-count endpoint"""
        response = requests.get(f"{API}/social/notifications/unread-count", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✅ Unread count: {data['count']}")
    
    def test_mark_notifications_read(self, auth_headers):
        """Test POST /api/social/notifications/mark-read endpoint"""
        response = requests.post(f"{API}/social/notifications/mark-read", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        print(f"✅ Mark notifications as read successful")


class TestSocialFeed:
    """Social feed tests"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        token, _ = create_test_user()
        if token:
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Could not authenticate for social tests")
    
    def test_get_social_feed(self, auth_headers):
        """Test GET /api/social/feed endpoint"""
        response = requests.get(f"{API}/social/feed", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Social feed: {len(data)} posts")
    
    def test_get_trending_posts(self, auth_headers):
        """Test GET /api/social/posts/trending endpoint"""
        response = requests.get(f"{API}/social/posts/trending", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Trending posts: {len(data)} posts")
    
    def test_get_explore_posts(self, auth_headers):
        """Test GET /api/social/posts/explore endpoint"""
        response = requests.get(f"{API}/social/posts/explore", headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Explore posts: {len(data)} posts")
    
    def test_create_post(self, auth_headers):
        """Test POST /api/social/posts endpoint"""
        post_data = {
            "content": "Test post from pytest - Ne yapıyorsun?",
            "post_type": "text",
            "visibility": "public"
        }
        response = requests.post(f"{API}/social/posts", json=post_data, headers=auth_headers, timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["content"] == post_data["content"]
        print(f"✅ Post created: {data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
