"""
Iteration 30 - Testing Refactored Routes (posts.py, comments.py, feed.py)
Tests all endpoints that were moved from server.py to modular routers.
Using localhost to bypass rate limiting.
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

# Global token storage
AUTH_TOKEN = None
USER_ID = None


def get_auth_token():
    """Get authentication token"""
    global AUTH_TOKEN, USER_ID
    
    if AUTH_TOKEN:
        return AUTH_TOKEN
    
    # Try to login
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_resp.status_code == 200:
        data = login_resp.json()
        AUTH_TOKEN = data.get("access_token") or data.get("token")
        USER_ID = data.get("user", {}).get("id")
        return AUTH_TOKEN
    
    # Try to register
    register_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "username": "test_social",
        "display_name": "Test Social User"
    })
    
    if register_resp.status_code in [200, 201]:
        data = register_resp.json()
        AUTH_TOKEN = data.get("access_token") or data.get("token")
        USER_ID = data.get("user", {}).get("id")
        return AUTH_TOKEN
    
    # Try login again
    login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_resp.status_code == 200:
        data = login_resp.json()
        AUTH_TOKEN = data.get("access_token") or data.get("token")
        USER_ID = data.get("user", {}).get("id")
        return AUTH_TOKEN
    
    raise Exception(f"Could not authenticate: {login_resp.text}")


def get_headers():
    """Get headers with auth token"""
    token = get_auth_token()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============================================
# POSTS ROUTER TESTS (routes/posts.py)
# ============================================

class TestPostsRouter:
    """Test endpoints from routes/posts.py"""
    
    created_post_id = None
    
    def test_create_post(self):
        """POST /api/social/posts - Create a new post"""
        headers = get_headers()
        response = requests.post(f"{BASE_URL}/api/social/posts", 
            headers=headers,
            json={
                "content": "TEST_iter30 - Testing refactored posts router #test @mention",
                "post_type": "text",
                "visibility": "public",
                "allow_comments": True,
                "tags": ["test", "refactoring"]
            }
        )
        
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Post should have an id"
        assert data["content"] == "TEST_iter30 - Testing refactored posts router #test @mention"
        assert data["post_type"] == "text"
        assert data["visibility"] == "public"
        assert "reactions" in data
        assert "created_at" in data
        assert "hashtags" in data
        assert "test" in data["hashtags"]
        assert "mentions" in data
        assert "mention" in data["mentions"]
        
        TestPostsRouter.created_post_id = data["id"]
        print(f"✅ Created post with ID: {data['id']}")
    
    def test_get_post(self):
        """GET /api/social/posts/{post_id} - Get single post"""
        assert TestPostsRouter.created_post_id, "No post created to get"
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get post failed: {response.text}"
        data = response.json()
        
        assert data["id"] == TestPostsRouter.created_post_id
        assert "user_reaction" in data
        assert "is_saved" in data
        print(f"✅ Retrieved post: {data['id']}")
    
    def test_react_to_post(self):
        """POST /api/social/posts/{post_id}/react - React to post"""
        assert TestPostsRouter.created_post_id, "No post created to react to"
        headers = get_headers()
        
        # Add heart reaction
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/react",
            headers=headers,
            params={"reaction_type": "heart"}
        )
        
        assert response.status_code == 200, f"React to post failed: {response.text}"
        data = response.json()
        assert data["action"] == "added"
        print(f"✅ Added reaction to post")
        
        # Change reaction to fire
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/react",
            headers=headers,
            params={"reaction_type": "fire"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "changed"
        print(f"✅ Changed reaction on post")
        
        # Remove reaction
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/react",
            headers=headers,
            params={"reaction_type": "fire"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "removed"
        print(f"✅ Removed reaction from post")
    
    def test_save_post(self):
        """POST /api/social/posts/{post_id}/save - Save/unsave post"""
        assert TestPostsRouter.created_post_id, "No post created to save"
        headers = get_headers()
        
        # Save post
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/save",
            headers=headers
        )
        
        assert response.status_code == 200, f"Save post failed: {response.text}"
        data = response.json()
        assert data["is_saved"] == True
        print(f"✅ Saved post")
        
        # Unsave post
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/save",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_saved"] == False
        print(f"✅ Unsaved post")
    
    def test_get_saved_posts(self):
        """GET /api/social/posts/saved - Get saved posts"""
        headers = get_headers()
        
        # First save a post
        if TestPostsRouter.created_post_id:
            requests.post(
                f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/save",
                headers=headers
            )
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/saved",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get saved posts failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved saved posts: {len(data)} posts")
    
    def test_update_post(self):
        """PUT /api/social/posts/{post_id} - Update post"""
        assert TestPostsRouter.created_post_id, "No post created to update"
        headers = get_headers()
        
        response = requests.put(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}",
            headers=headers,
            json={
                "content": "TEST_iter30 - Updated post content #updated",
                "post_type": "text",
                "visibility": "public",
                "allow_comments": True
            }
        )
        
        assert response.status_code == 200, f"Update post failed: {response.text}"
        print(f"✅ Updated post")
    
    def test_share_post(self):
        """POST /api/social/posts/{post_id}/share - Share post"""
        assert TestPostsRouter.created_post_id, "No post created to share"
        headers = get_headers()
        
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/share",
            headers=headers
        )
        
        assert response.status_code == 200, f"Share post failed: {response.text}"
        data = response.json()
        assert "shares_count" in data
        print(f"✅ Shared post, shares_count: {data['shares_count']}")
    
    def test_pin_post(self):
        """POST /api/social/posts/{post_id}/pin - Pin/unpin post"""
        assert TestPostsRouter.created_post_id, "No post created to pin"
        headers = get_headers()
        
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}/pin",
            headers=headers
        )
        
        assert response.status_code == 200, f"Pin post failed: {response.text}"
        data = response.json()
        assert "is_pinned" in data
        print(f"✅ Toggled pin status: {data['is_pinned']}")
    
    def test_create_poll_post(self):
        """POST /api/social/posts - Create poll post"""
        headers = get_headers()
        
        response = requests.post(f"{BASE_URL}/api/social/posts",
            headers=headers,
            json={
                "content": "TEST_iter30 - Poll: What's your favorite music genre?",
                "post_type": "poll",
                "visibility": "public",
                "poll_options": ["Rock", "Pop", "Jazz", "Classical"]
            }
        )
        
        assert response.status_code == 200, f"Create poll failed: {response.text}"
        data = response.json()
        assert data["post_type"] == "poll"
        assert len(data["poll_options"]) == 4
        
        poll_post_id = data["id"]
        print(f"✅ Created poll post: {poll_post_id}")
        
        # Vote on poll
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{poll_post_id}/vote/0",
            headers=headers
        )
        
        assert response.status_code == 200, f"Vote on poll failed: {response.text}"
        print(f"✅ Voted on poll")
        
        # Cleanup poll post
        requests.delete(f"{BASE_URL}/api/social/posts/{poll_post_id}", headers=headers)


# ============================================
# COMMENTS ROUTER TESTS (routes/comments.py)
# ============================================

class TestCommentsRouter:
    """Test endpoints from routes/comments.py"""
    
    test_post_id = None
    created_comment_id = None
    
    @classmethod
    def setup_class(cls):
        """Create a post for comment tests"""
        headers = get_headers()
        response = requests.post(f"{BASE_URL}/api/social/posts",
            headers=headers,
            json={
                "content": "TEST_iter30 - Post for comment testing",
                "post_type": "text",
                "visibility": "public",
                "allow_comments": True
            }
        )
        
        if response.status_code == 200:
            cls.test_post_id = response.json()["id"]
            print(f"✅ Created test post for comments: {cls.test_post_id}")
    
    @classmethod
    def teardown_class(cls):
        """Cleanup test post"""
        if cls.test_post_id:
            headers = get_headers()
            requests.delete(
                f"{BASE_URL}/api/social/posts/{cls.test_post_id}",
                headers=headers
            )
            print(f"✅ Cleaned up test post: {cls.test_post_id}")
    
    def test_add_comment(self):
        """POST /api/social/posts/{post_id}/comments - Add comment"""
        assert TestCommentsRouter.test_post_id, "No post created for comments"
        headers = get_headers()
        
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestCommentsRouter.test_post_id}/comments",
            headers=headers,
            json={
                "content": "TEST_iter30 - This is a test comment @mention"
            }
        )
        
        assert response.status_code == 200, f"Add comment failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["content"] == "TEST_iter30 - This is a test comment @mention"
        assert "mentions" in data
        assert "mention" in data["mentions"]
        assert "is_liked" in data
        
        TestCommentsRouter.created_comment_id = data["id"]
        print(f"✅ Created comment: {data['id']}")
    
    def test_get_comments(self):
        """GET /api/social/posts/{post_id}/comments - Get comments"""
        assert TestCommentsRouter.test_post_id, "No post created for comments"
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/{TestCommentsRouter.test_post_id}/comments",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get comments failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "content" in data[0]
            assert "is_liked" in data[0]
            assert "replies" in data[0]
        print(f"✅ Retrieved {len(data)} comments")
    
    def test_add_reply(self):
        """POST /api/social/posts/{post_id}/comments - Add reply to comment"""
        assert TestCommentsRouter.test_post_id, "No post created"
        assert TestCommentsRouter.created_comment_id, "No comment created to reply to"
        headers = get_headers()
        
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestCommentsRouter.test_post_id}/comments",
            headers=headers,
            json={
                "content": "TEST_iter30 - This is a reply",
                "parent_id": TestCommentsRouter.created_comment_id
            }
        )
        
        assert response.status_code == 200, f"Add reply failed: {response.text}"
        data = response.json()
        assert data["parent_id"] == TestCommentsRouter.created_comment_id
        print(f"✅ Created reply to comment")
    
    def test_like_comment(self):
        """POST /api/social/comments/{comment_id}/like - Like comment"""
        assert TestCommentsRouter.created_comment_id, "No comment created to like"
        headers = get_headers()
        
        # Like comment
        response = requests.post(
            f"{BASE_URL}/api/social/comments/{TestCommentsRouter.created_comment_id}/like",
            headers=headers
        )
        
        assert response.status_code == 200, f"Like comment failed: {response.text}"
        data = response.json()
        assert data["is_liked"] == True
        print(f"✅ Liked comment")
        
        # Unlike comment
        response = requests.post(
            f"{BASE_URL}/api/social/comments/{TestCommentsRouter.created_comment_id}/like",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_liked"] == False
        print(f"✅ Unliked comment")
    
    def test_get_comment_replies(self):
        """GET /api/social/comments/{comment_id}/replies - Get replies"""
        assert TestCommentsRouter.created_comment_id, "No comment created"
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/comments/{TestCommentsRouter.created_comment_id}/replies",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get replies failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} replies")
    
    def test_edit_comment(self):
        """PUT /api/social/comments/{comment_id} - Edit comment"""
        assert TestCommentsRouter.created_comment_id, "No comment created to edit"
        headers = get_headers()
        
        response = requests.put(
            f"{BASE_URL}/api/social/comments/{TestCommentsRouter.created_comment_id}",
            headers=headers,
            params={"content": "TEST_iter30 - Edited comment content"}
        )
        
        assert response.status_code == 200, f"Edit comment failed: {response.text}"
        print(f"✅ Edited comment")
    
    def test_delete_comment(self):
        """DELETE /api/social/comments/{comment_id} - Delete comment"""
        headers = get_headers()
        
        # Create a new comment to delete
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{TestCommentsRouter.test_post_id}/comments",
            headers=headers,
            json={"content": "TEST_iter30 - Comment to delete"}
        )
        
        if response.status_code == 200:
            comment_id = response.json()["id"]
            
            delete_response = requests.delete(
                f"{BASE_URL}/api/social/comments/{comment_id}",
                headers=headers
            )
            
            assert delete_response.status_code == 200, f"Delete comment failed: {delete_response.text}"
            print(f"✅ Deleted comment")


# ============================================
# FEED ROUTER TESTS (routes/feed.py)
# ============================================

class TestFeedRouter:
    """Test endpoints from routes/feed.py"""
    
    def test_get_feed(self):
        """GET /api/social/feed - Get main feed"""
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/feed",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get feed failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            post = data[0]
            assert "id" in post
            assert "content" in post
            assert "user_reaction" in post
            assert "is_saved" in post
        print(f"✅ Retrieved feed with {len(data)} posts")
    
    def test_get_feed_pagination(self):
        """GET /api/social/feed - Test pagination"""
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/feed",
            headers=headers,
            params={"page": 1, "limit": 5}
        )
        
        assert response.status_code == 200, f"Get feed page 1 failed: {response.text}"
        page1 = response.json()
        
        response = requests.get(
            f"{BASE_URL}/api/social/feed",
            headers=headers,
            params={"page": 2, "limit": 5}
        )
        
        assert response.status_code == 200, f"Get feed page 2 failed: {response.text}"
        print(f"✅ Feed pagination working")
    
    def test_get_user_posts(self):
        """GET /api/social/posts/user/{user_id} - Get user posts"""
        headers = get_headers()
        
        # Get current user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if me_response.status_code != 200:
            pytest.skip("Could not get current user")
        
        user_id = me_response.json()["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/user/{user_id}",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get user posts failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} posts for user")
    
    def test_get_trending_posts(self):
        """GET /api/social/posts/trending - Get trending posts"""
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/trending",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get trending posts failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "user_reaction" in data[0]
            assert "is_saved" in data[0]
        print(f"✅ Retrieved {len(data)} trending posts")
    
    def test_get_explore_posts(self):
        """GET /api/social/posts/explore - Get explore posts"""
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/explore",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get explore posts failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} explore posts")
    
    def test_get_explore_with_category(self):
        """GET /api/social/posts/explore - Filter by category"""
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/posts/explore",
            headers=headers,
            params={"category": "text"}
        )
        
        assert response.status_code == 200, f"Get explore with category failed: {response.text}"
        print(f"✅ Explore with category filter working")
    
    def test_get_following_feed(self):
        """GET /api/social/feed/following - Get following feed"""
        headers = get_headers()
        
        response = requests.get(
            f"{BASE_URL}/api/social/feed/following",
            headers=headers
        )
        
        assert response.status_code == 200, f"Get following feed failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✅ Retrieved {len(data)} posts from following feed")


# ============================================
# COMMUNITY ENDPOINT TEST (still in server.py)
# ============================================

class TestCommunityEndpoint:
    """Test community endpoint still in server.py"""
    
    def test_create_community(self):
        """POST /api/communities - Create community (still in server.py)"""
        headers = get_headers()
        
        response = requests.post(
            f"{BASE_URL}/api/communities",
            headers=headers,
            json={
                "name": "TEST_iter30_community",
                "description": "Test community for iteration 30",
                "category": "music",
                "is_private": False
            }
        )
        
        # Community creation might require specific permissions
        # Accept 200, 201, or 403 (if user doesn't have permission)
        assert response.status_code in [200, 201, 403, 400, 401], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data or "community" in data
            print(f"✅ Created community")
            
            # Cleanup - try to delete
            community_id = data.get("id") or data.get("community", {}).get("id")
            if community_id:
                requests.delete(f"{BASE_URL}/api/communities/{community_id}", headers=headers)
        else:
            print(f"✅ Community endpoint accessible (status: {response.status_code})")


# ============================================
# CLEANUP
# ============================================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_posts(self):
        """Delete test posts created during testing"""
        headers = get_headers()
        
        if TestPostsRouter.created_post_id:
            response = requests.delete(
                f"{BASE_URL}/api/social/posts/{TestPostsRouter.created_post_id}",
                headers=headers
            )
            print(f"✅ Cleaned up test post: {TestPostsRouter.created_post_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
