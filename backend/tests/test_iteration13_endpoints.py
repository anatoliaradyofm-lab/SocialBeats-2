"""
Iteration 13 Backend API Tests - SocialBeats
Tests for new features:
- Story Polls (POST /api/stories with poll, POST /api/stories/{id}/poll/vote)
- Swipe-up Links (POST /api/stories/{id}/swipe-up/track)
- Voice/Video Calls (POST /api/calls/initiate, /api/calls/{id}/answer, /api/calls/history)
- E2E Encryption (POST /api/encryption/keys/generate, GET /api/encryption/keys/{user_id})
- WebAuthn (POST /api/auth/webauthn/register/begin, GET /api/auth/webauthn/credentials)
- Playlist Sync (POST /api/playlists/sync, GET /api/playlists/sync/status)
- Music Recognition (POST /api/music/recognize, GET /api/music/recognize/history)
- Radio Station (POST /api/radio/create, GET /api/radio/stations)
- Music Taste Test (GET /api/profile/taste-test/questions, POST /api/profile/taste-test/submit)
- User Level (GET /api/profile/level)
- Badges (GET /api/profile/badges)
- Follower Analytics (GET /api/profile/analytics/followers, GET /api/profile/analytics/engagement)
"""

import pytest
import requests
import os
import uuid
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSetup:
    """Setup test user and get auth token"""
    
    @staticmethod
    def get_auth_token():
        """Login with test user and get token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "newtest@test.com", "password": "password123"}
        )
        if login_response.status_code == 200:
            return login_response.json().get("access_token")
        
        # If login fails, try to register
        unique_id = str(uuid.uuid4())[:8]
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"test_{unique_id}@test.com",
                "password": "password123",
                "username": f"testuser_{unique_id}"
            }
        )
        if register_response.status_code == 200:
            return register_response.json().get("access_token")
        return None
    
    @staticmethod
    def create_second_user():
        """Create a second user for call testing"""
        unique_id = str(uuid.uuid4())[:8]
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"test2_{unique_id}@test.com",
                "password": "password123",
                "username": f"testuser2_{unique_id}"
            }
        )
        if register_response.status_code == 200:
            data = register_response.json()
            return data.get("access_token"), data.get("user", {}).get("id")
        return None, None


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for tests"""
    token = TestSetup.get_auth_token()
    if not token:
        pytest.skip("Could not get auth token")
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="module")
def second_user():
    """Create second user for call tests"""
    token, user_id = TestSetup.create_second_user()
    return {"token": token, "user_id": user_id}


# ============== STORY POLLS TESTS ==============

class TestStoryPolls:
    """Test Story Poll functionality"""
    
    def test_create_poll_story(self, auth_headers):
        """Test creating a story with poll"""
        response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=auth_headers,
            json={
                "story_type": "poll",
                "poll_question": "En sevdiğin müzik türü?",
                "poll_options": ["Pop", "Rock", "Hip-Hop", "Jazz"],
                "background_color": "#8B5CF6"
            }
        )
        assert response.status_code == 200, f"Failed to create poll story: {response.text}"
        data = response.json()
        assert data.get("story_type") == "poll"
        assert data.get("poll_question") == "En sevdiğin müzik türü?"
        assert len(data.get("poll_options", [])) == 4
        print(f"✅ Created poll story: {data.get('id')}")
        return data.get("id"), data.get("poll_options", [])
    
    def test_vote_on_poll(self, auth_headers):
        """Test voting on a story poll"""
        # First create a poll story
        create_response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=auth_headers,
            json={
                "story_type": "poll",
                "poll_question": "Test poll?",
                "poll_options": ["Option A", "Option B"]
            }
        )
        assert create_response.status_code == 200
        story_data = create_response.json()
        story_id = story_data.get("id")
        poll_options = story_data.get("poll_options", [])
        
        if poll_options:
            option_id = poll_options[0].get("id")
            # Vote on the poll
            vote_response = requests.post(
                f"{BASE_URL}/api/stories/{story_id}/poll/vote",
                headers=auth_headers,
                data={"option_id": option_id}
            )
            assert vote_response.status_code == 200, f"Failed to vote: {vote_response.text}"
            vote_data = vote_response.json()
            assert "results" in vote_data
            assert vote_data.get("user_vote") == option_id
            print(f"✅ Voted on poll story: {story_id}")
    
    def test_get_poll_results(self, auth_headers):
        """Test getting poll results"""
        # Create and vote on a poll
        create_response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=auth_headers,
            json={
                "story_type": "poll",
                "poll_question": "Results test?",
                "poll_options": ["Yes", "No"]
            }
        )
        assert create_response.status_code == 200
        story_id = create_response.json().get("id")
        
        # Get results
        results_response = requests.get(
            f"{BASE_URL}/api/stories/{story_id}/poll/results",
            headers=auth_headers
        )
        assert results_response.status_code == 200, f"Failed to get results: {results_response.text}"
        data = results_response.json()
        assert "results" in data
        assert "total_votes" in data
        print(f"✅ Got poll results for story: {story_id}")


# ============== SWIPE-UP LINKS TESTS ==============

class TestSwipeUpLinks:
    """Test Swipe-up Link functionality"""
    
    def test_create_story_with_swipe_up(self, auth_headers):
        """Test creating a story with swipe-up link"""
        response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=auth_headers,
            json={
                "story_type": "text",
                "text": "Check out this link!",
                "swipe_up_url": "https://example.com/music",
                "swipe_up_title": "Listen Now"
            }
        )
        assert response.status_code == 200, f"Failed to create story: {response.text}"
        data = response.json()
        assert data.get("swipe_up_url") == "https://example.com/music"
        assert data.get("swipe_up_title") == "Listen Now"
        print(f"✅ Created story with swipe-up link: {data.get('id')}")
        return data.get("id")
    
    def test_track_swipe_up_click(self, auth_headers):
        """Test tracking swipe-up link click"""
        # Create story with swipe-up
        create_response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=auth_headers,
            json={
                "story_type": "text",
                "text": "Swipe up test",
                "swipe_up_url": "https://example.com/track",
                "swipe_up_title": "Track Link"
            }
        )
        assert create_response.status_code == 200
        story_id = create_response.json().get("id")
        
        # Track the click
        track_response = requests.post(
            f"{BASE_URL}/api/stories/{story_id}/swipe-up/track",
            headers=auth_headers
        )
        assert track_response.status_code == 200, f"Failed to track click: {track_response.text}"
        data = track_response.json()
        assert data.get("url") == "https://example.com/track"
        print(f"✅ Tracked swipe-up click for story: {story_id}")
    
    def test_swipe_up_stats(self, auth_headers):
        """Test getting swipe-up statistics"""
        # Create story with swipe-up
        create_response = requests.post(
            f"{BASE_URL}/api/stories",
            headers=auth_headers,
            json={
                "story_type": "text",
                "text": "Stats test",
                "swipe_up_url": "https://example.com/stats"
            }
        )
        assert create_response.status_code == 200
        story_id = create_response.json().get("id")
        
        # Get stats
        stats_response = requests.get(
            f"{BASE_URL}/api/stories/{story_id}/swipe-up/stats",
            headers=auth_headers
        )
        assert stats_response.status_code == 200, f"Failed to get stats: {stats_response.text}"
        data = stats_response.json()
        assert "total_clicks" in data
        assert "unique_clicks" in data
        print(f"✅ Got swipe-up stats for story: {story_id}")


# ============== VOICE/VIDEO CALLS TESTS ==============

class TestCalls:
    """Test Voice/Video Call functionality"""
    
    def test_initiate_call(self, auth_headers, second_user):
        """Test initiating a call"""
        if not second_user.get("user_id"):
            pytest.skip("Second user not created")
        
        response = requests.post(
            f"{BASE_URL}/api/calls/initiate",
            headers=auth_headers,
            data={
                "callee_id": second_user["user_id"],
                "call_type": "voice"
            }
        )
        assert response.status_code == 200, f"Failed to initiate call: {response.text}"
        data = response.json()
        assert "call_id" in data
        assert data.get("status") == "ringing"
        print(f"✅ Initiated call: {data.get('call_id')}")
        return data.get("call_id")
    
    def test_answer_call(self, auth_headers, second_user):
        """Test answering a call"""
        if not second_user.get("user_id") or not second_user.get("token"):
            pytest.skip("Second user not created")
        
        # Initiate call first
        init_response = requests.post(
            f"{BASE_URL}/api/calls/initiate",
            headers=auth_headers,
            data={
                "callee_id": second_user["user_id"],
                "call_type": "video"
            }
        )
        assert init_response.status_code == 200
        call_id = init_response.json().get("call_id")
        
        # Answer with second user
        answer_response = requests.post(
            f"{BASE_URL}/api/calls/{call_id}/answer",
            headers={"Authorization": f"Bearer {second_user['token']}"}
        )
        assert answer_response.status_code == 200, f"Failed to answer call: {answer_response.text}"
        data = answer_response.json()
        assert data.get("status") == "active"
        print(f"✅ Answered call: {call_id}")
    
    def test_get_call_history(self, auth_headers):
        """Test getting call history"""
        response = requests.get(
            f"{BASE_URL}/api/calls/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get call history: {response.text}"
        data = response.json()
        assert "calls" in data
        print(f"✅ Got call history: {len(data.get('calls', []))} calls")
    
    def test_call_history_unauthorized(self):
        """Test call history requires auth"""
        response = requests.get(f"{BASE_URL}/api/calls/history")
        assert response.status_code in [401, 403]
        print("✅ Call history correctly rejects unauthorized")


# ============== E2E ENCRYPTION TESTS ==============

class TestEncryption:
    """Test E2E Encryption functionality"""
    
    def test_generate_encryption_keys(self, auth_headers):
        """Test generating encryption keys"""
        response = requests.post(
            f"{BASE_URL}/api/encryption/keys/generate",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to generate keys: {response.text}"
        data = response.json()
        assert "public_key" in data
        assert "private_key_seed" in data
        assert "key_id" in data
        print(f"✅ Generated encryption keys: {data.get('key_id')}")
        return data
    
    def test_get_user_public_key(self, auth_headers, second_user):
        """Test getting user's public key"""
        if not second_user.get("user_id"):
            pytest.skip("Second user not created")
        
        # First generate keys for second user
        requests.post(
            f"{BASE_URL}/api/encryption/keys/generate",
            headers={"Authorization": f"Bearer {second_user['token']}"}
        )
        
        # Get public key
        response = requests.get(
            f"{BASE_URL}/api/encryption/keys/{second_user['user_id']}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get public key: {response.text}"
        data = response.json()
        # May or may not have key depending on if generated
        assert "has_key" in data
        print(f"✅ Got user public key status: has_key={data.get('has_key')}")
    
    def test_encryption_keys_unauthorized(self):
        """Test encryption endpoints require auth"""
        response = requests.post(f"{BASE_URL}/api/encryption/keys/generate")
        assert response.status_code in [401, 403]
        print("✅ Encryption endpoints correctly reject unauthorized")


# ============== WEBAUTHN TESTS ==============

class TestWebAuthn:
    """Test WebAuthn functionality"""
    
    def test_webauthn_register_begin(self, auth_headers):
        """Test beginning WebAuthn registration"""
        response = requests.post(
            f"{BASE_URL}/api/auth/webauthn/register/begin",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to begin registration: {response.text}"
        data = response.json()
        assert "challenge" in data
        assert "rp" in data
        assert "user" in data
        assert "pubKeyCredParams" in data
        print(f"✅ WebAuthn registration begun, challenge received")
    
    def test_list_webauthn_credentials(self, auth_headers):
        """Test listing WebAuthn credentials"""
        response = requests.get(
            f"{BASE_URL}/api/auth/webauthn/credentials",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to list credentials: {response.text}"
        data = response.json()
        assert "credentials" in data
        print(f"✅ Listed WebAuthn credentials: {len(data.get('credentials', []))} found")
    
    def test_webauthn_credentials_unauthorized(self):
        """Test WebAuthn credentials require auth"""
        response = requests.get(f"{BASE_URL}/api/auth/webauthn/credentials")
        assert response.status_code in [401, 403]
        print("✅ WebAuthn credentials correctly reject unauthorized")


# ============== PLAYLIST SYNC TESTS ==============

class TestPlaylistSync:
    """Test Cross-platform Playlist Sync functionality"""
    
    def test_sync_spotify_playlists(self, auth_headers):
        """Test syncing Spotify playlists"""
        response = requests.post(
            f"{BASE_URL}/api/playlists/sync",
            headers=auth_headers,
            data={"platform": "spotify"}
        )
        assert response.status_code == 200, f"Failed to sync: {response.text}"
        data = response.json()
        assert data.get("platform") == "spotify"
        assert "synced_playlists" in data
        print(f"✅ Synced Spotify playlists: {len(data.get('synced_playlists', []))} playlists")
    
    def test_sync_apple_music_playlists(self, auth_headers):
        """Test syncing Apple Music playlists"""
        response = requests.post(
            f"{BASE_URL}/api/playlists/sync",
            headers=auth_headers,
            data={"platform": "apple_music"}
        )
        assert response.status_code == 200, f"Failed to sync: {response.text}"
        data = response.json()
        assert data.get("platform") == "apple_music"
        print(f"✅ Synced Apple Music playlists")
    
    def test_sync_youtube_music_playlists(self, auth_headers):
        """Test syncing YouTube Music playlists"""
        response = requests.post(
            f"{BASE_URL}/api/playlists/sync",
            headers=auth_headers,
            data={"platform": "youtube_music"}
        )
        assert response.status_code == 200, f"Failed to sync: {response.text}"
        data = response.json()
        assert data.get("platform") == "youtube_music"
        print(f"✅ Synced YouTube Music playlists")
    
    def test_get_sync_status(self, auth_headers):
        """Test getting sync status"""
        response = requests.get(
            f"{BASE_URL}/api/playlists/sync/status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get status: {response.text}"
        data = response.json()
        assert "sync_status" in data
        status = data.get("sync_status", {})
        assert "spotify" in status
        assert "apple_music" in status
        assert "youtube_music" in status
        print(f"✅ Got sync status for all platforms")
    
    def test_sync_status_unauthorized(self):
        """Test sync status requires auth"""
        response = requests.get(f"{BASE_URL}/api/playlists/sync/status")
        assert response.status_code in [401, 403]
        print("✅ Sync status correctly rejects unauthorized")


# ============== MUSIC RECOGNITION TESTS ==============

class TestMusicRecognition:
    """Test Music Recognition (Shazam-like) functionality"""
    
    def test_recognize_music(self, auth_headers):
        """Test music recognition"""
        response = requests.post(
            f"{BASE_URL}/api/music/recognize",
            headers=auth_headers,
            data={"audio_fingerprint": "mock_fingerprint_data"}
        )
        assert response.status_code == 200, f"Failed to recognize: {response.text}"
        data = response.json()
        assert data.get("recognized") == True
        assert "track" in data
        assert "confidence" in data
        track = data.get("track", {})
        assert "title" in track
        assert "artist" in track
        print(f"✅ Recognized music: {track.get('title')} by {track.get('artist')}")
    
    def test_get_recognition_history(self, auth_headers):
        """Test getting recognition history"""
        response = requests.get(
            f"{BASE_URL}/api/music/recognize/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        data = response.json()
        assert "history" in data
        print(f"✅ Got recognition history: {len(data.get('history', []))} items")
    
    def test_recognition_unauthorized(self):
        """Test recognition requires auth"""
        response = requests.post(f"{BASE_URL}/api/music/recognize")
        assert response.status_code in [401, 403]
        print("✅ Music recognition correctly rejects unauthorized")


# ============== RADIO STATION TESTS ==============

class TestRadioStation:
    """Test Radio Station functionality"""
    
    def test_create_radio_by_genre(self, auth_headers):
        """Test creating radio station by genre"""
        response = requests.post(
            f"{BASE_URL}/api/radio/create",
            headers=auth_headers,
            data={
                "seed_type": "genre",
                "seed_name": "Pop"
            }
        )
        assert response.status_code == 200, f"Failed to create radio: {response.text}"
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "tracks" in data
        assert data.get("seed_type") == "genre"
        print(f"✅ Created radio station: {data.get('name')}")
        return data.get("id")
    
    def test_create_radio_by_mood(self, auth_headers):
        """Test creating radio station by mood"""
        response = requests.post(
            f"{BASE_URL}/api/radio/create",
            headers=auth_headers,
            data={
                "seed_type": "mood",
                "seed_name": "Enerjik"
            }
        )
        assert response.status_code == 200, f"Failed to create radio: {response.text}"
        data = response.json()
        assert data.get("seed_type") == "mood"
        print(f"✅ Created mood radio: {data.get('name')}")
    
    def test_create_radio_by_artist(self, auth_headers):
        """Test creating radio station by artist"""
        response = requests.post(
            f"{BASE_URL}/api/radio/create",
            headers=auth_headers,
            data={
                "seed_type": "artist",
                "seed_name": "Tarkan"
            }
        )
        assert response.status_code == 200, f"Failed to create radio: {response.text}"
        data = response.json()
        assert data.get("seed_type") == "artist"
        print(f"✅ Created artist radio: {data.get('name')}")
    
    def test_get_radio_stations(self, auth_headers):
        """Test getting user's radio stations"""
        response = requests.get(
            f"{BASE_URL}/api/radio/stations",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get stations: {response.text}"
        data = response.json()
        assert "stations" in data
        print(f"✅ Got radio stations: {len(data.get('stations', []))} stations")
    
    def test_radio_stations_unauthorized(self):
        """Test radio stations require auth"""
        response = requests.get(f"{BASE_URL}/api/radio/stations")
        assert response.status_code in [401, 403]
        print("✅ Radio stations correctly reject unauthorized")


# ============== MUSIC TASTE TEST ==============

class TestMusicTasteTest:
    """Test Music Taste Test functionality"""
    
    def test_get_taste_test_questions(self, auth_headers):
        """Test getting taste test questions"""
        response = requests.get(
            f"{BASE_URL}/api/profile/taste-test/questions",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get questions: {response.text}"
        data = response.json()
        assert "questions" in data
        assert "total_questions" in data
        questions = data.get("questions", [])
        assert len(questions) > 0
        # Verify question structure
        for q in questions:
            assert "id" in q
            assert "question" in q
            assert "options" in q
        print(f"✅ Got taste test questions: {len(questions)} questions")
    
    def test_submit_taste_test(self, auth_headers):
        """Test submitting taste test answers"""
        # First get questions
        questions_response = requests.get(
            f"{BASE_URL}/api/profile/taste-test/questions",
            headers=auth_headers
        )
        questions = questions_response.json().get("questions", [])
        
        # Create answers
        answers = {}
        for q in questions:
            options = q.get("options", [])
            if options:
                answers[q["id"]] = options[0]["id"]
        
        # Submit
        response = requests.post(
            f"{BASE_URL}/api/profile/taste-test/submit",
            headers=auth_headers,
            data={"answers": json.dumps(answers)}
        )
        assert response.status_code == 200, f"Failed to submit: {response.text}"
        data = response.json()
        assert "result" in data
        result = data.get("result", {})
        assert "personality_type" in result
        assert "description" in result
        print(f"✅ Submitted taste test, personality: {result.get('personality_type')}")
    
    def test_taste_test_unauthorized(self):
        """Test taste test requires auth"""
        response = requests.get(f"{BASE_URL}/api/profile/taste-test/questions")
        assert response.status_code in [401, 403]
        print("✅ Taste test correctly rejects unauthorized")


# ============== USER LEVEL TESTS ==============

class TestUserLevel:
    """Test User Level functionality"""
    
    def test_get_user_level(self, auth_headers):
        """Test getting user level"""
        response = requests.get(
            f"{BASE_URL}/api/profile/level",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get level: {response.text}"
        data = response.json()
        assert "current_xp" in data
        assert "level" in data
        assert "level_name" in data
        assert "progress_percent" in data
        print(f"✅ Got user level: Level {data.get('level')} - {data.get('level_name')}")
    
    def test_level_unauthorized(self):
        """Test level requires auth"""
        response = requests.get(f"{BASE_URL}/api/profile/level")
        assert response.status_code in [401, 403]
        print("✅ User level correctly rejects unauthorized")


# ============== BADGES TESTS ==============

class TestBadges:
    """Test Badges functionality"""
    
    def test_get_user_badges(self, auth_headers):
        """Test getting user badges"""
        response = requests.get(
            f"{BASE_URL}/api/profile/badges",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get badges: {response.text}"
        data = response.json()
        assert "earned_badges" in data
        assert "locked_badges" in data
        assert "total_earned" in data
        assert "total_available" in data
        print(f"✅ Got badges: {data.get('total_earned')}/{data.get('total_available')} earned")
    
    def test_badges_unauthorized(self):
        """Test badges requires auth"""
        response = requests.get(f"{BASE_URL}/api/profile/badges")
        assert response.status_code in [401, 403]
        print("✅ Badges correctly reject unauthorized")


# ============== FOLLOWER ANALYTICS TESTS ==============

class TestFollowerAnalytics:
    """Test Follower Analytics functionality"""
    
    def test_get_follower_analytics_default(self, auth_headers):
        """Test getting follower analytics with default period"""
        response = requests.get(
            f"{BASE_URL}/api/profile/analytics/followers",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        assert "period" in data
        assert "summary" in data
        assert "growth_chart" in data
        assert "demographics" in data
        summary = data.get("summary", {})
        assert "total_followers" in summary
        assert "total_following" in summary
        print(f"✅ Got follower analytics: {summary.get('total_followers')} followers")
    
    def test_get_follower_analytics_7d(self, auth_headers):
        """Test getting follower analytics for 7 days"""
        response = requests.get(
            f"{BASE_URL}/api/profile/analytics/followers?period=7d",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        assert data.get("period") == "7d"
        print(f"✅ Got 7-day follower analytics")
    
    def test_get_follower_analytics_90d(self, auth_headers):
        """Test getting follower analytics for 90 days"""
        response = requests.get(
            f"{BASE_URL}/api/profile/analytics/followers?period=90d",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        assert data.get("period") == "90d"
        print(f"✅ Got 90-day follower analytics")
    
    def test_follower_analytics_unauthorized(self):
        """Test follower analytics requires auth"""
        response = requests.get(f"{BASE_URL}/api/profile/analytics/followers")
        assert response.status_code in [401, 403]
        print("✅ Follower analytics correctly rejects unauthorized")


# ============== ENGAGEMENT ANALYTICS TESTS ==============

class TestEngagementAnalytics:
    """Test Engagement Analytics functionality"""
    
    def test_get_engagement_analytics(self, auth_headers):
        """Test getting engagement analytics"""
        response = requests.get(
            f"{BASE_URL}/api/profile/analytics/engagement",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get analytics: {response.text}"
        data = response.json()
        assert "period" in data
        assert "content_stats" in data
        assert "best_performing_content" in data
        assert "engagement_rate" in data
        content_stats = data.get("content_stats", {})
        assert "total_posts" in content_stats
        assert "total_stories" in content_stats
        print(f"✅ Got engagement analytics: {data.get('engagement_rate')}% engagement rate")
    
    def test_engagement_analytics_unauthorized(self):
        """Test engagement analytics requires auth"""
        response = requests.get(f"{BASE_URL}/api/profile/analytics/engagement")
        assert response.status_code in [401, 403]
        print("✅ Engagement analytics correctly rejects unauthorized")


# ============== HEALTH CHECK ==============

class TestHealth:
    """Test health endpoint"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
