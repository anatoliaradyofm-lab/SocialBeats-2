# Utility functions for SocialBeats API
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import uuid

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# ============== PASSWORD HELPERS ==============

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

# ============== JWT HELPERS ==============

def create_access_token(user_id: str, email: str) -> str:
    """Create a JWT access token"""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def decode_token(token: str) -> Optional[dict]:
    """Alias for verify_token"""
    return verify_token(token)

# ============== TOKEN BLACKLIST ==============
# In-memory blacklist (single-instance). Use Redis in production for distributed systems.
_token_blacklist: dict = {}  # token -> expiry unix timestamp

def blacklist_token(token: str) -> None:
    """Add a JWT token to the blacklist until it expires."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        exp = payload.get("exp", 0)
        if exp > 0:
            _token_blacklist[token] = exp
    except Exception:
        pass

def is_token_blacklisted(token: str) -> bool:
    """Return True if the token has been revoked."""
    import time
    now = time.time()
    # Purge expired entries
    expired = [t for t, exp in list(_token_blacklist.items()) if exp <= now]
    for t in expired:
        _token_blacklist.pop(t, None)
    return token in _token_blacklist

# ============== ID HELPERS ==============

def generate_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())

def generate_short_id() -> str:
    """Generate a short unique ID"""
    return str(uuid.uuid4())[:8]

# ============== DATE HELPERS ==============

def now_utc() -> datetime:
    """Get current UTC datetime"""
    return datetime.now(timezone.utc)

def now_iso() -> str:
    """Get current UTC datetime as ISO string"""
    return datetime.now(timezone.utc).isoformat()

def format_duration(seconds: int) -> str:
    """Format duration from seconds to MM:SS"""
    if not seconds or not isinstance(seconds, (int, float)):
        return "0:00"
    seconds = int(seconds)
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins}:{secs:02d}"

# ============== STRING HELPERS ==============

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    import re
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text).strip('-')
    return text

def truncate(text: str, max_length: int = 100) -> str:
    """Truncate text to max length"""
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."

# ============== SANITIZATION ==============

def sanitize_username(username: str) -> str:
    """Sanitize username"""
    import re
    username = username.lower().strip()
    username = re.sub(r'[^a-z0-9_]', '', username)
    return username[:30]

def sanitize_email(email: str) -> str:
    """Sanitize email"""
    return email.lower().strip()
