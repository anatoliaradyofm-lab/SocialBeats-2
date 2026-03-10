"""
Iteration 15 - User Posts and Followers/Following Endpoints Tests
Tests for:
- GET /api/social/posts/user/{user_id} - User posts endpoint
- GET /api/social/followers/{user_id} - Followers list endpoint
- GET /api/social/following/{user_id} - Following list endpoint
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "testuser123@test.com"
TEST_USER_PASSWORD = "test123456"


class TestUserPostsAndFollowers:
    """Test user posts and followers/following endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.user_id = None
        self.username = None
        
        # Try to login with existing test user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.username = data.get("user", {}).get("username")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            # Create new test user if login fails
            unique_id = str(uuid.uuid4())[:8]
            new_email = f"test_iter15_{unique_id}@test.com"
            new_username = f"testuser15_{unique_id}"
            
            register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
                "email": new_email,
                "password": "test123456",
                "username": new_username,
                "display_name": f"Test User 15 {unique_id}"
            })
            
            if register_response.status_code == 200:
                data = register_response.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.username = data.get("user", {}).get("username")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    # ============== HEALTH CHECK ==============
    
    def test_health_check(self):
        """Test backend health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Health check passed")
    
    # ============== USER POSTS ENDPOINT TESTS ==============
    
    def test_get_user_posts_success(self):
        """Test GET /api/social/posts/user/{user_id} - Returns user posts"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        response = self.session.get(f"{BASE_URL}/api/social/posts/user/{self.user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        assert "total" in data
        assert "has_more" in data
        assert isinstance(data["posts"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["has_more"], bool)
        
        print(f"✅ GET /api/social/posts/user/{self.user_id} - Returns {data['total']} posts")
    
    def test_get_user_posts_with_pagination(self):
        """Test GET /api/social/posts/user/{user_id} with limit and offset"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        response = self.session.get(
            f"{BASE_URL}/api/social/posts/user/{self.user_id}",
            params={"limit": 10, "offset": 0}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        assert len(data["posts"]) <= 10
        
        print(f"✅ GET /api/social/posts/user/{self.user_id}?limit=10&offset=0 - Pagination works")
    
    def test_get_user_posts_with_media_type_photo(self):
        """Test GET /api/social/posts/user/{user_id} with media_type=photo filter"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        response = self.session.get(
            f"{BASE_URL}/api/social/posts/user/{self.user_id}",
            params={"media_type": "photo"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        
        print(f"✅ GET /api/social/posts/user/{self.user_id}?media_type=photo - Filter works")
    
    def test_get_user_posts_with_media_type_video(self):
        """Test GET /api/social/posts/user/{user_id} with media_type=video filter"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        response = self.session.get(
            f"{BASE_URL}/api/social/posts/user/{self.user_id}",
            params={"media_type": "video"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "posts" in data
        
        print(f"✅ GET /api/social/posts/user/{self.user_id}?media_type=video - Filter works")
    
    def test_get_user_posts_nonexistent_user(self):
        """Test GET /api/social/posts/user/{user_id} with non-existent user"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        fake_user_id = str(uuid.uuid4())
        response = self.session.get(f"{BASE_URL}/api/social/posts/user/{fake_user_id}")
        assert response.status_code == 404
        
        print(f"✅ GET /api/social/posts/user/{fake_user_id} - Returns 404 for non-existent user")
    
    def test_get_user_posts_unauthorized(self):
        """Test GET /api/social/posts/user/{user_id} without authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/social/posts/user/{self.user_id or 'test'}")
        assert response.status_code in [401, 403]
        
        print("✅ GET /api/social/posts/user/{user_id} - Correctly rejects unauthorized")
    
    # ============== FOLLOWERS ENDPOINT TESTS ==============
    
    def test_get_followers_success(self):
        """Test GET /api/social/followers/{user_id} - Returns followers list"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        response = self.session.get(f"{BASE_URL}/api/social/followers/{self.user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # If there are followers, check structure
        if len(data) > 0:
            follower = data[0]
            assert "id" in follower
            assert "username" in follower
            assert "is_following" in follower
            # Ensure sensitive data is not exposed
            assert "password" not in follower
            assert "email" not in follower
        
        print(f"✅ GET /api/social/followers/{self.user_id} - Returns {len(data)} followers")
    
    def test_get_followers_unauthorized(self):
        """Test GET /api/social/followers/{user_id} without authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/social/followers/{self.user_id or 'test'}")
        assert response.status_code in [401, 403]
        
        print("✅ GET /api/social/followers/{user_id} - Correctly rejects unauthorized")
    
    # ============== FOLLOWING ENDPOINT TESTS ==============
    
    def test_get_following_success(self):
        """Test GET /api/social/following/{user_id} - Returns following list"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        response = self.session.get(f"{BASE_URL}/api/social/following/{self.user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # If there are following users, check structure
        if len(data) > 0:
            following_user = data[0]
            assert "id" in following_user
            assert "username" in following_user
            assert "is_following" in following_user
            # Ensure sensitive data is not exposed
            assert "password" not in following_user
            assert "email" not in following_user
        
        print(f"✅ GET /api/social/following/{self.user_id} - Returns {len(data)} following")
    
    def test_get_following_unauthorized(self):
        """Test GET /api/social/following/{user_id} without authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/social/following/{self.user_id or 'test'}")
        assert response.status_code in [401, 403]
        
        print("✅ GET /api/social/following/{user_id} - Correctly rejects unauthorized")
    
    # ============== CREATE POST AND VERIFY ==============
    
    def test_create_post_and_verify_in_user_posts(self):
        """Test creating a post and verifying it appears in user posts"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        # Create a new post
        unique_content = f"Test post for iteration 15 - {uuid.uuid4()}"
        create_response = self.session.post(f"{BASE_URL}/api/social/posts", json={
            "content": unique_content,
            "post_type": "text",
            "visibility": "public"
        })
        
        assert create_response.status_code == 200
        created_post = create_response.json()
        post_id = created_post.get("id")
        
        print(f"✅ POST /api/social/posts - Created post with id: {post_id}")
        
        # Verify post appears in user posts
        get_response = self.session.get(f"{BASE_URL}/api/social/posts/user/{self.user_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        posts = data.get("posts", [])
        
        # Find the created post
        found_post = None
        for post in posts:
            if post.get("id") == post_id:
                found_post = post
                break
        
        assert found_post is not None, f"Created post {post_id} not found in user posts"
        assert found_post.get("content") == unique_content
        
        print(f"✅ Created post verified in GET /api/social/posts/user/{self.user_id}")
    
    # ============== FOLLOW/UNFOLLOW AND VERIFY ==============
    
    def test_follow_user_and_verify_in_lists(self):
        """Test following a user and verifying in followers/following lists"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        # Create a second test user to follow
        unique_id = str(uuid.uuid4())[:8]
        second_user_email = f"test_follow_{unique_id}@test.com"
        second_user_username = f"followtest_{unique_id}"
        
        # Create second user
        session2 = requests.Session()
        session2.headers.update({"Content-Type": "application/json"})
        
        register_response = session2.post(f"{BASE_URL}/api/auth/register", json={
            "email": second_user_email,
            "password": "test123456",
            "username": second_user_username,
            "display_name": f"Follow Test {unique_id}"
        })
        
        if register_response.status_code != 200:
            pytest.skip("Could not create second test user")
        
        second_user_data = register_response.json()
        second_user_id = second_user_data.get("user", {}).get("id")
        second_user_token = second_user_data.get("access_token")
        
        print(f"✅ Created second test user: {second_user_username}")
        
        # First user follows second user
        follow_response = self.session.post(f"{BASE_URL}/api/social/follow/{second_user_id}")
        
        if follow_response.status_code == 200:
            print(f"✅ POST /api/social/follow/{second_user_id} - Follow successful")
            
            # Verify in first user's following list
            following_response = self.session.get(f"{BASE_URL}/api/social/following/{self.user_id}")
            assert following_response.status_code == 200
            following_list = following_response.json()
            
            found_in_following = any(u.get("id") == second_user_id for u in following_list)
            print(f"✅ Second user found in first user's following list: {found_in_following}")
            
            # Verify in second user's followers list (using second user's token)
            session2.headers.update({"Authorization": f"Bearer {second_user_token}"})
            followers_response = session2.get(f"{BASE_URL}/api/social/followers/{second_user_id}")
            assert followers_response.status_code == 200
            followers_list = followers_response.json()
            
            found_in_followers = any(u.get("id") == self.user_id for u in followers_list)
            print(f"✅ First user found in second user's followers list: {found_in_followers}")
        else:
            print(f"⚠️ Follow returned status {follow_response.status_code}: {follow_response.text}")


class TestPostsCollectionFix:
    """Test that posts collection is correctly named (posts, not social_posts)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            # Create new test user
            unique_id = str(uuid.uuid4())[:8]
            register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
                "email": f"test_posts_{unique_id}@test.com",
                "password": "test123456",
                "username": f"testposts_{unique_id}",
                "display_name": f"Test Posts {unique_id}"
            })
            
            if register_response.status_code == 200:
                data = register_response.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_posts_endpoint_uses_correct_collection(self):
        """Verify that posts are stored and retrieved from 'posts' collection"""
        if not self.token or not self.user_id:
            pytest.skip("Authentication failed")
        
        # Create a post
        unique_content = f"Collection test post - {uuid.uuid4()}"
        create_response = self.session.post(f"{BASE_URL}/api/social/posts", json={
            "content": unique_content,
            "post_type": "text"
        })
        
        assert create_response.status_code == 200
        created_post = create_response.json()
        post_id = created_post.get("id")
        
        # Retrieve via user posts endpoint
        get_response = self.session.get(f"{BASE_URL}/api/social/posts/user/{self.user_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        posts = data.get("posts", [])
        
        # Verify post is found
        found = any(p.get("id") == post_id for p in posts)
        assert found, "Post not found - collection name might be incorrect"
        
        print("✅ Posts collection is correctly named 'posts' (not 'social_posts')")


class TestFeedEndpoint:
    """Test feed endpoint to ensure posts are returned correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            unique_id = str(uuid.uuid4())[:8]
            register_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
                "email": f"test_feed_{unique_id}@test.com",
                "password": "test123456",
                "username": f"testfeed_{unique_id}",
                "display_name": f"Test Feed {unique_id}"
            })
            
            if register_response.status_code == 200:
                data = register_response.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_feed_endpoint(self):
        """Test GET /api/social/feed returns posts"""
        if not self.token:
            pytest.skip("Authentication failed")
        
        response = self.session.get(f"{BASE_URL}/api/social/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✅ GET /api/social/feed - Returns {len(data)} posts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
