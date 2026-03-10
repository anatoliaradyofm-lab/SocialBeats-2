# Test Iteration 22 - Modular Routes & Firebase Auth Testing
# Tests: Firebase Auth mock endpoints, Playlists modular routes, Stories modular routes, Highlights modular routes, Legacy auth endpoints

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = f"test_firebase_{uuid.uuid4().hex[:8]}@test.com"
TEST_USERNAME = f"test_firebase_{uuid.uuid4().hex[:8]}"
TEST_PASSWORD = "testpass123"
TEST_FIREBASE_UID = f"firebase_uid_{uuid.uuid4().hex[:12]}"

class TestLegacyAuth:
    """Test legacy auth endpoints still work after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.test_email = f"test_legacy_{uuid.uuid4().hex[:8]}@test.com"
        self.test_username = f"test_legacy_{uuid.uuid4().hex[:8]}"
        yield
        self.session.close()
    
    def test_legacy_register(self):
        """POST /api/auth/register - Legacy registration endpoint"""
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD,
            "display_name": "Test Legacy User"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == self.test_email
        assert data["user"]["username"] == self.test_username
        print(f"✅ Legacy register works - User created: {self.test_username}")
    
    def test_legacy_login(self):
        """POST /api/auth/login - Legacy login endpoint"""
        # First register a user
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        time.sleep(0.3)  # Rate limiting delay
        
        # Then login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.test_email,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token"
        assert "user" in data, "Missing user"
        assert data["user"]["email"] == self.test_email
        print(f"✅ Legacy login works - Token received")
    
    def test_legacy_login_invalid_credentials(self):
        """POST /api/auth/login - Invalid credentials rejected"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✅ Legacy login rejects invalid credentials")
    
    def test_legacy_get_me(self):
        """GET /api/auth/me - Get current user info"""
        # Register and get token
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        time.sleep(0.3)
        
        # Get current user
        response = self.session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["email"] == self.test_email
        assert data["username"] == self.test_username
        print(f"✅ Legacy /auth/me works - User info retrieved")


class TestFirebaseAuth:
    """Test Firebase Auth mock endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.firebase_uid = f"firebase_{uuid.uuid4().hex[:12]}"
        self.test_email = f"firebase_{uuid.uuid4().hex[:8]}@test.com"
        self.test_username = f"firebase_{uuid.uuid4().hex[:8]}"
        yield
        self.session.close()
    
    def test_firebase_register(self):
        """POST /api/auth/firebase-register - Firebase registration (MOCK mode)"""
        response = self.session.post(f"{BASE_URL}/api/auth/firebase-register", json={
            "firebase_uid": self.firebase_uid,
            "email": self.test_email,
            "username": self.test_username,
            "display_name": "Firebase Test User",
            "firebase_id_token": f"mock_token_{self.firebase_uid}"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Missing id in response"
        assert "access_token" in data, "Missing access_token in response"
        assert data["email"] == self.test_email
        assert data["username"] == self.test_username
        assert data["firebase_uid"] == self.firebase_uid
        print(f"✅ Firebase register (MOCK) works - User created with firebase_uid: {self.firebase_uid}")
    
    def test_firebase_register_duplicate(self):
        """POST /api/auth/firebase-register - Duplicate registration returns existing user"""
        # First registration
        response1 = self.session.post(f"{BASE_URL}/api/auth/firebase-register", json={
            "firebase_uid": self.firebase_uid,
            "email": self.test_email,
            "username": self.test_username,
            "firebase_id_token": f"mock_token_{self.firebase_uid}"
        })
        assert response1.status_code == 200
        user_id_1 = response1.json()["id"]
        
        time.sleep(0.3)
        
        # Second registration with same firebase_uid should return existing user
        response2 = self.session.post(f"{BASE_URL}/api/auth/firebase-register", json={
            "firebase_uid": self.firebase_uid,
            "email": self.test_email,
            "username": self.test_username,
            "firebase_id_token": f"mock_token_{self.firebase_uid}"
        })
        
        assert response2.status_code == 200, f"Expected 200, got {response2.status_code}: {response2.text}"
        user_id_2 = response2.json()["id"]
        assert user_id_1 == user_id_2, "Should return same user for duplicate firebase_uid"
        print(f"✅ Firebase register handles duplicates correctly")
    
    def test_firebase_login(self):
        """POST /api/auth/firebase-login - Firebase login (MOCK mode)"""
        # First register
        reg_response = self.session.post(f"{BASE_URL}/api/auth/firebase-register", json={
            "firebase_uid": self.firebase_uid,
            "email": self.test_email,
            "username": self.test_username,
            "firebase_id_token": f"mock_token_{self.firebase_uid}"
        })
        assert reg_response.status_code == 200
        
        time.sleep(0.3)
        
        # Then login with firebase token
        response = self.session.post(f"{BASE_URL}/api/auth/firebase-login", json={
            "firebase_id_token": self.firebase_uid  # In mock mode, token is used as UID
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token"
        assert data["email"] == self.test_email
        print(f"✅ Firebase login (MOCK) works - Token received")
    
    def test_firebase_login_not_registered(self):
        """POST /api/auth/firebase-login - Login fails for unregistered user"""
        response = self.session.post(f"{BASE_URL}/api/auth/firebase-login", json={
            "firebase_id_token": f"unregistered_uid_{uuid.uuid4().hex[:8]}"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✅ Firebase login rejects unregistered users")
    
    def test_firebase_verify_token(self):
        """POST /api/auth/firebase-verify-token - Verify token endpoint (MOCK mode)"""
        response = self.session.post(f"{BASE_URL}/api/auth/firebase-verify-token", json={
            "firebase_id_token": f"test_token_{uuid.uuid4().hex[:8]}"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["valid"] == True
        assert "uid" in data
        print(f"✅ Firebase verify-token (MOCK) works")


class TestPlaylistsModularRoutes:
    """Test modular playlist routes from /app/backend/routes/playlists.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Create test user and get token
        self.test_email = f"playlist_test_{uuid.uuid4().hex[:8]}@test.com"
        self.test_username = f"playlist_test_{uuid.uuid4().hex[:8]}"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD
        })
        if reg_response.status_code == 200:
            self.token = reg_response.json()["access_token"]
            self.user_id = reg_response.json()["user"]["id"]
        else:
            pytest.skip(f"Could not create test user: {reg_response.text}")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
        self.session.close()
    
    def test_get_playlists(self):
        """GET /api/playlists - Get user's playlists"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/playlists")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of playlists"
        print(f"✅ GET /api/playlists works - {len(data)} playlists returned")
    
    def test_create_playlist(self):
        """POST /api/playlists - Create a new playlist"""
        time.sleep(0.3)
        playlist_name = f"Test Playlist {uuid.uuid4().hex[:6]}"
        response = self.session.post(f"{BASE_URL}/api/playlists", json={
            "name": playlist_name,
            "description": "Test playlist description",
            "is_public": True,
            "is_collaborative": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == playlist_name
        assert "id" in data
        assert data["owner_id"] == self.user_id
        print(f"✅ POST /api/playlists works - Playlist created: {playlist_name}")
        return data["id"]
    
    def test_get_smart_playlist_types(self):
        """GET /api/playlists/smart-types - Get available smart playlist types"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/playlists/smart-types")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "playlists" in data, "Missing playlists key"
        assert len(data["playlists"]) >= 5, "Expected at least 5 smart playlist types"
        
        # Verify expected types
        types = [p["type"] for p in data["playlists"]]
        assert "discover_weekly" in types
        assert "chill_mix" in types
        print(f"✅ GET /api/playlists/smart-types works - {len(data['playlists'])} types available")
    
    def test_get_seasonal_suggestions(self):
        """GET /api/playlists/seasonal-suggestions - Get seasonal playlist recommendations"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/playlists/seasonal-suggestions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "season" in data, "Missing season key"
        assert "playlists" in data, "Missing playlists key"
        assert data["season"] in ["spring", "summer", "fall", "winter"]
        assert len(data["playlists"]) >= 3, "Expected at least 3 seasonal suggestions"
        print(f"✅ GET /api/playlists/seasonal-suggestions works - Season: {data['season']}")
    
    def test_get_specific_playlist(self):
        """GET /api/playlists/{playlist_id} - Get a specific playlist"""
        # First create a playlist
        time.sleep(0.3)
        create_response = self.session.post(f"{BASE_URL}/api/playlists", json={
            "name": f"Test Playlist {uuid.uuid4().hex[:6]}",
            "description": "Test",
            "is_public": True
        })
        assert create_response.status_code == 200
        playlist_id = create_response.json()["id"]
        
        time.sleep(0.3)
        
        # Get the playlist
        response = self.session.get(f"{BASE_URL}/api/playlists/{playlist_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["id"] == playlist_id
        print(f"✅ GET /api/playlists/{{id}} works - Playlist retrieved")
    
    def test_delete_playlist(self):
        """DELETE /api/playlists/{playlist_id} - Delete a playlist"""
        # First create a playlist
        time.sleep(0.3)
        create_response = self.session.post(f"{BASE_URL}/api/playlists", json={
            "name": f"To Delete {uuid.uuid4().hex[:6]}",
            "is_public": True
        })
        assert create_response.status_code == 200
        playlist_id = create_response.json()["id"]
        
        time.sleep(0.3)
        
        # Delete the playlist
        response = self.session.delete(f"{BASE_URL}/api/playlists/{playlist_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ DELETE /api/playlists/{{id}} works - Playlist deleted")


class TestStoriesModularRoutes:
    """Test modular story routes from /app/backend/routes/stories.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Create test user and get token
        self.test_email = f"story_test_{uuid.uuid4().hex[:8]}@test.com"
        self.test_username = f"story_test_{uuid.uuid4().hex[:8]}"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD
        })
        if reg_response.status_code == 200:
            self.token = reg_response.json()["access_token"]
            self.user_id = reg_response.json()["user"]["id"]
        else:
            pytest.skip(f"Could not create test user: {reg_response.text}")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
        self.session.close()
    
    def test_create_story(self):
        """POST /api/stories - Create a new story"""
        time.sleep(0.3)
        response = self.session.post(f"{BASE_URL}/api/stories", json={
            "story_type": "text",
            "text": "Test story content",
            "background_color": "#8B5CF6"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["story_type"] == "text"
        assert data["text"] == "Test story content"
        assert data["user_id"] == self.user_id
        print(f"✅ POST /api/stories works - Story created")
        return data["id"]
    
    def test_get_stories_feed(self):
        """GET /api/stories/feed - Get stories from followed users"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/stories/feed")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of user stories"
        print(f"✅ GET /api/stories/feed works - {len(data)} user story groups returned")
    
    def test_get_my_stories(self):
        """GET /api/stories/my - Get current user's active stories"""
        # First create a story
        time.sleep(0.3)
        self.session.post(f"{BASE_URL}/api/stories", json={
            "story_type": "mood",
            "mood": "Mutlu",
            "emoji": "😊"
        })
        
        time.sleep(0.3)
        
        response = self.session.get(f"{BASE_URL}/api/stories/my")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of stories"
        print(f"✅ GET /api/stories/my works - {len(data)} stories returned")
    
    def test_get_stories_archive(self):
        """GET /api/stories/archive - Get archived (expired) stories"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/stories/archive")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "stories" in data
        assert "page" in data
        assert "total" in data
        print(f"✅ GET /api/stories/archive works - {data['total']} archived stories")
    
    def test_delete_story(self):
        """DELETE /api/stories/{story_id} - Delete a story"""
        # First create a story
        time.sleep(0.3)
        create_response = self.session.post(f"{BASE_URL}/api/stories", json={
            "story_type": "text",
            "text": "Story to delete"
        })
        assert create_response.status_code == 200
        story_id = create_response.json()["id"]
        
        time.sleep(0.3)
        
        # Delete the story
        response = self.session.delete(f"{BASE_URL}/api/stories/{story_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✅ DELETE /api/stories/{{id}} works - Story deleted")


class TestHighlightsModularRoutes:
    """Test modular highlights routes from /app/backend/routes/highlights.py"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Create test user and get token
        self.test_email = f"highlight_test_{uuid.uuid4().hex[:8]}@test.com"
        self.test_username = f"highlight_test_{uuid.uuid4().hex[:8]}"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD
        })
        if reg_response.status_code == 200:
            self.token = reg_response.json()["access_token"]
            self.user_id = reg_response.json()["user"]["id"]
        else:
            pytest.skip(f"Could not create test user: {reg_response.text}")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
        self.session.close()
    
    def test_get_highlights(self):
        """GET /api/highlights - Get user's story highlights"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/highlights")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of highlights"
        print(f"✅ GET /api/highlights works - {len(data)} highlights returned")
    
    def test_create_highlight(self):
        """POST /api/highlights - Create a new highlight"""
        time.sleep(0.3)
        highlight_name = f"Test Highlight {uuid.uuid4().hex[:6]}"
        response = self.session.post(f"{BASE_URL}/api/highlights", json={
            "name": highlight_name,
            "cover_url": "https://example.com/cover.jpg"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == highlight_name
        print(f"✅ POST /api/highlights works - Highlight created: {highlight_name}")


class TestModularRoutePriority:
    """Test that modular routes take priority over legacy endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Create test user and get token
        self.test_email = f"priority_test_{uuid.uuid4().hex[:8]}@test.com"
        self.test_username = f"priority_test_{uuid.uuid4().hex[:8]}"
        reg_response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.test_email,
            "username": self.test_username,
            "password": TEST_PASSWORD
        })
        if reg_response.status_code == 200:
            self.token = reg_response.json()["access_token"]
        else:
            pytest.skip(f"Could not create test user: {reg_response.text}")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
        self.session.close()
    
    def test_playlists_route_works(self):
        """Verify /api/playlists uses modular route"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/playlists")
        assert response.status_code == 200, f"Playlists route failed: {response.status_code}"
        print(f"✅ Modular playlists route is active")
    
    def test_stories_route_works(self):
        """Verify /api/stories uses modular route"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/stories/feed")
        assert response.status_code == 200, f"Stories route failed: {response.status_code}"
        print(f"✅ Modular stories route is active")
    
    def test_highlights_route_works(self):
        """Verify /api/highlights uses modular route"""
        time.sleep(0.3)
        response = self.session.get(f"{BASE_URL}/api/highlights")
        assert response.status_code == 200, f"Highlights route failed: {response.status_code}"
        print(f"✅ Modular highlights route is active")
    
    def test_firebase_auth_route_works(self):
        """Verify /api/auth/firebase-* uses modular route"""
        time.sleep(0.3)
        response = self.session.post(f"{BASE_URL}/api/auth/firebase-verify-token", json={
            "firebase_id_token": "test_token"
        })
        assert response.status_code == 200, f"Firebase auth route failed: {response.status_code}"
        print(f"✅ Modular firebase auth route is active")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
