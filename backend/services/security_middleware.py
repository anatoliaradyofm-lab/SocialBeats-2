# Security Middleware - Cyber Attack Prevention
# Implements multiple layers of security against common attacks

import re
import time
import hashlib
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import html

# ============================================
# RATE LIMITING
# ============================================

class RateLimiter:
    """
    In-memory rate limiter with sliding window
    Protects against DDoS and brute force attacks
    """
    
    def __init__(self):
        self.requests = defaultdict(list)  # IP -> list of timestamps
        self.blocked_ips = {}  # IP -> block_until timestamp
        
        # Rate limit configs (requests per minute)
        self.limits = {
            "default": 60,           # 60 req/min for general endpoints
            "auth": 10,              # 10 req/min for auth endpoints (login, register)
            "upload": 20,            # 20 req/min for uploads
            "search": 30,            # 30 req/min for search
            "api": 100,              # 100 req/min for API calls
        }
        
        # Block duration in seconds
        self.block_duration = 300  # 5 minutes
    
    def _get_limit_type(self, path: str) -> str:
        """Determine rate limit type based on path"""
        if '/auth/' in path:
            return "auth"
        elif '/upload' in path:
            return "upload"
        elif '/search' in path:
            return "search"
        elif '/api/' in path:
            return "api"
        return "default"
    
    def _clean_old_requests(self, ip: str, window: int = 60):
        """Remove requests older than the window"""
        cutoff = time.time() - window
        self.requests[ip] = [ts for ts in self.requests[ip] if ts > cutoff]
    
    def is_blocked(self, ip: str) -> bool:
        """Check if IP is currently blocked"""
        if ip in self.blocked_ips:
            if time.time() < self.blocked_ips[ip]:
                return True
            else:
                del self.blocked_ips[ip]
        return False
    
    def check_rate_limit(self, ip: str, path: str) -> tuple:
        """
        Check if request is within rate limit
        Returns: (allowed: bool, retry_after: int)
        """
        # Check if IP is blocked
        if self.is_blocked(ip):
            return False, int(self.blocked_ips[ip] - time.time())
        
        # Clean old requests
        self._clean_old_requests(ip)
        
        # Get limit for this endpoint type
        limit_type = self._get_limit_type(path)
        limit = self.limits.get(limit_type, self.limits["default"])
        
        # Check current request count
        current_count = len(self.requests[ip])
        
        if current_count >= limit:
            # Block IP if significantly over limit
            if current_count >= limit * 2:
                self.blocked_ips[ip] = time.time() + self.block_duration
                logging.warning(f"IP {ip} blocked for excessive requests")
            return False, 60  # Retry after 60 seconds
        
        # Record this request
        self.requests[ip].append(time.time())
        return True, 0
    
    def get_stats(self) -> Dict:
        """Get rate limiting statistics"""
        return {
            "active_ips": len(self.requests),
            "blocked_ips": len(self.blocked_ips),
            "blocked_list": list(self.blocked_ips.keys())[:10]  # First 10
        }


# Global rate limiter instance
rate_limiter = RateLimiter()


class ConnectionRateLimiter:
    def __init__(self, max_connections_per_ip=100, window_seconds=60):
        self.connections = {}
        self.max_connections = max_connections_per_ip
        self.window = window_seconds
    
    def check(self, ip: str) -> bool:
        now = time.time()
        if ip not in self.connections:
            self.connections[ip] = []
        
        self.connections[ip] = [t for t in self.connections[ip] if now - t < self.window]
        
        if len(self.connections[ip]) >= self.max_connections:
            return False
        
        self.connections[ip].append(now)
        return True


connection_rate_limiter = ConnectionRateLimiter()

MAX_BODY_SIZE = 10 * 1024 * 1024       # 10 MB for regular requests
MAX_UPLOAD_BODY_SIZE = 50 * 1024 * 1024  # 50 MB for uploads


# ============================================
# INPUT SANITIZATION
# ============================================

class InputSanitizer:
    """
    Sanitizes user input to prevent XSS, SQL/NoSQL injection
    """
    
    # Dangerous patterns
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',  # onclick, onload, etc.
        r'<iframe',
        r'<object',
        r'<embed',
        r'<link',
        r'<meta',
        r'document\.',
        r'window\.',
        r'eval\s*\(',
        r'setTimeout\s*\(',
        r'setInterval\s*\(',
    ]
    
    # NoSQL injection patterns (MongoDB)
    NOSQL_PATTERNS = [
        r'\$where',
        r'\$regex',
        r'\$ne',
        r'\$gt',
        r'\$lt',
        r'\$or',
        r'\$and',
        r'\$exists',
        r'{\s*"\$',
    ]
    
    # Path traversal patterns
    PATH_TRAVERSAL_PATTERNS = [
        r'\.\.',
        r'\./',
        r'/etc/',
        r'/proc/',
        r'/var/',
        r'%2e%2e',       # URL-encoded ..
        r'%2f',          # URL-encoded /
        r'%5c',          # URL-encoded \
    ]
    
    def __init__(self):
        self.xss_regex = [re.compile(p, re.IGNORECASE) for p in self.XSS_PATTERNS]
        self.nosql_regex = [re.compile(p, re.IGNORECASE) for p in self.NOSQL_PATTERNS]
        self.path_regex = [re.compile(p, re.IGNORECASE) for p in self.PATH_TRAVERSAL_PATTERNS]
    
    def check_xss(self, value: str) -> bool:
        """Check if value contains XSS patterns"""
        if not isinstance(value, str):
            return False
        for pattern in self.xss_regex:
            if pattern.search(value):
                return True
        return False
    
    def check_nosql_injection(self, value: str) -> bool:
        """Check if value contains NoSQL injection patterns"""
        if not isinstance(value, str):
            return False
        for pattern in self.nosql_regex:
            if pattern.search(value):
                return True
        return False
    
    def check_path_traversal(self, value: str) -> bool:
        """Check if value contains path traversal patterns"""
        if not isinstance(value, str):
            return False
        for pattern in self.path_regex:
            if pattern.search(value):
                return True
        return False
    
    def sanitize_html(self, value: str) -> str:
        """Escape HTML entities"""
        if not isinstance(value, str):
            return value
        return html.escape(value)
    
    def sanitize_input(self, value) -> tuple:
        """
        Comprehensive input sanitization
        Returns: (sanitized_value, list of detected threats)
        """
        threats = []
        
        if isinstance(value, str):
            if self.check_xss(value):
                threats.append("XSS attempt detected")
            if self.check_nosql_injection(value):
                threats.append("NoSQL injection attempt detected")
            if self.check_path_traversal(value):
                threats.append("Path traversal attempt detected")
            
            # Sanitize the value
            sanitized = self.sanitize_html(value)
            return sanitized, threats
        
        elif isinstance(value, dict):
            sanitized = {}
            for k, v in value.items():
                s_key, key_threats = self.sanitize_input(k)
                s_val, val_threats = self.sanitize_input(v)
                sanitized[s_key] = s_val
                threats.extend(key_threats)
                threats.extend(val_threats)
            return sanitized, threats
        
        elif isinstance(value, list):
            sanitized = []
            for item in value:
                s_item, item_threats = self.sanitize_input(item)
                sanitized.append(s_item)
                threats.extend(item_threats)
            return sanitized, threats
        
        return value, threats


# Global sanitizer instance
input_sanitizer = InputSanitizer()


# ============================================
# SECURITY HEADERS
# ============================================

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com; frame-src https://www.youtube.com; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline';",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Keep-Alive": "timeout=5, max=100",
    "Connection": "keep-alive",
    "X-Request-Timeout": "30",
    "Cross-Origin-Opener-Policy": "unsafe-none",
}


# ============================================
# SECURITY MIDDLEWARE
# ============================================

class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive security middleware
    - Rate limiting
    - Input validation
    - Security headers
    - Attack logging
    """
    
    def __init__(self, app, db=None):
        super().__init__(app)
        self.db = db
        self.attack_log = []  # In-memory log for quick access
        
        # Endpoints to skip rate limiting (health checks, etc.)
        self.skip_rate_limit = ['/health', '/api/health', '/docs', '/openapi.json']
    
    def set_db(self, database):
        """Set database reference"""
        self.db = database
    
    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP considering proxies"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    async def _log_attack(self, ip: str, attack_type: str, details: str, path: str):
        """Log detected attack"""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip": ip,
            "type": attack_type,
            "details": details,
            "path": path
        }
        
        self.attack_log.append(log_entry)
        
        # Keep only last 1000 entries in memory
        if len(self.attack_log) > 1000:
            self.attack_log = self.attack_log[-1000:]
        
        # Log to database if available
        if self.db:
            try:
                await self.db.security_logs.insert_one(log_entry)
            except Exception as e:
                logging.error(f"Failed to log attack: {e}")
        
        logging.warning(f"SECURITY: {attack_type} from {ip} - {details}")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through security checks"""
        
        ip = self._get_client_ip(request)
        path = request.url.path
        
        # Skip security for certain paths
        if any(path.startswith(skip) for skip in self.skip_rate_limit):
            response = await call_next(request)
            return response
        
        # 0. Connection-based rate limiting
        if not connection_rate_limiter.check(ip):
            await self._log_attack(ip, "CONNECTION_FLOOD", f"Too many connections from {ip}", path)
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Connections",
                    "message": "Çok fazla bağlantı. Lütfen bekleyin."
                }
            )
        
        # 0b. Request body size check
        content_length = request.headers.get("content-length")
        if content_length:
            size = int(content_length)
            max_allowed = MAX_UPLOAD_BODY_SIZE if '/upload' in path else MAX_BODY_SIZE
            if size > max_allowed:
                await self._log_attack(ip, "OVERSIZED_BODY", f"Body size {size} exceeds limit {max_allowed}", path)
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": "Payload Too Large",
                        "message": f"İstek gövdesi çok büyük. Maksimum: {max_allowed // (1024*1024)}MB"
                    }
                )
        
        # 1. Rate Limiting
        allowed, retry_after = rate_limiter.check_rate_limit(ip, path)
        if not allowed:
            await self._log_attack(ip, "RATE_LIMIT", f"Rate limit exceeded on {path}", path)
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": "Çok fazla istek gönderdiniz. Lütfen bekleyin.",
                    "retry_after": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        # 2. Check query parameters for injection
        for key, value in request.query_params.items():
            _, threats = input_sanitizer.sanitize_input(value)
            if threats:
                await self._log_attack(ip, "INJECTION", f"{threats} in query param: {key}", path)
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "Bad Request",
                        "message": "Geçersiz karakter tespit edildi"
                    }
                )
        
        # 3. Check path for traversal
        if input_sanitizer.check_path_traversal(path):
            await self._log_attack(ip, "PATH_TRAVERSAL", f"Path traversal in: {path}", path)
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Bad Request",
                    "message": "Geçersiz yol"
                }
            )
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            logging.error(f"Request processing error: {e}")
            raise
        
        # 4. Add security headers
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        
        return response
    
    def get_attack_stats(self) -> Dict:
        """Get attack statistics"""
        attack_types = defaultdict(int)
        unique_ips = set()
        
        for log in self.attack_log:
            attack_types[log["type"]] += 1
            unique_ips.add(log["ip"])
        
        return {
            "total_attacks_logged": len(self.attack_log),
            "unique_attackers": len(unique_ips),
            "attack_types": dict(attack_types),
            "recent_attacks": self.attack_log[-10:]  # Last 10
        }


# ============================================
# BRUTE FORCE PROTECTION
# ============================================

class BruteForceProtection:
    """
    Protects against brute force login attempts
    """
    
    def __init__(self):
        self.failed_attempts = defaultdict(list)  # IP/email -> list of timestamps
        self.locked_accounts = {}  # email -> lock_until
        
        self.max_attempts = 5  # Max failed attempts per 24h
        self.lock_duration = 86400  # 24 hour lock
        self.attempt_window = 86400  # 24 hour window
    
    def record_failed_attempt(self, identifier: str) -> bool:
        """
        Record a failed login attempt
        Returns True if account should be locked
        """
        now = time.time()
        cutoff = now - self.attempt_window
        
        # Clean old attempts
        self.failed_attempts[identifier] = [
            ts for ts in self.failed_attempts[identifier] if ts > cutoff
        ]
        
        # Record new attempt
        self.failed_attempts[identifier].append(now)
        
        # Check if should lock
        if len(self.failed_attempts[identifier]) >= self.max_attempts:
            self.locked_accounts[identifier] = now + self.lock_duration
            return True
        
        return False
    
    def is_locked(self, identifier: str) -> tuple:
        """
        Check if account/IP is locked
        Returns: (is_locked: bool, remaining_seconds: int)
        """
        if identifier in self.locked_accounts:
            lock_until = self.locked_accounts[identifier]
            if time.time() < lock_until:
                return True, int(lock_until - time.time())
            else:
                del self.locked_accounts[identifier]
        return False, 0
    
    def clear_attempts(self, identifier: str):
        """Clear failed attempts after successful login"""
        if identifier in self.failed_attempts:
            del self.failed_attempts[identifier]
        if identifier in self.locked_accounts:
            del self.locked_accounts[identifier]
    
    def get_remaining_attempts(self, identifier: str) -> int:
        """Get remaining login attempts"""
        now = time.time()
        cutoff = now - self.attempt_window
        recent_attempts = len([
            ts for ts in self.failed_attempts.get(identifier, []) if ts > cutoff
        ])
        return max(0, self.max_attempts - recent_attempts)


# Global brute force protection instance
brute_force_protection = BruteForceProtection()


# ============================================
# CSRF PROTECTION (Double-Submit Cookie)
# ============================================

def generate_csrf_token() -> str:
    """Generate CSRF token using secrets"""
    import secrets
    return secrets.token_urlsafe(32)


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection via double-submit cookie for state-changing requests"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        method = request.method.upper()
        if method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)
        
        path = request.url.path
        has_auth = request.headers.get("Authorization", "").startswith("Bearer ")
        if "/auth/login" in path or "/auth/register" in path or "/auth/verify-2fa" in path or "/auth/google/mobile" in path or has_auth:
            return await call_next(request)
        
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("X-CSRF-Token")
        
        if not cookie_token or not header_token:
            return JSONResponse(status_code=403, content={"detail": "CSRF token missing"})
        
        if cookie_token != header_token:
            return JSONResponse(status_code=403, content={"detail": "Invalid CSRF token"})
        
        return await call_next(request)


# ============================================
# HELPER FUNCTIONS
# ============================================

def validate_file_upload(filename: str, content_type: str, file_size: int) -> tuple:
    """
    Validate file upload for security
    Returns: (is_valid: bool, error_message: str)
    """
    # Allowed extensions
    ALLOWED_EXTENSIONS = {
        'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        'video': ['.mp4', '.mov', '.avi', '.webm'],
        'audio': ['.mp3', '.wav', '.m4a', '.ogg']
    }
    
    # Max file sizes (bytes)
    MAX_SIZES = {
        'image': 10 * 1024 * 1024,   # 10MB
        'video': 100 * 1024 * 1024,  # 100MB
        'audio': 20 * 1024 * 1024    # 20MB
    }
    
    # Get extension
    ext = '.' + filename.lower().split('.')[-1] if '.' in filename else ''
    
    # Determine file type
    file_type = None
    for ftype, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            file_type = ftype
            break
    
    if not file_type:
        return False, f"Dosya türü desteklenmiyor: {ext}"
    
    # Check size
    max_size = MAX_SIZES.get(file_type, 10 * 1024 * 1024)
    if file_size > max_size:
        return False, f"Dosya çok büyük. Maksimum: {max_size // (1024*1024)}MB"
    
    # Check for double extensions (security risk)
    if filename.count('.') > 1:
        return False, "Geçersiz dosya adı"
    
    # Check content type matches extension
    expected_types = {
        'image': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        'video': ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
        'audio': ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg']
    }
    
    if content_type and content_type not in expected_types.get(file_type, []):
        return False, "Dosya türü uzantıyla eşleşmiyor"
    
    return True, None


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token"""
    import secrets
    return secrets.token_urlsafe(length)
