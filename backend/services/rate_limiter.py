# Rate Limiting & Bot Detection Service
# Provides in-memory rate limiting with bot detection

import time
import logging
from collections import defaultdict


class RateLimiter:
    """Advanced in-memory rate limiter with bot detection"""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked_ips = {}  # IP -> block_until timestamp
        self.suspicious_ips = defaultdict(int)  # IP -> suspicion score
        self.request_patterns = defaultdict(list)  # IP -> list of (timestamp, endpoint)
    
    def is_blocked(self, ip: str) -> bool:
        """Check if IP is blocked"""
        if ip in self.blocked_ips:
            if time.time() < self.blocked_ips[ip]:
                return True
            else:
                del self.blocked_ips[ip]
        return False
    
    def block_ip(self, ip: str, duration_minutes: int = 30):
        """Block an IP for specified duration"""
        self.blocked_ips[ip] = time.time() + (duration_minutes * 60)
        logging.warning(f"IP blocked: {ip} for {duration_minutes} minutes")
    
    def check_rate_limit(self, ip: str, limit: int = 100, window_seconds: int = 60) -> bool:
        """Check if request is within rate limit. Returns True if allowed."""
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
        
        if len(self.requests[ip]) >= limit:
            # Increase suspicion score
            self.suspicious_ips[ip] += 1
            if self.suspicious_ips[ip] >= 5:
                # Auto-block after 5 rate limit violations
                self.block_ip(ip, duration_minutes=60)
            return False
        
        self.requests[ip].append(now)
        return True
    
    def get_remaining(self, ip: str, limit: int = 100, window_seconds: int = 60) -> int:
        """Get remaining requests for IP"""
        now = time.time()
        window_start = now - window_seconds
        self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
        return max(0, limit - len(self.requests[ip]))
    
    def detect_bot_patterns(self, ip: str, endpoint: str, user_agent: str = "") -> bool:
        """
        Detect potential bot patterns. Returns True if suspicious.
        Heuristics:
        - Too fast requests (< 100ms between requests)
        - No user agent or suspicious user agent
        - Repeated exact same endpoint requests
        """
        now = time.time()
        
        # Check user agent
        suspicious_agents = ['curl', 'wget', 'python-requests', 'scrapy', 'bot', 'spider']
        if not user_agent or any(agent in user_agent.lower() for agent in suspicious_agents):
            self.suspicious_ips[ip] += 1
        
        # Track request pattern
        self.request_patterns[ip].append((now, endpoint))
        
        # Keep only last 100 requests
        self.request_patterns[ip] = self.request_patterns[ip][-100:]
        
        patterns = self.request_patterns[ip]
        if len(patterns) >= 5:
            # Check for too fast requests (< 100ms intervals)
            recent = patterns[-5:]
            intervals = [recent[i+1][0] - recent[i][0] for i in range(len(recent)-1)]
            if all(interval < 0.1 for interval in intervals):  # All < 100ms
                self.suspicious_ips[ip] += 3
                logging.warning(f"Bot pattern detected (fast requests): {ip}")
            
            # Check for repeated same endpoint
            recent_endpoints = [p[1] for p in recent]
            if len(set(recent_endpoints)) == 1 and recent_endpoints[0] not in ['/api/health', '/']:
                self.suspicious_ips[ip] += 1
        
        # Auto-block if too suspicious
        if self.suspicious_ips[ip] >= 10:
            self.block_ip(ip, duration_minutes=120)
            return True
        
        return self.suspicious_ips[ip] >= 5
    
    def get_blocked_ips(self) -> list:
        """Get list of currently blocked IPs"""
        now = time.time()
        return [
            {"ip": ip, "blocked_until": blocked_until, "remaining_seconds": int(blocked_until - now)}
            for ip, blocked_until in self.blocked_ips.items()
            if blocked_until > now
        ]
    
    def unblock_ip(self, ip: str) -> bool:
        """Manually unblock an IP"""
        if ip in self.blocked_ips:
            del self.blocked_ips[ip]
            self.suspicious_ips[ip] = 0
            return True
        return False
    
    def get_stats(self) -> dict:
        """Get rate limiter statistics"""
        return {
            "total_tracked_ips": len(self.requests),
            "blocked_ips_count": len([ip for ip, t in self.blocked_ips.items() if t > time.time()]),
            "suspicious_ips": dict(self.suspicious_ips)
        }


# Singleton instance
rate_limiter = RateLimiter()
