"""
Test Story Reply -> DM Integration for SocialBeats
Tests: POST /api/stories/{story_id}/reply
Features tested:
- Story reply creates DM conversation
- Message contains story_preview
- Message content_type is STORY_REPLY
- Cannot reply to own story
- Conversation is reused if exists
"""

import pytest
import requests
import os
import time
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - Two different users needed
TEST_USER_1_EMAIL = "testuser2@test.com"  # Story owner
TEST_USER_1_PASSWORD = "password123"

TEST_USER_2_EMAIL = "testuser3@test.com"  # Story replier
TEST_USER_2_PASSWORD = "password123"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_STORY_REPLY_"


class TestStoryReplyAPI:
    """Story Reply -> DM Integration tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test sessions with authentication for both users"""
        # Session for User 1 (Story owner)
        self.session_user1 = requests.Session()
        self.session_user1.headers.update({"Content-Type": "application/json"})
        self.auth_token_user1 = None
        self.user1_id = None
        self.user1_username = None
        
        # Session for User 2 (Story replier)
        self.session_user2 = requests.Session()
        self.session_user2.headers.update({"Content-Type": "application/json"})
        self.auth_token_user2 = None
        self.user2_id = None
        self.user2_username = None
        
        # Track created resources for cleanup
        self.created_story_ids = []
        self.created_conversation_ids = []
        
        # Login User 1
        login_response1 = self.session_user1.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_1_EMAIL, "password": TEST_USER_1_PASSWORD}
        )
        
        if login_response1.status_code == 200:
            data = login_response1.json()
            self.auth_token_user1 = data.get("access_token")
            self.user1_id = data.get("user", {}).get("id")
            self.user1_username = data.get("user", {}).get("username")
            self.session_user1.headers.update({"Authorization": f"Bearer {self.auth_token_user1}"})
            print(f"✅ User 1 logged in: {TEST_USER_1_EMAIL} (ID: {self.user1_id})")
        else:
            print(f"❌ User 1 login failed: {login_response1.text}")
        
        # Login User 2
        login_response2 = self.session_user2.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_2_EMAIL, "password": TEST_USER_2_PASSWORD}
        )
        
        if login_response2.status_code == 200:
            data = login_response2.json()
            self.auth_token_user2 = data.get("access_token")
            self.user2_id = data.get("user", {}).get("id")
            self.user2_username = data.get("user", {}).get("username")
            self.session_user2.headers.update({"Authorization": f"Bearer {self.auth_token_user2}"})
            print(f"✅ User 2 logged in: {TEST_USER_2_EMAIL} (ID: {self.user2_id})")
        else:
            print(f"❌ User 2 login failed: {login_response2.text}")
        
        yield
        
        # Cleanup: Delete created stories
        for story_id in self.created_story_ids:
            try:
                self.session_user1.delete(f"{BASE_URL}/api/stories/{story_id}")
            except:
                pass
    
    # ============== AUTHENTICATION TESTS ==============
    
    def test_both_users_login_success(self):
        """Test both test users can login successfully"""
        assert self.auth_token_user1, f"User 1 ({TEST_USER_1_EMAIL}) login failed"
        assert self.auth_token_user2, f"User 2 ({TEST_USER_2_EMAIL}) login failed"
        assert self.user1_id != self.user2_id, "Users must be different"
        print(f"✅ Both users authenticated successfully")
        print(f"   User 1: {self.user1_username} (ID: {self.user1_id})")
        print(f"   User 2: {self.user2_username} (ID: {self.user2_id})")
    
    # ============== STORY REPLY TESTS ==============
    
    def test_reply_to_story_creates_dm(self):
        """Test: User2 replies to User1's story -> DM conversation is created"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Test story for reply",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        print(f"✅ User1 created story: {story_id}")
        
        # Step 2: User2 replies to the story
        reply_data = {
            "story_id": story_id,
            "content": f"{TEST_PREFIX}This is a reply to your story!",
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200, f"Reply to story failed: {reply_response.text}"
        reply_result = reply_response.json()
        
        # Validate response structure
        assert "message" in reply_result
        assert "conversation_id" in reply_result
        assert "reply" in reply_result
        
        conversation_id = reply_result["conversation_id"]
        reply_message = reply_result["reply"]
        
        print(f"✅ User2 replied to story, conversation created: {conversation_id}")
        
        # Validate reply message structure
        assert reply_message["content_type"] == "STORY_REPLY", f"Expected STORY_REPLY, got {reply_message['content_type']}"
        assert reply_message["content"] == reply_data["content"]
        assert reply_message["sender_id"] == self.user2_id
        assert reply_message["conversation_id"] == conversation_id
        assert reply_message["story_id"] == story_id
        
        print(f"✅ Message content_type is STORY_REPLY")
        print(f"✅ Message content matches: {reply_message['content'][:50]}...")
    
    def test_reply_message_contains_story_preview(self):
        """Test: Reply message contains story_preview object with story details"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a story with specific content
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Story with preview test content",
            "emoji": "🎶",
            "background_color": "#FF5733"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        print(f"✅ User1 created story: {story_id}")
        
        # Step 2: User2 replies to the story
        reply_data = {
            "story_id": story_id,
            "content": f"{TEST_PREFIX}Reply to check story_preview",
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200, f"Reply to story failed: {reply_response.text}"
        reply_result = reply_response.json()
        reply_message = reply_result["reply"]
        
        # Validate story_preview exists and has correct structure
        assert "story_preview" in reply_message, "story_preview missing from reply message"
        story_preview = reply_message["story_preview"]
        
        assert story_preview["story_id"] == story_id, f"story_preview.story_id mismatch"
        assert story_preview["story_type"] == "text", f"story_preview.story_type mismatch"
        assert story_preview["background_color"] == "#FF5733", f"story_preview.background_color mismatch"
        assert story_preview["text"] is not None, "story_preview.text should not be None"
        assert "created_at" in story_preview, "story_preview.created_at missing"
        
        print(f"✅ story_preview object validated:")
        print(f"   - story_id: {story_preview['story_id']}")
        print(f"   - story_type: {story_preview['story_type']}")
        print(f"   - background_color: {story_preview['background_color']}")
        print(f"   - text: {story_preview['text'][:30]}...")
    
    def test_cannot_reply_to_own_story(self):
        """Test: User cannot reply to their own story (should return 400 error)"""
        assert self.auth_token_user1, "User 1 authentication required"
        
        # Step 1: User1 creates a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Story that owner tries to reply to",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        print(f"✅ User1 created story: {story_id}")
        
        # Step 2: User1 tries to reply to their own story (should fail)
        reply_data = {
            "story_id": story_id,
            "content": f"{TEST_PREFIX}Trying to reply to my own story",
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user1.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 400, f"Expected 400 error, got {reply_response.status_code}: {reply_response.text}"
        error_data = reply_response.json()
        assert "detail" in error_data
        print(f"✅ Correctly rejected self-reply with error: {error_data['detail']}")
    
    def test_reply_to_nonexistent_story(self):
        """Test: Reply to non-existent story returns 404"""
        assert self.auth_token_user2, "User 2 authentication required"
        
        fake_story_id = "nonexistent-story-id-12345"
        
        reply_data = {
            "story_id": fake_story_id,
            "content": f"{TEST_PREFIX}Reply to fake story",
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{fake_story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 404, f"Expected 404 error, got {reply_response.status_code}: {reply_response.text}"
        print(f"✅ Correctly returned 404 for non-existent story")
    
    def test_reply_without_auth_rejected(self):
        """Test: Reply without authentication is rejected"""
        # Create unauthenticated session
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        reply_data = {
            "story_id": "any-story-id",
            "content": "Unauthorized reply attempt",
            "reply_type": "TEXT"
        }
        
        reply_response = unauth_session.post(
            f"{BASE_URL}/api/stories/any-story-id/reply",
            json=reply_data
        )
        
        # Should return 401 or 403
        assert reply_response.status_code in [401, 403], f"Expected 401/403, got {reply_response.status_code}"
        print(f"✅ Correctly rejected unauthenticated reply with status {reply_response.status_code}")
    
    def test_reply_with_emoji_type(self):
        """Test: Reply with EMOJI reply_type"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Story for emoji reply",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        
        # Step 2: User2 replies with emoji type
        reply_data = {
            "story_id": story_id,
            "content": "🔥",
            "reply_type": "EMOJI"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200, f"Emoji reply failed: {reply_response.text}"
        reply_result = reply_response.json()
        reply_message = reply_result["reply"]
        
        assert reply_message["reply_type"] == "EMOJI"
        assert reply_message["content"] == "🔥"
        print(f"✅ Emoji reply successful with reply_type: {reply_message['reply_type']}")
    
    def test_reply_with_quick_reaction_type(self):
        """Test: Reply with QUICK_REACTION reply_type"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Story for quick reaction",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        
        # Step 2: User2 replies with quick reaction
        reply_data = {
            "story_id": story_id,
            "content": "❤️",
            "reply_type": "QUICK_REACTION"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200, f"Quick reaction reply failed: {reply_response.text}"
        reply_result = reply_response.json()
        reply_message = reply_result["reply"]
        
        assert reply_message["reply_type"] == "QUICK_REACTION"
        print(f"✅ Quick reaction reply successful with reply_type: {reply_message['reply_type']}")
    
    def test_conversation_reused_for_multiple_replies(self):
        """Test: Multiple replies to same user's stories use same conversation"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates first story
        story_data_1 = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}First story for conversation reuse test",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        create_response_1 = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data_1
        )
        
        assert create_response_1.status_code == 200
        story_1 = create_response_1.json()
        story_id_1 = story_1["id"]
        self.created_story_ids.append(story_id_1)
        
        # Step 2: User2 replies to first story
        reply_data_1 = {
            "story_id": story_id_1,
            "content": f"{TEST_PREFIX}First reply",
            "reply_type": "TEXT"
        }
        
        reply_response_1 = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id_1}/reply",
            json=reply_data_1
        )
        
        assert reply_response_1.status_code == 200
        conversation_id_1 = reply_response_1.json()["conversation_id"]
        print(f"✅ First reply created conversation: {conversation_id_1}")
        
        # Step 3: User1 creates second story
        story_data_2 = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Second story for conversation reuse test",
            "emoji": "🎶",
            "background_color": "#FF5733"
        }
        
        create_response_2 = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data_2
        )
        
        assert create_response_2.status_code == 200
        story_2 = create_response_2.json()
        story_id_2 = story_2["id"]
        self.created_story_ids.append(story_id_2)
        
        # Step 4: User2 replies to second story
        reply_data_2 = {
            "story_id": story_id_2,
            "content": f"{TEST_PREFIX}Second reply",
            "reply_type": "TEXT"
        }
        
        reply_response_2 = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id_2}/reply",
            json=reply_data_2
        )
        
        assert reply_response_2.status_code == 200
        conversation_id_2 = reply_response_2.json()["conversation_id"]
        print(f"✅ Second reply used conversation: {conversation_id_2}")
        
        # Validate same conversation is reused
        assert conversation_id_1 == conversation_id_2, f"Expected same conversation, got {conversation_id_1} vs {conversation_id_2}"
        print(f"✅ Same conversation reused for multiple replies: {conversation_id_1}")
    
    def test_reply_to_mood_story(self):
        """Test: Reply to a mood type story"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a mood story
        story_data = {
            "story_type": "mood",
            "mood": "Enerjik",
            "text": f"{TEST_PREFIX}Feeling energetic today!",
            "background_color": "#FF5733"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create mood story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        print(f"✅ User1 created mood story: {story_id}")
        
        # Step 2: User2 replies to the mood story
        reply_data = {
            "story_id": story_id,
            "content": f"{TEST_PREFIX}Love the energy!",
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200, f"Reply to mood story failed: {reply_response.text}"
        reply_result = reply_response.json()
        reply_message = reply_result["reply"]
        
        # Validate story_preview contains mood story type
        story_preview = reply_message["story_preview"]
        assert story_preview["story_type"] == "mood"
        print(f"✅ Reply to mood story successful, story_preview.story_type: {story_preview['story_type']}")
    
    def test_reply_to_track_story(self):
        """Test: Reply to a track type story"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a track story
        story_data = {
            "story_type": "track",
            "track_id": "t1",  # Mock track ID
            "text": f"{TEST_PREFIX}Listening to this amazing track!",
            "background_color": "#8B5CF6"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200, f"Create track story failed: {create_response.text}"
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        print(f"✅ User1 created track story: {story_id}")
        
        # Step 2: User2 replies to the track story
        reply_data = {
            "story_id": story_id,
            "content": f"{TEST_PREFIX}Great song choice!",
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200, f"Reply to track story failed: {reply_response.text}"
        reply_result = reply_response.json()
        reply_message = reply_result["reply"]
        
        # Validate story_preview contains track story type
        story_preview = reply_message["story_preview"]
        assert story_preview["story_type"] == "track"
        print(f"✅ Reply to track story successful, story_preview.story_type: {story_preview['story_type']}")


class TestStoryReplyDMVerification:
    """Verify DM messages are correctly created from story replies"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test sessions"""
        # Session for User 1 (Story owner)
        self.session_user1 = requests.Session()
        self.session_user1.headers.update({"Content-Type": "application/json"})
        self.auth_token_user1 = None
        self.user1_id = None
        
        # Session for User 2 (Story replier)
        self.session_user2 = requests.Session()
        self.session_user2.headers.update({"Content-Type": "application/json"})
        self.auth_token_user2 = None
        self.user2_id = None
        
        self.created_story_ids = []
        
        # Login both users
        login_response1 = self.session_user1.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_1_EMAIL, "password": TEST_USER_1_PASSWORD}
        )
        
        if login_response1.status_code == 200:
            data = login_response1.json()
            self.auth_token_user1 = data.get("access_token")
            self.user1_id = data.get("user", {}).get("id")
            self.session_user1.headers.update({"Authorization": f"Bearer {self.auth_token_user1}"})
        
        login_response2 = self.session_user2.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_2_EMAIL, "password": TEST_USER_2_PASSWORD}
        )
        
        if login_response2.status_code == 200:
            data = login_response2.json()
            self.auth_token_user2 = data.get("access_token")
            self.user2_id = data.get("user", {}).get("id")
            self.session_user2.headers.update({"Authorization": f"Bearer {self.auth_token_user2}"})
        
        yield
        
        # Cleanup
        for story_id in self.created_story_ids:
            try:
                self.session_user1.delete(f"{BASE_URL}/api/stories/{story_id}")
            except:
                pass
    
    def test_dm_message_visible_to_story_owner(self):
        """Test: Story owner can see the reply in their DM conversations"""
        assert self.auth_token_user1, "User 1 authentication required"
        assert self.auth_token_user2, "User 2 authentication required"
        
        # Step 1: User1 creates a story
        story_data = {
            "story_type": "text",
            "text": f"{TEST_PREFIX}Story for DM visibility test",
            "emoji": "🎵",
            "background_color": "#8B5CF6"
        }
        
        create_response = self.session_user1.post(
            f"{BASE_URL}/api/stories",
            json=story_data
        )
        
        assert create_response.status_code == 200
        story = create_response.json()
        story_id = story["id"]
        self.created_story_ids.append(story_id)
        
        # Step 2: User2 replies to the story
        reply_content = f"{TEST_PREFIX}DM visibility test reply - {datetime.now().isoformat()}"
        reply_data = {
            "story_id": story_id,
            "content": reply_content,
            "reply_type": "TEXT"
        }
        
        reply_response = self.session_user2.post(
            f"{BASE_URL}/api/stories/{story_id}/reply",
            json=reply_data
        )
        
        assert reply_response.status_code == 200
        conversation_id = reply_response.json()["conversation_id"]
        print(f"✅ Reply sent, conversation_id: {conversation_id}")
        
        # Step 3: User1 checks their conversations
        conversations_response = self.session_user1.get(
            f"{BASE_URL}/api/messages/conversations"
        )
        
        assert conversations_response.status_code == 200, f"Get conversations failed: {conversations_response.text}"
        conversations = conversations_response.json()
        
        # Find the conversation with User2
        found_conversation = None
        for conv in conversations:
            if conv["id"] == conversation_id:
                found_conversation = conv
                break
        
        assert found_conversation is not None, f"Conversation {conversation_id} not found in User1's conversations"
        print(f"✅ User1 can see the conversation: {found_conversation['id']}")
        
        # Step 4: User1 gets messages from the conversation
        messages_response = self.session_user1.get(
            f"{BASE_URL}/api/messages/conversations/{conversation_id}/messages"
        )
        
        assert messages_response.status_code == 200, f"Get messages failed: {messages_response.text}"
        messages = messages_response.json()
        
        # Find the story reply message
        story_reply_message = None
        for msg in messages:
            if msg.get("content_type") == "STORY_REPLY" and msg.get("content") == reply_content:
                story_reply_message = msg
                break
        
        assert story_reply_message is not None, "Story reply message not found in conversation"
        assert story_reply_message["sender_id"] == self.user2_id
        assert "story_preview" in story_reply_message
        print(f"✅ User1 can see the story reply message in DM")
        print(f"   - content_type: {story_reply_message['content_type']}")
        print(f"   - content: {story_reply_message['content'][:50]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
