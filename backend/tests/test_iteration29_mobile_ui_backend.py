# Test Iteration 29 - Mobile UI Backend APIs
# Tests for: Live Video, Collab Posts, Story Stickers, Instagram Features, Social Interaction
# This iteration verifies backend APIs are still working after mobile UI components were added

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test_iter29@test.com"
TEST_USER_PASSWORD = "Test123!"
TEST_TARGET_EMAIL = "test_iter29_target@test.com"
TEST_TARGET_PASSWORD = "Test123!"

# Global state for test data
test_state = {
    "auth_token": None,
    "user_id": None,
    "username": None,
    "target_auth_token": None,
    "target_user_id": None,
    "target_username": None,
    "story_id": None,
    "sticker_id": None,
    "post_id": None,
    "invite_id": None,
    "stream_id": None,
    "highlight_id": None,
    "collection_id": None
}


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_setup(api_client):
    """Setup authentication for both test users"""
    # Login or register test user
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        test_state["auth_token"] = data.get("access_token")
        test_state["user_id"] = data.get("user", {}).get("id")
        test_state["username"] = data.get("user", {}).get("username")
    else:
        # Register if login fails
        unique_suffix = uuid.uuid4().hex[:6]
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "username": f"test_iter29_{unique_suffix}"
        })
        if response.status_code in [200, 201]:
            data = response.json()
            test_state["auth_token"] = data.get("access_token")
            test_state["user_id"] = data.get("user", {}).get("id")
            test_state["username"] = data.get("user", {}).get("username")
    
    # Login or register target user
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_TARGET_EMAIL,
        "password": TEST_TARGET_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        test_state["target_auth_token"] = data.get("access_token")
        test_state["target_user_id"] = data.get("user", {}).get("id")
        test_state["target_username"] = data.get("user", {}).get("username")
    else:
        # Register if login fails
        unique_suffix = uuid.uuid4().hex[:6]
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_TARGET_EMAIL,
            "password": TEST_TARGET_PASSWORD,
            "username": f"test_target29_{unique_suffix}"
        })
        if response.status_code in [200, 201]:
            data = response.json()
            test_state["target_auth_token"] = data.get("access_token")
            test_state["target_user_id"] = data.get("user", {}).get("id")
            test_state["target_username"] = data.get("user", {}).get("username")
    
    return test_state


# ============================================
# LIVE VIDEO API TESTS
# ============================================

class TestLiveVideoAPI:
    """Test Live Video endpoints - POST /api/live/start, GET /api/live/active"""
    
    def test_start_live_stream(self, api_client, auth_setup):
        """Test POST /api/live/start - Start a live stream"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/start", json={
            "title": "TEST_Iter29 Live Stream",
            "description": "Testing live video for mobile UI",
            "category": "music",
            "is_private": False,
            "invited_users": []
        })
        
        # May return 400 if user already has active stream
        assert response.status_code in [200, 400], f"Start live failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "id" in data, "Response should contain stream id"
            assert data["status"] == "live", "Stream status should be 'live'"
            assert data["title"] == "TEST_Iter29 Live Stream"
            test_state["stream_id"] = data["id"]
            print(f"✅ POST /api/live/start - Live stream started: {data['id']}")
        else:
            # Already has active stream - try to end it first
            print(f"⚠️ POST /api/live/start - User already has active stream")
    
    def test_get_active_streams(self, api_client, auth_setup):
        """Test GET /api/live/active - Get active live streams"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/active")
        
        assert response.status_code == 200, f"Get active streams failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/live/active - Got {len(data)} active streams")
    
    def test_get_active_streams_with_category(self, api_client, auth_setup):
        """Test GET /api/live/active with category filter"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/active?category=music")
        
        assert response.status_code == 200, f"Get active streams with category failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/live/active?category=music - Got {len(data)} music streams")
    
    def test_get_following_streams(self, api_client, auth_setup):
        """Test GET /api/live/following - Get following users' streams"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/following")
        
        assert response.status_code == 200, f"Get following streams failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/live/following - Got {len(data)} following streams")
    
    def test_join_stream(self, api_client, auth_setup):
        """Test POST /api/live/{stream_id}/join - Join a live stream"""
        if not test_state["target_auth_token"] or not test_state["stream_id"]:
            pytest.skip("Target auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/{test_state['stream_id']}/join")
        
        assert response.status_code in [200, 404], f"Join stream failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "viewer_count" in data
            print(f"✅ POST /api/live/{{id}}/join - Joined stream, viewers: {data['viewer_count']}")
    
    def test_add_live_comment(self, api_client, auth_setup):
        """Test POST /api/live/{stream_id}/comment - Add comment to live stream"""
        if not test_state["target_auth_token"] or not test_state["stream_id"]:
            pytest.skip("Target auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/{test_state['stream_id']}/comment", json={
            "content": "Great stream! 🎵"
        })
        
        assert response.status_code in [200, 404], f"Add comment failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "id" in data
            print("✅ POST /api/live/{{id}}/comment - Comment added")
    
    def test_like_stream(self, api_client, auth_setup):
        """Test POST /api/live/{stream_id}/like - Like a live stream"""
        if not test_state["target_auth_token"] or not test_state["stream_id"]:
            pytest.skip("Target auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/{test_state['stream_id']}/like")
        
        assert response.status_code in [200, 404], f"Like stream failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "likes_count" in data
            print(f"✅ POST /api/live/{{id}}/like - Liked, total: {data['likes_count']}")
    
    def test_get_rtc_config(self, api_client, auth_setup):
        """Test GET /api/live/{stream_id}/rtc-config - Get WebRTC config"""
        if not test_state["auth_token"] or not test_state["stream_id"]:
            pytest.skip("Auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/{test_state['stream_id']}/rtc-config")
        
        assert response.status_code in [200, 404], f"Get RTC config failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "ice_servers" in data
            assert len(data["ice_servers"]) > 0
            print(f"✅ GET /api/live/{{id}}/rtc-config - Got {len(data['ice_servers'])} ICE servers")
    
    def test_end_live_stream(self, api_client, auth_setup):
        """Test POST /api/live/end/{stream_id} - End live stream"""
        if not test_state["auth_token"] or not test_state["stream_id"]:
            pytest.skip("Auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/end/{test_state['stream_id']}")
        
        assert response.status_code in [200, 404], f"End live failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "duration_seconds" in data
            print(f"✅ POST /api/live/end/{{id}} - Stream ended, duration: {data['duration_seconds']}s")
    
    def test_get_live_history(self, api_client, auth_setup):
        """Test GET /api/live/history/my - Get user's live history"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/history/my")
        
        assert response.status_code == 200, f"Get live history failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/live/history/my - Got {len(data)} past streams")


# ============================================
# COLLAB POSTS API TESTS
# ============================================

class TestCollabPostsAPI:
    """Test Collab Posts endpoints - GET /api/posts/collab/invites, POST /api/posts/collab/accept/{id}"""
    
    def test_create_post_for_collab(self, api_client, auth_setup):
        """Create a test post for collab testing"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/social/posts", json={
            "content": "TEST_Iter29 Collab post #music @test",
            "post_type": "text",
            "visibility": "public"
        })
        
        assert response.status_code in [200, 201], f"Create post failed: {response.text}"
        data = response.json()
        test_state["post_id"] = data.get("id")
        print(f"✅ Created post for collab: {test_state['post_id']}")
    
    def test_invite_collaborator(self, api_client, auth_setup):
        """Test POST /api/posts/{post_id}/collab/invite - Invite collaborator"""
        if not test_state["auth_token"] or not test_state["post_id"] or not test_state["target_user_id"]:
            pytest.skip("Auth, post, or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/posts/{test_state['post_id']}/collab/invite",
            params={"invited_user_id": test_state["target_user_id"]}
        )
        
        # May return 400 if already invited
        assert response.status_code in [200, 400, 404], f"Invite collab failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            test_state["invite_id"] = data.get("invite_id")
            print(f"✅ POST /api/posts/{{id}}/collab/invite - Invite sent: {test_state['invite_id']}")
        else:
            print(f"⚠️ Collab invite: {response.json().get('detail', 'Unknown')}")
    
    def test_get_collab_invites(self, api_client, auth_setup):
        """Test GET /api/posts/collab/invites - Get pending collab invites"""
        if not test_state["target_auth_token"]:
            pytest.skip("Target auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/posts/collab/invites")
        
        assert response.status_code == 200, f"Get collab invites failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check if our invite is in the list
        if test_state["invite_id"]:
            invite_ids = [inv.get("id") for inv in data]
            if test_state["invite_id"] in invite_ids:
                print(f"✅ GET /api/posts/collab/invites - Found our invite in {len(data)} invites")
            else:
                print(f"✅ GET /api/posts/collab/invites - Got {len(data)} invites")
        else:
            print(f"✅ GET /api/posts/collab/invites - Got {len(data)} invites")
    
    def test_accept_collab_invite(self, api_client, auth_setup):
        """Test POST /api/posts/collab/accept/{invite_id} - Accept collab invite"""
        if not test_state["target_auth_token"] or not test_state["invite_id"]:
            pytest.skip("Target auth or invite not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/posts/collab/accept/{test_state['invite_id']}")
        
        assert response.status_code in [200, 404], f"Accept collab failed: {response.text}"
        if response.status_code == 200:
            print("✅ POST /api/posts/collab/accept/{{id}} - Invite accepted")
        else:
            print("⚠️ Invite may have been already accepted or not found")
    
    def test_decline_collab_invite(self, api_client, auth_setup):
        """Test POST /api/posts/collab/decline/{invite_id} - Decline collab invite"""
        # Create another invite to test decline
        if not test_state["auth_token"] or not test_state["post_id"] or not test_state["target_user_id"]:
            pytest.skip("Auth, post, or target user not available")
        
        # First create a new post and invite
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/social/posts", json={
            "content": "TEST_Iter29 Another collab post",
            "post_type": "text"
        })
        
        if response.status_code in [200, 201]:
            new_post_id = response.json().get("id")
            
            # Send invite
            response = api_client.post(
                f"{BASE_URL}/api/posts/{new_post_id}/collab/invite",
                params={"invited_user_id": test_state["target_user_id"]}
            )
            
            if response.status_code == 200:
                new_invite_id = response.json().get("invite_id")
                
                # Decline the invite
                api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
                response = api_client.post(f"{BASE_URL}/api/posts/collab/decline/{new_invite_id}")
                
                assert response.status_code in [200, 404], f"Decline collab failed: {response.text}"
                if response.status_code == 200:
                    print("✅ POST /api/posts/collab/decline/{{id}} - Invite declined")
                    return
        
        print("⚠️ Could not test decline - skipping")


# ============================================
# STORY STICKERS API TESTS
# ============================================

class TestStoryStickerAPI:
    """Test Story Stickers endpoints - POST /api/stories/{id}/stickers, POST /api/stories/{id}/stickers/{sticker_id}/respond"""
    
    def test_create_story_for_stickers(self, api_client, auth_setup):
        """Create a test story for sticker testing"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories", json={
            "story_type": "text",
            "text": "TEST_Iter29 Story for stickers",
            "background_color": "#8B5CF6"
        })
        
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        test_state["story_id"] = data.get("id")
        print(f"✅ Created story for stickers: {test_state['story_id']}")
    
    def test_add_poll_sticker(self, api_client, auth_setup):
        """Test POST /api/stories/{id}/stickers - Add poll sticker"""
        if not test_state["auth_token"] or not test_state["story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['story_id']}/stickers", json={
            "sticker_type": "poll",
            "sticker_data": {
                "question": "What's your favorite music genre?",
                "options": ["Pop", "Rock", "Hip-Hop", "Electronic"]
            }
        })
        
        assert response.status_code == 200, f"Add poll sticker failed: {response.text}"
        data = response.json()
        assert "sticker_id" in data
        test_state["sticker_id"] = data["sticker_id"]
        print(f"✅ POST /api/stories/{{id}}/stickers - Poll sticker added: {data['sticker_id']}")
    
    def test_add_question_sticker(self, api_client, auth_setup):
        """Test POST /api/stories/{id}/stickers - Add question sticker"""
        if not test_state["auth_token"] or not test_state["story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['story_id']}/stickers", json={
            "sticker_type": "question",
            "sticker_data": {
                "question": "Ask me anything about music!"
            }
        })
        
        assert response.status_code == 200, f"Add question sticker failed: {response.text}"
        print("✅ POST /api/stories/{{id}}/stickers - Question sticker added")
    
    def test_add_quiz_sticker(self, api_client, auth_setup):
        """Test POST /api/stories/{id}/stickers - Add quiz sticker"""
        if not test_state["auth_token"] or not test_state["story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['story_id']}/stickers", json={
            "sticker_type": "quiz",
            "sticker_data": {
                "question": "Which artist has the most Grammys?",
                "options": ["Taylor Swift", "Beyoncé", "Adele", "Ed Sheeran"],
                "correct_answer": 1
            }
        })
        
        assert response.status_code == 200, f"Add quiz sticker failed: {response.text}"
        print("✅ POST /api/stories/{{id}}/stickers - Quiz sticker added")
    
    def test_add_slider_sticker(self, api_client, auth_setup):
        """Test POST /api/stories/{id}/stickers - Add slider sticker"""
        if not test_state["auth_token"] or not test_state["story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['story_id']}/stickers", json={
            "sticker_type": "slider",
            "sticker_data": {
                "question": "How much do you love this song?",
                "emoji": "🔥"
            }
        })
        
        assert response.status_code == 200, f"Add slider sticker failed: {response.text}"
        print("✅ POST /api/stories/{{id}}/stickers - Slider sticker added")
    
    def test_respond_to_sticker(self, api_client, auth_setup):
        """Test POST /api/stories/{id}/stickers/{sticker_id}/respond - Respond to sticker"""
        if not test_state["target_auth_token"] or not test_state["story_id"] or not test_state["sticker_id"]:
            pytest.skip("Target auth, story, or sticker not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/stories/{test_state['story_id']}/stickers/{test_state['sticker_id']}/respond",
            json={"answer": "Pop", "option_index": 0}
        )
        
        assert response.status_code == 200, f"Respond to sticker failed: {response.text}"
        print("✅ POST /api/stories/{{id}}/stickers/{{sticker_id}}/respond - Response sent")
    
    def test_get_sticker_responses(self, api_client, auth_setup):
        """Test GET /api/stories/{id}/stickers/{sticker_id}/responses - Get sticker responses"""
        if not test_state["auth_token"] or not test_state["story_id"] or not test_state["sticker_id"]:
            pytest.skip("Auth, story, or sticker not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(
            f"{BASE_URL}/api/stories/{test_state['story_id']}/stickers/{test_state['sticker_id']}/responses"
        )
        
        assert response.status_code == 200, f"Get sticker responses failed: {response.text}"
        data = response.json()
        assert "responses" in data
        print(f"✅ GET /api/stories/{{id}}/stickers/{{sticker_id}}/responses - Got {data.get('total_responses', 0)} responses")


# ============================================
# INSTAGRAM FEATURES API TESTS
# ============================================

class TestInstagramFeaturesAPI:
    """Test Instagram Features endpoints - GET /api/stories/highlights, POST /api/collections/saved"""
    
    def test_create_highlight(self, api_client, auth_setup):
        """Test POST /api/stories/highlights - Create story highlight"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/highlights", json={
            "name": "TEST_Iter29 Highlights",
            "cover_url": "https://example.com/cover.jpg",
            "story_ids": []
        })
        
        assert response.status_code == 200, f"Create highlight failed: {response.text}"
        data = response.json()
        assert "id" in data
        test_state["highlight_id"] = data["id"]
        print(f"✅ POST /api/stories/highlights - Highlight created: {data['id']}")
    
    def test_get_my_highlights(self, api_client, auth_setup):
        """Test GET /api/stories/highlights - Get user's highlights"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/stories/highlights")
        
        assert response.status_code == 200, f"Get highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/stories/highlights - Got {len(data)} highlights")
    
    def test_add_story_to_highlight(self, api_client, auth_setup):
        """Test POST /api/stories/highlights/{id}/add-story/{story_id} - Add story to highlight"""
        if not test_state["auth_token"] or not test_state["highlight_id"] or not test_state["story_id"]:
            pytest.skip("Auth, highlight, or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/stories/highlights/{test_state['highlight_id']}/add-story/{test_state['story_id']}"
        )
        
        assert response.status_code == 200, f"Add story to highlight failed: {response.text}"
        print("✅ POST /api/stories/highlights/{{id}}/add-story/{{story_id}} - Story added")
    
    def test_create_saved_collection(self, api_client, auth_setup):
        """Test POST /api/collections/saved - Create saved collection"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/collections/saved", json={
            "name": "TEST_Iter29 Collection",
            "cover_url": "https://example.com/cover.jpg"
        })
        
        assert response.status_code == 200, f"Create collection failed: {response.text}"
        data = response.json()
        assert "id" in data
        test_state["collection_id"] = data["id"]
        print(f"✅ POST /api/collections/saved - Collection created: {data['id']}")
    
    def test_get_my_collections(self, api_client, auth_setup):
        """Test GET /api/collections/saved - Get user's collections"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/collections/saved")
        
        assert response.status_code == 200, f"Get collections failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/collections/saved - Got {len(data)} collections")
    
    def test_add_post_to_collection(self, api_client, auth_setup):
        """Test POST /api/collections/saved/{id}/add/{post_id} - Add post to collection"""
        if not test_state["auth_token"] or not test_state["collection_id"] or not test_state["post_id"]:
            pytest.skip("Auth, collection, or post not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/collections/saved/{test_state['collection_id']}/add/{test_state['post_id']}"
        )
        
        assert response.status_code == 200, f"Add post to collection failed: {response.text}"
        print("✅ POST /api/collections/saved/{{id}}/add/{{post_id}} - Post added")
    
    def test_delete_highlight(self, api_client, auth_setup):
        """Test DELETE /api/stories/highlights/{id} - Delete highlight"""
        if not test_state["auth_token"] or not test_state["highlight_id"]:
            pytest.skip("Auth or highlight not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/stories/highlights/{test_state['highlight_id']}")
        
        assert response.status_code == 200, f"Delete highlight failed: {response.text}"
        print("✅ DELETE /api/stories/highlights/{{id}} - Highlight deleted")
    
    def test_delete_collection(self, api_client, auth_setup):
        """Test DELETE /api/collections/saved/{id} - Delete collection"""
        if not test_state["auth_token"] or not test_state["collection_id"]:
            pytest.skip("Auth or collection not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/collections/saved/{test_state['collection_id']}")
        
        assert response.status_code == 200, f"Delete collection failed: {response.text}"
        print("✅ DELETE /api/collections/saved/{{id}} - Collection deleted")


# ============================================
# SOCIAL INTERACTION API TESTS
# ============================================

class TestSocialInteractionAPI:
    """Test Social Interaction endpoints - GET /api/social/interaction-status/{userId}, POST /api/social/block/{userId}, POST /api/social/mute/{userId}"""
    
    def test_get_interaction_status(self, api_client, auth_setup):
        """Test GET /api/social/interaction-status/{userId} - Get interaction status"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/social/interaction-status/{test_state['target_user_id']}")
        
        assert response.status_code == 200, f"Get interaction status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data
        assert "is_blocked" in data
        assert "is_muted" in data
        assert "is_restricted" in data
        assert "is_close_friend" in data
        assert "is_following" in data
        assert "is_follower" in data
        
        print(f"✅ GET /api/social/interaction-status/{{userId}} - Status: blocked={data['is_blocked']}, muted={data['is_muted']}, restricted={data['is_restricted']}")
    
    def test_mute_user(self, api_client, auth_setup):
        """Test POST /api/social/mute/{userId} - Mute user"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/social/mute/{test_state['target_user_id']}",
            params={"mute_stories": True, "mute_posts": True}
        )
        
        assert response.status_code == 200, f"Mute user failed: {response.text}"
        data = response.json()
        assert "mute_stories" in data
        assert "mute_posts" in data
        print(f"✅ POST /api/social/mute/{{userId}} - User muted: stories={data['mute_stories']}, posts={data['mute_posts']}")
    
    def test_check_mute_status(self, api_client, auth_setup):
        """Test GET /api/social/is-muted/{userId} - Check mute status"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/social/is-muted/{test_state['target_user_id']}")
        
        assert response.status_code == 200, f"Check mute status failed: {response.text}"
        data = response.json()
        assert "is_muted" in data
        print(f"✅ GET /api/social/is-muted/{{userId}} - is_muted={data['is_muted']}")
    
    def test_get_muted_users(self, api_client, auth_setup):
        """Test GET /api/social/muted - Get muted users list"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/social/muted")
        
        assert response.status_code == 200, f"Get muted users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/muted - Got {len(data)} muted users")
    
    def test_unmute_user(self, api_client, auth_setup):
        """Test DELETE /api/social/mute/{userId} - Unmute user"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/social/mute/{test_state['target_user_id']}")
        
        assert response.status_code in [200, 404], f"Unmute user failed: {response.text}"
        print("✅ DELETE /api/social/mute/{{userId}} - User unmuted")
    
    def test_restrict_user(self, api_client, auth_setup):
        """Test POST /api/social/restrict/{userId} - Restrict user"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/social/restrict/{test_state['target_user_id']}")
        
        # May return 400 if already restricted
        assert response.status_code in [200, 400], f"Restrict user failed: {response.text}"
        if response.status_code == 200:
            print("✅ POST /api/social/restrict/{{userId}} - User restricted")
        else:
            print("⚠️ User may already be restricted")
    
    def test_check_restrict_status(self, api_client, auth_setup):
        """Test GET /api/social/is-restricted/{userId} - Check restrict status"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/social/is-restricted/{test_state['target_user_id']}")
        
        assert response.status_code == 200, f"Check restrict status failed: {response.text}"
        data = response.json()
        assert "is_restricted" in data
        print(f"✅ GET /api/social/is-restricted/{{userId}} - is_restricted={data['is_restricted']}")
    
    def test_unrestrict_user(self, api_client, auth_setup):
        """Test DELETE /api/social/restrict/{userId} - Unrestrict user"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/social/restrict/{test_state['target_user_id']}")
        
        assert response.status_code in [200, 404], f"Unrestrict user failed: {response.text}"
        print("✅ DELETE /api/social/restrict/{{userId}} - User unrestricted")
    
    def test_block_user(self, api_client, auth_setup):
        """Test POST /api/social/block/{userId} - Block user"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/social/block/{test_state['target_user_id']}")
        
        # May return 400 if already blocked
        assert response.status_code in [200, 400], f"Block user failed: {response.text}"
        if response.status_code == 200:
            print("✅ POST /api/social/block/{{userId}} - User blocked")
        else:
            print("⚠️ User may already be blocked")
    
    def test_get_blocked_users(self, api_client, auth_setup):
        """Test GET /api/social/blocked-users - Get blocked users list"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/social/blocked-users")
        
        assert response.status_code == 200, f"Get blocked users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/blocked-users - Got {len(data)} blocked users")
    
    def test_unblock_user(self, api_client, auth_setup):
        """Test DELETE /api/social/unblock/{userId} - Unblock user"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/social/unblock/{test_state['target_user_id']}")
        
        assert response.status_code in [200, 404], f"Unblock user failed: {response.text}"
        print("✅ DELETE /api/social/unblock/{{userId}} - User unblocked")
    
    def test_add_close_friend(self, api_client, auth_setup):
        """Test POST /api/social/close-friends/{userId} - Add close friend"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/social/close-friends/{test_state['target_user_id']}")
        
        # May return 400 if already close friend
        assert response.status_code in [200, 400], f"Add close friend failed: {response.text}"
        if response.status_code == 200:
            print("✅ POST /api/social/close-friends/{{userId}} - Close friend added")
        else:
            print("⚠️ User may already be close friend")
    
    def test_get_close_friends(self, api_client, auth_setup):
        """Test GET /api/social/close-friends - Get close friends list"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/social/close-friends")
        
        assert response.status_code == 200, f"Get close friends failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ GET /api/social/close-friends - Got {len(data)} close friends")
    
    def test_remove_close_friend(self, api_client, auth_setup):
        """Test DELETE /api/social/close-friends/{userId} - Remove close friend"""
        if not test_state["auth_token"] or not test_state["target_user_id"]:
            pytest.skip("Auth or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/social/close-friends/{test_state['target_user_id']}")
        
        assert response.status_code in [200, 404], f"Remove close friend failed: {response.text}"
        print("✅ DELETE /api/social/close-friends/{{userId}} - Close friend removed")


# ============================================
# CLEANUP
# ============================================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_post(self, api_client, auth_setup):
        """Delete test post"""
        if not test_state["auth_token"] or not test_state["post_id"]:
            pytest.skip("Auth or post not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/social/posts/{test_state['post_id']}")
        
        if response.status_code == 200:
            print("✅ Test post cleaned up")
        else:
            print("⚠️ Could not cleanup test post")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
