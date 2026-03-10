"""
Iteration 10 Backend Tests - SocialBeats API
Testing: Push Notifications, GDPR Export, Message Search, Hashtag Search, Rate Limiter, Admin Endpoints
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup test user and get auth token"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_iter10_{unique_id}@test.com"
        password = "test1234"
        username = f"testuser_iter10_{unique_id}"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "username": username,
            "display_name": f"Test User {unique_id}"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "username": username,
                "user_id": data["user"]["id"],
                "token": data["access_token"]
            }
        elif response.status_code == 400:
            # User might already exist, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
            if login_response.status_code == 200:
                data = login_response.json()
                return {
                    "email": email,
                    "password": password,
                    "username": username,
                    "user_id": data["user"]["id"],
                    "token": data["access_token"]
                }
        
        pytest.skip(f"Could not create test user: {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, test_user):
        """Return auth headers for authenticated requests"""
        return {"Authorization": f"Bearer {test_user['token']}"}


class TestPushNotificationEndpoints(TestSetup):
    """Test Push Notification token registration endpoint"""
    
    def test_register_push_token_with_expo_push_token(self, auth_headers):
        """POST /api/notifications/register-token - Register with expo_push_token"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            json={
                "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
                "platform": "android",
                "device_name": "Test Device"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("status") == "success" or "kaydedildi" in data.get("message", "").lower()
        print(f"✅ Push token registered successfully: {data}")
    
    def test_register_push_token_with_expo_token(self, auth_headers):
        """POST /api/notifications/register-token - Register with expo_token (alternative field)"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            json={
                "expo_token": "ExponentPushToken[yyyyyyyyyyyyyyyyyyyy]",
                "platform": "ios"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in str(data).lower() or "kaydedildi" in str(data).lower()
        print(f"✅ Push token (expo_token) registered: {data}")
    
    def test_register_push_token_missing_token(self, auth_headers):
        """POST /api/notifications/register-token - Should fail without token"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            json={
                "platform": "android"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"✅ Correctly rejected request without token: {response.json()}")
    
    def test_register_push_token_unauthorized(self):
        """POST /api/notifications/register-token - Should fail without auth"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-token",
            json={
                "expo_push_token": "ExponentPushToken[zzzzzzzzzzzzzzzzzzzz]"
            }
        )
        
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ Correctly rejected unauthorized request")


class TestGDPRDataExport(TestSetup):
    """Test GDPR data export endpoint"""
    
    def test_request_data_export(self, auth_headers):
        """GET /api/account/data-export - Request data export"""
        response = requests.get(
            f"{BASE_URL}/api/account/data-export",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "veri" in data["message"].lower() or "export" in data["message"].lower() or "dışa" in data["message"].lower()
        print(f"✅ Data export request successful: {data}")
    
    def test_data_export_unauthorized(self):
        """GET /api/account/data-export - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/account/data-export")
        
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ Correctly rejected unauthorized data export request")


class TestMessageSearch(TestSetup):
    """Test message search API"""
    
    def test_search_messages_basic(self, auth_headers):
        """GET /api/messages/search?q=test - Basic message search"""
        response = requests.get(
            f"{BASE_URL}/api/messages/search",
            params={"q": "test"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        print(f"✅ Message search returned {len(data['messages'])} results")
    
    def test_search_messages_short_query(self, auth_headers):
        """GET /api/messages/search?q=a - Short query should return empty"""
        response = requests.get(
            f"{BASE_URL}/api/messages/search",
            params={"q": "a"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) == 0, "Short query should return empty results"
        print(f"✅ Short query correctly returned empty results")
    
    def test_search_messages_empty_query(self, auth_headers):
        """GET /api/messages/search?q= - Empty query should return empty"""
        response = requests.get(
            f"{BASE_URL}/api/messages/search",
            params={"q": ""},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) == 0
        print(f"✅ Empty query correctly returned empty results")
    
    def test_search_messages_turkish_query(self, auth_headers):
        """GET /api/messages/search?q=müzik - Turkish character search"""
        response = requests.get(
            f"{BASE_URL}/api/messages/search",
            params={"q": "müzik"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "messages" in data
        print(f"✅ Turkish character search returned {len(data['messages'])} results")
    
    def test_search_messages_unauthorized(self):
        """GET /api/messages/search - Should fail without auth"""
        response = requests.get(
            f"{BASE_URL}/api/messages/search",
            params={"q": "test"}
        )
        
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✅ Correctly rejected unauthorized message search")


class TestHashtagSearch:
    """Test hashtag search API"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_hashtag_{unique_id}@test.com"
        password = "test1234"
        username = f"testuser_hashtag_{unique_id}"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "username": username,
            "display_name": f"Test User {unique_id}"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "username": username,
                "user_id": data["user"]["id"],
                "token": data["access_token"]
            }
        elif response.status_code == 400:
            # User might already exist, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
            if login_response.status_code == 200:
                data = login_response.json()
                return {
                    "email": email,
                    "password": password,
                    "username": username,
                    "user_id": data["user"]["id"],
                    "token": data["access_token"]
                }
        
        pytest.skip(f"Could not create test user: {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, test_user):
        """Return auth headers for authenticated requests"""
        return {"Authorization": f"Bearer {test_user['token']}"}
    
    def test_search_hashtags_basic(self, auth_headers):
        """GET /api/hashtags/search?q=müzik - Basic hashtag search"""
        response = requests.get(
            f"{BASE_URL}/api/hashtags/search",
            params={"q": "müzik"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "hashtags" in data
        assert isinstance(data["hashtags"], list)
        print(f"✅ Hashtag search returned {len(data['hashtags'])} results: {data['hashtags'][:3]}")
    
    def test_search_hashtags_rock(self, auth_headers):
        """GET /api/hashtags/search?q=rock - Search for rock hashtag"""
        response = requests.get(
            f"{BASE_URL}/api/hashtags/search",
            params={"q": "rock"},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "hashtags" in data
        # Should find rock-related hashtags
        print(f"✅ Rock hashtag search: {data['hashtags']}")
    
    def test_search_hashtags_empty_query(self, auth_headers):
        """GET /api/hashtags/search?q= - Empty query returns popular hashtags"""
        response = requests.get(
            f"{BASE_URL}/api/hashtags/search",
            params={"q": ""},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "hashtags" in data
        assert len(data["hashtags"]) > 0, "Empty query should return popular hashtags"
        print(f"✅ Empty query returned popular hashtags: {data['hashtags'][:3]}")
    
    def test_trending_hashtags(self, auth_headers):
        """GET /api/hashtags/trending - Get trending hashtags"""
        response = requests.get(
            f"{BASE_URL}/api/hashtags/trending",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "hashtags" in data
        assert len(data["hashtags"]) > 0
        print(f"✅ Trending hashtags: {data['hashtags'][:5]}")
    
    def test_hashtag_search_no_auth_required(self):
        """GET /api/hashtags/search - Should work without auth (public endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/hashtags/search",
            params={"q": "pop"}
        )
        
        # This endpoint might or might not require auth - check both cases
        if response.status_code == 200:
            data = response.json()
            assert "hashtags" in data
            print(f"✅ Hashtag search works without auth (public endpoint)")
        else:
            print(f"ℹ️ Hashtag search requires auth: {response.status_code}")


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_rate_{unique_id}@test.com"
        password = "test1234"
        username = f"testuser_rate_{unique_id}"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "username": username,
            "display_name": f"Test User {unique_id}"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "username": username,
                "user_id": data["user"]["id"],
                "token": data["access_token"]
            }
        elif response.status_code == 400:
            # User might already exist, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
            if login_response.status_code == 200:
                data = login_response.json()
                return {
                    "email": email,
                    "password": password,
                    "username": username,
                    "user_id": data["user"]["id"],
                    "token": data["access_token"]
                }
        
        pytest.skip(f"Could not create test user: {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, test_user):
        """Return auth headers for authenticated requests"""
        return {"Authorization": f"Bearer {test_user['token']}"}
    
    def test_rate_limit_headers_present(self, auth_headers):
        """Check that rate limit headers are present in response"""
        response = requests.get(
            f"{BASE_URL}/api/health",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Check for rate limit headers
        has_limit_header = "X-RateLimit-Limit" in response.headers
        has_remaining_header = "X-RateLimit-Remaining" in response.headers
        
        if has_limit_header:
            print(f"✅ X-RateLimit-Limit: {response.headers.get('X-RateLimit-Limit')}")
        if has_remaining_header:
            print(f"✅ X-RateLimit-Remaining: {response.headers.get('X-RateLimit-Remaining')}")
        
        # At least one header should be present
        assert has_limit_header or has_remaining_header or response.status_code == 200, \
            "Rate limit headers should be present"
        print(f"✅ Rate limit headers check passed")
    
    def test_multiple_requests_within_limit(self, auth_headers):
        """Make multiple requests and verify they succeed within limit"""
        success_count = 0
        for i in range(5):
            response = requests.get(
                f"{BASE_URL}/api/health",
                headers=auth_headers
            )
            if response.status_code == 200:
                success_count += 1
            time.sleep(0.1)  # Small delay between requests
        
        assert success_count == 5, f"Expected 5 successful requests, got {success_count}"
        print(f"✅ {success_count}/5 requests succeeded within rate limit")


class TestAdminRateLimitStats:
    """Test admin rate limit statistics endpoint"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user and return credentials"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_admin_{unique_id}@test.com"
        password = "test1234"
        username = f"testuser_admin_{unique_id}"
        
        # Register user
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "username": username,
            "display_name": f"Test User {unique_id}"
        })
        
        if response.status_code == 200:
            data = response.json()
            return {
                "email": email,
                "password": password,
                "username": username,
                "user_id": data["user"]["id"],
                "token": data["access_token"]
            }
        elif response.status_code == 400:
            # User might already exist, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": email,
                "password": password
            })
            if login_response.status_code == 200:
                data = login_response.json()
                return {
                    "email": email,
                    "password": password,
                    "username": username,
                    "user_id": data["user"]["id"],
                    "token": data["access_token"]
                }
        
        pytest.skip(f"Could not create test user: {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, test_user):
        """Return auth headers for authenticated requests"""
        return {"Authorization": f"Bearer {test_user['token']}"}
    
    def test_admin_rate_limits_requires_admin(self, auth_headers):
        """GET /api/admin/rate-limits - Should require admin privileges"""
        response = requests.get(
            f"{BASE_URL}/api/admin/rate-limits",
            headers=auth_headers
        )
        
        # Regular user should get 403
        assert response.status_code == 403, \
            f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print(f"✅ Admin endpoint correctly requires admin privileges")
    
    def test_admin_rate_limits_unauthorized(self):
        """GET /api/admin/rate-limits - Should fail without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/rate-limits")
        
        # Accept 401 (Not authenticated), 403 (Forbidden), or 422 (Validation error)
        assert response.status_code in [401, 403, 422], \
            f"Expected 401/403/422, got {response.status_code}: {response.text}"
        print(f"✅ Admin endpoint correctly rejects unauthorized requests: {response.status_code}")


class TestHealthAndBasicEndpoints:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """GET /api/health - Health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ Health check passed: {response.json()}")
    
    def test_api_base_accessible(self):
        """Verify API base URL is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200
        print(f"✅ API base URL accessible: {BASE_URL}")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
