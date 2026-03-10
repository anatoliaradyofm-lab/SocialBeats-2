# Test Iteration 28 - Instagram Features & Live Video
# Tests for: New regions, Story highlights, Saved collections, Collab posts, Stickers, Live video

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test_social@test.com"
TEST_USER_PASSWORD = "Test123!"
TEST_TARGET_EMAIL = "test_target@test.com"
TEST_TARGET_PASSWORD = "Test123!"

# Global state for test data
test_state = {
    "auth_token": None,
    "user_id": None,
    "target_auth_token": None,
    "target_user_id": None,
    "highlight_id": None,
    "story_id": None,
    "collection_id": None,
    "post_id": None,
    "invite_id": None,
    "sticker_story_id": None,
    "sticker_id": None,
    "stream_id": None
}


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_setup(api_client):
    """Setup authentication for both test users"""
    # Login test_social user
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        test_state["auth_token"] = data.get("access_token")
        test_state["user_id"] = data.get("user", {}).get("id")
    else:
        # Register if login fails
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "username": f"test_social_{uuid.uuid4().hex[:6]}"
        })
        if response.status_code in [200, 201]:
            data = response.json()
            test_state["auth_token"] = data.get("access_token")
            test_state["user_id"] = data.get("user", {}).get("id")
    
    # Login test_target user
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_TARGET_EMAIL,
        "password": TEST_TARGET_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        test_state["target_auth_token"] = data.get("access_token")
        test_state["target_user_id"] = data.get("user", {}).get("id")
    else:
        # Register if login fails
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_TARGET_EMAIL,
            "password": TEST_TARGET_PASSWORD,
            "username": f"test_target_{uuid.uuid4().hex[:6]}"
        })
        if response.status_code in [200, 201]:
            data = response.json()
            test_state["target_auth_token"] = data.get("access_token")
            test_state["target_user_id"] = data.get("user", {}).get("id")
    
    return test_state


# ============================================
# NEW REGIONS TESTS
# ============================================

class TestNewRegions:
    """Test new region music data endpoints"""
    
    def test_region_br_brazil(self, api_client):
        """Test Brazil region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/BR")
        assert response.status_code == 200, f"BR region failed: {response.text}"
        data = response.json()
        assert data["region"] == "BR"
        assert "Sertanejo" in data["genres"] or "Funk Brasileiro" in data["genres"]
        assert len(data["popular_artists"]) > 0
        print("✅ BR (Brazil) region works correctly")
    
    def test_region_in_india(self, api_client):
        """Test India region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/IN")
        assert response.status_code == 200, f"IN region failed: {response.text}"
        data = response.json()
        assert data["region"] == "IN"
        assert "Bollywood" in data["genres"] or "Punjabi" in data["genres"]
        assert len(data["popular_artists"]) > 0
        print("✅ IN (India) region works correctly")
    
    def test_region_mx_mexico(self, api_client):
        """Test Mexico region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/MX")
        assert response.status_code == 200, f"MX region failed: {response.text}"
        data = response.json()
        assert data["region"] == "MX"
        assert "Regional Mexicano" in data["genres"] or "Mariachi" in data["genres"]
        assert len(data["popular_artists"]) > 0
        print("✅ MX (Mexico) region works correctly")
    
    def test_region_gb_uk(self, api_client):
        """Test UK region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/GB")
        assert response.status_code == 200, f"GB region failed: {response.text}"
        data = response.json()
        assert data["region"] == "GB"
        assert "UK Pop" in data["genres"] or "Grime" in data["genres"]
        assert len(data["popular_artists"]) > 0
        print("✅ GB (UK) region works correctly")
    
    def test_region_ru_russia(self, api_client):
        """Test Russia region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/RU")
        assert response.status_code == 200, f"RU region failed: {response.text}"
        data = response.json()
        assert data["region"] == "RU"
        assert "Russian Pop" in data["genres"] or "Russian Rock" in data["genres"]
        assert len(data["popular_artists"]) > 0
        print("✅ RU (Russia) region works correctly")
    
    def test_region_sa_saudi(self, api_client):
        """Test Saudi Arabia region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/SA")
        assert response.status_code == 200, f"SA region failed: {response.text}"
        data = response.json()
        assert data["region"] == "SA"
        assert "Arabic Pop" in data["genres"] or "Khaliji" in data["genres"]
        print("✅ SA (Saudi Arabia) region works correctly")
    
    def test_region_it_italy(self, api_client):
        """Test Italy region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/IT")
        assert response.status_code == 200, f"IT region failed: {response.text}"
        data = response.json()
        assert data["region"] == "IT"
        assert "Italian Pop" in data["genres"] or "Opera" in data["genres"]
        print("✅ IT (Italy) region works correctly")
    
    def test_region_pt_portugal(self, api_client):
        """Test Portugal region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/PT")
        assert response.status_code == 200, f"PT region failed: {response.text}"
        data = response.json()
        assert data["region"] == "PT"
        assert "Fado" in data["genres"] or "Portuguese Pop" in data["genres"]
        print("✅ PT (Portugal) region works correctly")
    
    def test_region_nl_netherlands(self, api_client):
        """Test Netherlands region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/NL")
        assert response.status_code == 200, f"NL region failed: {response.text}"
        data = response.json()
        assert data["region"] == "NL"
        assert "Dutch Pop" in data["genres"] or "Hardstyle" in data["genres"]
        print("✅ NL (Netherlands) region works correctly")
    
    def test_region_pl_poland(self, api_client):
        """Test Poland region music data"""
        response = api_client.get(f"{BASE_URL}/api/music/region/PL")
        assert response.status_code == 200, f"PL region failed: {response.text}"
        data = response.json()
        assert data["region"] == "PL"
        assert "Polish Pop" in data["genres"] or "Disco Polo" in data["genres"]
        print("✅ PL (Poland) region works correctly")


# ============================================
# STORY HIGHLIGHTS TESTS
# ============================================

class TestStoryHighlights:
    """Test Story Highlights endpoints"""
    
    def test_create_highlight(self, api_client, auth_setup):
        """Test creating a story highlight"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/highlights", json={
            "name": "TEST_My Favorites",
            "cover_url": "https://example.com/cover.jpg",
            "story_ids": []
        })
        assert response.status_code == 200, f"Create highlight failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_My Favorites"
        test_state["highlight_id"] = data["id"]
        print(f"✅ Story highlight created: {data['id']}")
    
    def test_get_my_highlights(self, api_client, auth_setup):
        """Test getting user's highlights"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/stories/highlights")
        assert response.status_code == 200, f"Get highlights failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} highlights")
    
    def test_get_highlight_detail(self, api_client, auth_setup):
        """Test getting highlight details"""
        if not test_state["auth_token"] or not test_state["highlight_id"]:
            pytest.skip("Auth or highlight not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/stories/highlights/{test_state['highlight_id']}")
        assert response.status_code == 200, f"Get highlight detail failed: {response.text}"
        data = response.json()
        assert data["id"] == test_state["highlight_id"]
        print("✅ Highlight detail retrieved")
    
    def test_delete_highlight(self, api_client, auth_setup):
        """Test deleting a highlight"""
        if not test_state["auth_token"] or not test_state["highlight_id"]:
            pytest.skip("Auth or highlight not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/stories/highlights/{test_state['highlight_id']}")
        assert response.status_code == 200, f"Delete highlight failed: {response.text}"
        print("✅ Highlight deleted")


# ============================================
# STORY REACTIONS TESTS
# ============================================

class TestStoryReactions:
    """Test Story Reactions and Replies"""
    
    def test_create_story_for_reactions(self, api_client, auth_setup):
        """Create a test story for reactions"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories", json={
            "story_type": "text",
            "text": "TEST_Story for reactions",
            "background_color": "#8B5CF6"
        })
        if response.status_code == 200:
            data = response.json()
            test_state["story_id"] = data.get("id")
            print(f"✅ Story created for reactions: {test_state['story_id']}")
        else:
            print(f"⚠️ Story creation: {response.text}")
    
    def test_react_to_story(self, api_client, auth_setup):
        """Test reacting to a story with emoji"""
        if not test_state["auth_token"] or not test_state["story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['story_id']}/react", json={
            "emoji": "❤️"
        })
        assert response.status_code == 200, f"React to story failed: {response.text}"
        data = response.json()
        assert data.get("emoji") == "❤️" or "message" in data
        print("✅ Story reaction sent")
    
    def test_get_story_reactions(self, api_client, auth_setup):
        """Test getting story reactions"""
        if not test_state["auth_token"] or not test_state["story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/stories/{test_state['story_id']}/reactions")
        assert response.status_code == 200, f"Get reactions failed: {response.text}"
        data = response.json()
        assert "reactions" in data or "total" in data
        print("✅ Story reactions retrieved")
    
    def test_reply_to_story(self, api_client, auth_setup):
        """Test replying to a story (DM)"""
        if not test_state["target_auth_token"] or not test_state["story_id"]:
            pytest.skip("Target auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/stories/{test_state['story_id']}/reply",
            params={"message": "Great story!"}
        )
        # May return 200 or 404 if story expired
        assert response.status_code in [200, 404], f"Reply to story failed: {response.text}"
        if response.status_code == 200:
            print("✅ Story reply sent")
        else:
            print("⚠️ Story may have expired")


# ============================================
# SAVED COLLECTIONS TESTS
# ============================================

class TestSavedCollections:
    """Test Saved Collections endpoints"""
    
    def test_create_collection(self, api_client, auth_setup):
        """Test creating a saved collection"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/saved/collections", json={
            "name": "TEST_My Collection",
            "cover_url": "https://example.com/cover.jpg"
        })
        assert response.status_code == 200, f"Create collection failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_My Collection"
        test_state["collection_id"] = data["id"]
        print(f"✅ Collection created: {data['id']}")
    
    def test_get_my_collections(self, api_client, auth_setup):
        """Test getting user's collections"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/saved/collections")
        assert response.status_code == 200, f"Get collections failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} collections")
    
    def test_add_post_to_collection(self, api_client, auth_setup):
        """Test adding a post to collection"""
        if not test_state["auth_token"] or not test_state["collection_id"]:
            pytest.skip("Auth or collection not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        mock_post_id = "test_post_123"
        response = api_client.post(f"{BASE_URL}/api/saved/collections/{test_state['collection_id']}/add/{mock_post_id}")
        assert response.status_code == 200, f"Add to collection failed: {response.text}"
        print("✅ Post added to collection")
    
    def test_get_collection_posts(self, api_client, auth_setup):
        """Test getting collection posts"""
        if not test_state["auth_token"] or not test_state["collection_id"]:
            pytest.skip("Auth or collection not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/saved/collections/{test_state['collection_id']}")
        assert response.status_code == 200, f"Get collection posts failed: {response.text}"
        data = response.json()
        assert "posts" in data or "post_ids" in data
        print("✅ Collection posts retrieved")
    
    def test_delete_collection(self, api_client, auth_setup):
        """Test deleting a collection"""
        if not test_state["auth_token"] or not test_state["collection_id"]:
            pytest.skip("Auth or collection not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.delete(f"{BASE_URL}/api/saved/collections/{test_state['collection_id']}")
        assert response.status_code == 200, f"Delete collection failed: {response.text}"
        print("✅ Collection deleted")


# ============================================
# COLLAB POSTS TESTS
# ============================================

class TestCollabPosts:
    """Test Collab Posts endpoints"""
    
    def test_create_post_for_collab(self, api_client, auth_setup):
        """Create a test post for collab"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/social/posts", json={
            "content": "TEST_Collab post content",
            "post_type": "text"
        })
        if response.status_code in [200, 201]:
            data = response.json()
            test_state["post_id"] = data.get("id")
            print(f"✅ Post created for collab: {test_state['post_id']}")
        else:
            print(f"⚠️ Post creation: {response.text}")
    
    def test_invite_collaborator(self, api_client, auth_setup):
        """Test inviting a collaborator to a post"""
        if not test_state["auth_token"] or not test_state["post_id"] or not test_state["target_user_id"]:
            pytest.skip("Auth, post, or target user not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(
            f"{BASE_URL}/api/posts/{test_state['post_id']}/collab/invite",
            params={"invited_user_id": test_state["target_user_id"]}
        )
        assert response.status_code in [200, 400, 404], f"Invite collab failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            test_state["invite_id"] = data.get("invite_id")
            print(f"✅ Collab invite sent: {test_state['invite_id']}")
        else:
            print(f"⚠️ Collab invite: {response.json().get('detail', 'Unknown error')}")
    
    def test_get_collab_invites(self, api_client, auth_setup):
        """Test getting pending collab invites"""
        if not test_state["target_auth_token"]:
            pytest.skip("Target auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/posts/collab/invites")
        assert response.status_code == 200, f"Get collab invites failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} collab invites")


# ============================================
# STORY STICKERS TESTS
# ============================================

class TestStoryStickers:
    """Test Story Stickers endpoints"""
    
    def test_create_story_for_stickers(self, api_client, auth_setup):
        """Create a test story for stickers"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories", json={
            "story_type": "text",
            "text": "TEST_Story for stickers",
            "background_color": "#FF5733"
        })
        if response.status_code == 200:
            data = response.json()
            test_state["sticker_story_id"] = data.get("id")
            print(f"✅ Story created for stickers: {test_state['sticker_story_id']}")
        else:
            print(f"⚠️ Story creation: {response.text}")
    
    def test_add_poll_sticker(self, api_client, auth_setup):
        """Test adding a poll sticker to story"""
        if not test_state["auth_token"] or not test_state["sticker_story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['sticker_story_id']}/stickers", json={
            "sticker_type": "poll",
            "sticker_data": {
                "question": "What's your favorite genre?",
                "options": ["Pop", "Rock", "Hip-Hop", "Electronic"]
            }
        })
        assert response.status_code == 200, f"Add poll sticker failed: {response.text}"
        data = response.json()
        test_state["sticker_id"] = data.get("sticker_id")
        print(f"✅ Poll sticker added: {test_state['sticker_id']}")
    
    def test_add_question_sticker(self, api_client, auth_setup):
        """Test adding a question sticker to story"""
        if not test_state["auth_token"] or not test_state["sticker_story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['sticker_story_id']}/stickers", json={
            "sticker_type": "question",
            "sticker_data": {
                "question": "Ask me anything!"
            }
        })
        assert response.status_code == 200, f"Add question sticker failed: {response.text}"
        print("✅ Question sticker added")
    
    def test_add_quiz_sticker(self, api_client, auth_setup):
        """Test adding a quiz sticker to story"""
        if not test_state["auth_token"] or not test_state["sticker_story_id"]:
            pytest.skip("Auth or story not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/stories/{test_state['sticker_story_id']}/stickers", json={
            "sticker_type": "quiz",
            "sticker_data": {
                "question": "Which artist has the most Grammys?",
                "options": ["Taylor Swift", "Beyoncé", "Adele", "Ed Sheeran"],
                "correct_answer": 1
            }
        })
        assert response.status_code == 200, f"Add quiz sticker failed: {response.text}"
        print("✅ Quiz sticker added")


# ============================================
# LIVE VIDEO TESTS
# ============================================

class TestLiveVideo:
    """Test Live Video endpoints"""
    
    def test_start_live_stream(self, api_client, auth_setup):
        """Test starting a live stream"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/start", json={
            "title": "TEST_My Live Stream",
            "description": "Testing live video feature",
            "category": "music",
            "is_private": False
        })
        assert response.status_code in [200, 400], f"Start live failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            test_state["stream_id"] = data.get("id")
            assert data["status"] == "live"
            print(f"✅ Live stream started: {test_state['stream_id']}")
        else:
            # May fail if already has active stream
            print(f"⚠️ Start live: {response.json().get('detail', 'Unknown error')}")
    
    def test_get_active_streams(self, api_client, auth_setup):
        """Test getting active live streams"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/active")
        assert response.status_code == 200, f"Get active streams failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} active streams")
    
    def test_join_stream(self, api_client, auth_setup):
        """Test joining a live stream"""
        if not test_state["target_auth_token"] or not test_state["stream_id"]:
            pytest.skip("Target auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/{test_state['stream_id']}/join")
        assert response.status_code in [200, 404], f"Join stream failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "viewer_count" in data
            print(f"✅ Joined stream, viewers: {data['viewer_count']}")
        else:
            print("⚠️ Stream may have ended")
    
    def test_add_live_comment(self, api_client, auth_setup):
        """Test adding a comment to live stream"""
        if not test_state["target_auth_token"] or not test_state["stream_id"]:
            pytest.skip("Target auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/{test_state['stream_id']}/comment", json={
            "content": "Great stream! 🎵"
        })
        assert response.status_code in [200, 404], f"Add comment failed: {response.text}"
        if response.status_code == 200:
            print("✅ Live comment added")
        else:
            print("⚠️ Stream may have ended")
    
    def test_send_gift(self, api_client, auth_setup):
        """Test sending a gift to live stream"""
        if not test_state["target_auth_token"] or not test_state["stream_id"]:
            pytest.skip("Target auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['target_auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/{test_state['stream_id']}/gift", json={
            "gift_type": "heart",
            "amount": 1
        })
        assert response.status_code in [200, 404], f"Send gift failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert data["gift_type"] == "heart"
            print("✅ Gift sent")
        else:
            print("⚠️ Stream may have ended")
    
    def test_get_rtc_config(self, api_client, auth_setup):
        """Test getting WebRTC config"""
        if not test_state["auth_token"] or not test_state["stream_id"]:
            pytest.skip("Auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/{test_state['stream_id']}/rtc-config")
        assert response.status_code in [200, 404], f"Get RTC config failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "ice_servers" in data
            assert len(data["ice_servers"]) > 0
            print(f"✅ RTC config retrieved with {len(data['ice_servers'])} ICE servers")
        else:
            print("⚠️ Stream may have ended")
    
    def test_end_live_stream(self, api_client, auth_setup):
        """Test ending a live stream"""
        if not test_state["auth_token"] or not test_state["stream_id"]:
            pytest.skip("Auth or stream not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.post(f"{BASE_URL}/api/live/end/{test_state['stream_id']}")
        assert response.status_code in [200, 404], f"End live failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "duration_seconds" in data
            print(f"✅ Live stream ended, duration: {data['duration_seconds']}s")
        else:
            print("⚠️ Stream may have already ended")


# ============================================
# LIVE HISTORY TESTS
# ============================================

class TestLiveHistory:
    """Test Live Stream History endpoints"""
    
    def test_get_my_live_history(self, api_client, auth_setup):
        """Test getting user's live stream history"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/history/my")
        assert response.status_code == 200, f"Get live history failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} past streams")
    
    def test_get_following_streams(self, api_client, auth_setup):
        """Test getting following users' live streams"""
        if not test_state["auth_token"]:
            pytest.skip("Auth not available")
        
        api_client.headers.update({"Authorization": f"Bearer {test_state['auth_token']}"})
        response = api_client.get(f"{BASE_URL}/api/live/following")
        assert response.status_code == 200, f"Get following streams failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} following streams")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
