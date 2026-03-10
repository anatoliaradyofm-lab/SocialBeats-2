"""
Iteration 32 - Communities and Gamification Router Tests
Tests for refactored endpoints moved from server.py to dedicated router files:
- /app/backend/routes/communities.py - Community CRUD endpoints
- /app/backend/routes/gamification.py - Badges, levels, leaderboard
"""

import pytest
import requests
import os
import uuid
from datetime import datetime
import time

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use existing test users to avoid rate limiting
TEST_USER_EMAIL = "test_social@test.com"
TEST_USER_PASSWORD = "Test123!"

TEST_USER2_EMAIL = "test_social2@test.com"
TEST_USER2_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Could not get auth token - user may not exist")


@pytest.fixture(scope="module")
def auth_token2():
    """Get auth token for second test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER2_EMAIL,
        "password": TEST_USER2_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Could not get auth token for second user")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def auth_headers2(auth_token2):
    """Get auth headers for second user"""
    return {"Authorization": f"Bearer {auth_token2}"}


class TestHealthEndpoint:
    """Test health endpoint"""
    
    def test_health_endpoint(self):
        """GET /api/health - Health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ GET /api/health - Status: healthy")


class TestGamificationLevels:
    """Test gamification levels endpoint from routes/gamification.py"""
    
    def test_get_levels(self):
        """GET /api/gamification/levels - Get all level definitions (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/gamification/levels")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify level structure
        first_level = data[0]
        assert "level" in first_level
        assert "name" in first_level
        assert "xp_required" in first_level
        print(f"✅ GET /api/gamification/levels - Found {len(data)} levels")


class TestGamificationBadges:
    """Test gamification badges endpoint from routes/gamification.py"""
    
    def test_get_badges(self):
        """GET /api/gamification/badges - Get all available badges (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/gamification/badges")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify badge structure
        first_badge = data[0]
        assert "type" in first_badge
        assert "name" in first_badge
        assert "description" in first_badge
        assert "icon" in first_badge
        assert "xp" in first_badge
        print(f"✅ GET /api/gamification/badges - Found {len(data)} badges")


class TestGamificationLeaderboard:
    """Test gamification leaderboard endpoint from routes/gamification.py"""
    
    def test_get_leaderboard(self):
        """GET /api/gamification/leaderboard - Get XP leaderboard (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/gamification/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify leaderboard entry structure if not empty
        if len(data) > 0:
            first_entry = data[0]
            assert "rank" in first_entry
            assert "user" in first_entry
            assert "xp" in first_entry
            assert "level" in first_entry
        print(f"✅ GET /api/gamification/leaderboard - Found {len(data)} entries")
    
    def test_get_leaderboard_with_limit(self):
        """GET /api/gamification/leaderboard?limit=5 - With limit parameter"""
        response = requests.get(f"{BASE_URL}/api/gamification/leaderboard?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5
        print("✅ GET /api/gamification/leaderboard?limit=5 - Limit works")


class TestCommunitiesGet:
    """Test communities GET endpoints from routes/communities.py"""
    
    def test_get_communities(self, auth_headers):
        """GET /api/communities - Get communities list"""
        response = requests.get(f"{BASE_URL}/api/communities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/communities - Found {len(data)} communities")
    
    def test_get_communities_by_genre(self, auth_headers):
        """GET /api/communities?genre=Rock - Filter by genre"""
        response = requests.get(f"{BASE_URL}/api/communities?genre=Rock", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned communities should have Rock genre
        for comm in data:
            if comm.get("genre"):
                assert comm["genre"] == "Rock"
        print(f"✅ GET /api/communities?genre=Rock - Found {len(data)} Rock communities")


class TestCommunitiesCreate:
    """Test communities create endpoint from routes/communities.py"""
    
    created_community_id = None
    
    def test_create_community(self, auth_headers):
        """POST /api/communities - Create a new community"""
        community_name = f"TEST_iter32_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/communities", headers=auth_headers, json={
            "name": community_name,
            "description": "Test community for iteration 32",
            "community_type": "general",
            "genre": "Electronic"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["name"] == community_name
        assert data["is_member"] == True
        assert data["is_admin"] == True
        TestCommunitiesCreate.created_community_id = data["id"]
        print(f"✅ POST /api/communities - Created: {community_name}")
    
    def test_get_created_community(self, auth_headers):
        """GET /api/communities/{id} - Get the created community"""
        if not TestCommunitiesCreate.created_community_id:
            pytest.skip("No community created")
        
        response = requests.get(
            f"{BASE_URL}/api/communities/{TestCommunitiesCreate.created_community_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TestCommunitiesCreate.created_community_id
        assert data["is_member"] == True
        print(f"✅ GET /api/communities/{TestCommunitiesCreate.created_community_id[:8]}...")


class TestCommunitiesJoinLeave:
    """Test communities join/leave endpoints from routes/communities.py"""
    
    test_community_id = None
    
    def test_create_community_for_join_test(self, auth_headers):
        """Create a community for join/leave testing"""
        community_name = f"TEST_join_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/communities", headers=auth_headers, json={
            "name": community_name,
            "description": "Test community for join/leave",
            "community_type": "general"
        })
        assert response.status_code == 200
        data = response.json()
        TestCommunitiesJoinLeave.test_community_id = data["id"]
        print(f"✅ Created community for join test: {community_name}")
    
    def test_second_user_join_community(self, auth_headers2):
        """POST /api/communities/{id}/join - Second user joins"""
        if not TestCommunitiesJoinLeave.test_community_id:
            pytest.skip("No community created")
        
        response = requests.post(
            f"{BASE_URL}/api/communities/{TestCommunitiesJoinLeave.test_community_id}/join",
            headers=auth_headers2
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✅ POST /api/communities/{id}/join - Second user joined")
    
    def test_second_user_leave_community(self, auth_headers2):
        """DELETE /api/communities/{id}/leave - Second user leaves"""
        if not TestCommunitiesJoinLeave.test_community_id:
            pytest.skip("No community created")
        
        response = requests.delete(
            f"{BASE_URL}/api/communities/{TestCommunitiesJoinLeave.test_community_id}/leave",
            headers=auth_headers2
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✅ DELETE /api/communities/{id}/leave - Second user left")
    
    def test_leave_not_member(self, auth_headers2):
        """DELETE /api/communities/{id}/leave - Should fail if not member"""
        if not TestCommunitiesJoinLeave.test_community_id:
            pytest.skip("No community created")
        
        response = requests.delete(
            f"{BASE_URL}/api/communities/{TestCommunitiesJoinLeave.test_community_id}/leave",
            headers=auth_headers2
        )
        assert response.status_code == 400
        print("✅ DELETE /api/communities/{id}/leave - Not member returns 400")
    
    def test_admin_cannot_leave_as_only_admin(self, auth_headers):
        """DELETE /api/communities/{id}/leave - Admin cannot leave as only admin"""
        if not TestCommunitiesJoinLeave.test_community_id:
            pytest.skip("No community created")
        
        response = requests.delete(
            f"{BASE_URL}/api/communities/{TestCommunitiesJoinLeave.test_community_id}/leave",
            headers=auth_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "Cannot leave as the only admin" in data.get("detail", "")
        print("✅ DELETE /api/communities/{id}/leave - Only admin cannot leave")


class TestCommunitiesMembers:
    """Test communities members endpoint from routes/communities.py"""
    
    def test_get_community_members(self, auth_headers):
        """GET /api/communities/{id}/members - Get community members"""
        # First get a community
        response = requests.get(f"{BASE_URL}/api/communities", headers=auth_headers)
        if response.status_code != 200 or not response.json():
            pytest.skip("No communities available")
        
        community_id = response.json()[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/communities/{community_id}/members",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/communities/{community_id[:8]}../members - Found {len(data)} members")


class TestSocialFeed:
    """Test social feed endpoint"""
    
    def test_get_social_feed(self, auth_headers):
        """GET /api/social/feed - Get main social feed"""
        response = requests.get(f"{BASE_URL}/api/social/feed", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/feed - Found {len(data)} posts")


class TestSocialPosts:
    """Test social posts endpoint"""
    
    def test_create_and_get_post(self, auth_headers):
        """POST /api/social/posts - Create a post and GET it"""
        # Create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"Test post for iteration 32 - {uuid.uuid4().hex[:8]}",
            "post_type": "text",
            "visibility": "public"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        post_id = data["id"]
        print(f"✅ POST /api/social/posts - Created post: {post_id[:8]}...")
        
        # Get the post
        response = requests.get(f"{BASE_URL}/api/social/posts/{post_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == post_id
        print(f"✅ GET /api/social/posts/{post_id[:8]}... - Retrieved post")


class TestAuthEndpoints:
    """Test auth endpoints"""
    
    def test_auth_login(self):
        """POST /api/auth/login - Login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        # Accept 200 (success) or 429 (rate limited - expected behavior)
        assert response.status_code in [200, 429]
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "user" in data
            print("✅ POST /api/auth/login - Login successful")
        else:
            print("⚠️ POST /api/auth/login - Rate limited (429) - expected behavior")
    
    def test_auth_me(self, auth_headers):
        """GET /api/auth/me - Get current user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "username" in data
        print(f"✅ GET /api/auth/me - User: {data['username']}")


class TestNoRouteConflicts:
    """Test that there are no route conflicts between routers"""
    
    def test_communities_route_works(self, auth_headers):
        """Verify /api/communities doesn't conflict with other routes"""
        response = requests.get(f"{BASE_URL}/api/communities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print("✅ /api/communities - No route conflicts")
    
    def test_gamification_routes_work(self):
        """Verify gamification routes don't conflict"""
        # Test levels
        response = requests.get(f"{BASE_URL}/api/gamification/levels")
        assert response.status_code == 200
        
        # Test badges
        response = requests.get(f"{BASE_URL}/api/gamification/badges")
        assert response.status_code == 200
        
        # Test leaderboard
        response = requests.get(f"{BASE_URL}/api/gamification/leaderboard")
        assert response.status_code == 200
        
        print("✅ /api/gamification/* - No route conflicts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
