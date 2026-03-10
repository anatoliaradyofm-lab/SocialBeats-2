# Application configuration
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

class Settings:
    # JWT Configuration
    JWT_SECRET: str = os.environ.get('JWT_SECRET', 'socialbeats-secret-key-2024')
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # YouTube API Configuration
    YOUTUBE_API_KEY: str = os.environ.get('YOUTUBE_API_KEY', '')
    YOUTUBE_API_BASE: str = "https://www.googleapis.com/youtube/v3"
    
    # Spotify API Configuration
    SPOTIFY_CLIENT_ID: str = os.environ.get('SPOTIFY_CLIENT_ID', '')
    SPOTIFY_CLIENT_SECRET: str = os.environ.get('SPOTIFY_CLIENT_SECRET', '')
    SPOTIFY_REDIRECT_URI: str = os.environ.get('SPOTIFY_REDIRECT_URI', '')

    # Detoxify (open source) - text toxicity moderation
    # Uses Detoxify when available; else: local keyword fallback
    DETOXIFY_TOXICITY_THRESHOLD: float = float(os.environ.get('DETOXIFY_TOXICITY_THRESHOLD', '0.5'))
    
    # Upload directory
    UPLOAD_DIR: Path = ROOT_DIR / "uploads"

    # App Store URLs for Rate the App
    APP_STORE_URL: str = os.environ.get('APP_STORE_URL', 'https://apps.apple.com/app/socialbeats/id000000000')
    PLAY_STORE_URL: str = os.environ.get('PLAY_STORE_URL', 'https://play.google.com/store/apps/details?id=com.socialbeats.app')
    
    def __init__(self):
        self.UPLOAD_DIR.mkdir(exist_ok=True)

settings = Settings()
