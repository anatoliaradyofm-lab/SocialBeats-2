# Models & Schemas for SocialBeats API
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# ============== AUTH MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str
    display_name: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    connected_services: List[str] = []
    created_at: str
    subscription_type: str = "free"
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    favorite_genres: List[str] = []
    favorite_artists: List[str] = []
    music_mood: Optional[str] = None
    is_verified: bool = False
    level: int = 1
    xp: int = 0
    badges: List[str] = []
    profile_theme: str = "default"
    is_online: bool = False
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None

class UserPublicProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    favorite_genres: List[str] = []
    favorite_artists: List[str] = []
    is_verified: bool = False
    is_following: bool = False
    level: int = 1
    badges: List[str] = []
    profile_theme: str = "default"
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ============== MUSIC MODELS ==============

class Track(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    artist: str
    album: str
    duration: int
    cover_url: str
    source: str
    preview_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_liked: bool = False

class Playlist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: Optional[str] = None
    cover_url: str
    track_count: int
    owner_id: str
    is_public: bool = True
    created_at: str
    tracks: List[Track] = []
    likes_count: int = 0
    is_collaborative: bool = False

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = True
    is_collaborative: bool = False

class SearchResult(BaseModel):
    tracks: List[Track]
    playlists: List[Playlist]
    artists: List[dict]
    users: List[dict] = []
    communities: List[dict] = []

class ListeningStats(BaseModel):
    total_minutes: int
    top_artists: List[dict]
    top_genres: List[dict]
    platform_breakdown: dict

# ============== POST MODELS ==============

class PostCreate(BaseModel):
    content: str
    post_type: str = "text"
    track_id: Optional[str] = None
    playlist_id: Optional[str] = None
    mood: Optional[str] = None
    rating: Optional[int] = None
    review_title: Optional[str] = None
    poll_options: Optional[List[str]] = None
    media_urls: Optional[List[str]] = None
    location: Optional[str] = None
    tagged_users: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    is_pinned: bool = False

class PostResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    author_id: str
    author_username: str
    author_display_name: Optional[str] = None
    author_avatar: Optional[str] = None
    author_verified: bool = False
    content: str
    post_type: str
    track: Optional[Track] = None
    playlist: Optional[dict] = None
    mood: Optional[str] = None
    rating: Optional[int] = None
    review_title: Optional[str] = None
    poll_options: Optional[List[dict]] = None
    media_urls: List[str] = []
    location: Optional[str] = None
    tagged_users: List[str] = []
    hashtags: List[str] = []
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_liked: bool = False
    is_saved: bool = False
    created_at: str
    is_pinned: bool = False

class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None

class CommentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    post_id: str
    author_id: str
    author_username: str
    author_avatar: Optional[str] = None
    content: str
    likes_count: int = 0
    is_liked: bool = False
    created_at: str
    replies: List["CommentResponse"] = []

# ============== STORY MODELS ==============

class StoryCreate(BaseModel):
    content_type: str = "text"
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    background_color: str = "#1a1a2e"
    font_style: str = "normal"
    music_id: Optional[str] = None
    music_title: Optional[str] = None
    music_artist: Optional[str] = None
    music_preview_url: Optional[str] = None
    location: Optional[str] = None
    mentions: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    quiz_question: Optional[str] = None
    quiz_options: Optional[List[str]] = None
    quiz_correct_index: Optional[int] = None

class StoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    avatar_url: Optional[str] = None
    content_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    background_color: str
    font_style: str
    music: Optional[dict] = None
    location: Optional[str] = None
    mentions: List[str] = []
    hashtags: List[str] = []
    link: Optional[dict] = None
    poll: Optional[dict] = None
    quiz: Optional[dict] = None
    views_count: int = 0
    reactions: dict = {}
    created_at: str
    expires_at: str

# ============== MESSAGE MODELS ==============

class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"
    media_url: Optional[str] = None
    reply_to_id: Optional[str] = None
    gif_url: Optional[str] = None

class ConversationCreate(BaseModel):
    participant_ids: List[str]
    is_group: bool = False
    group_name: Optional[str] = None

# ============== NOTIFICATION MODELS ==============

class NotificationCreate(BaseModel):
    type: str
    title: str
    body: str
    data: Optional[dict] = None

# ============== MUSIC API CACHE MODELS ==============

class MusicSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    song_id: str
    title: str
    artist: str
    album: Optional[str] = None
    duration: Optional[int] = None
    duration_formatted: Optional[str] = None
    thumbnail: Optional[str] = None
    cover_url: Optional[str] = None
    stream_url: Optional[str] = None
    cached: bool = False
    cached_at: Optional[str] = None

class MusicCacheStats(BaseModel):
    total_cached: int
    search_cached: int
    songs_cached: int

# ============== SETTINGS MODELS ==============

class UserSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notifications: dict = {}
    privacy: dict = {}
    appearance: dict = {}
    playback: dict = {}
    language: str = "tr"
    timezone: str = "Europe/Istanbul"

class FeedbackCreate(BaseModel):
    type: str
    title: str
    description: str
    category: Optional[str] = None
    app_version: Optional[str] = None
    device_info: Optional[str] = None
