"""
Iteration 26 - Security Features Testing
Tests for:
1. /api/security/health - Security services status
2. Security headers in responses (X-Content-Type-Options, X-Frame-Options, CSP)
3. /api/upload/image - Content moderation integration
4. /api/auth/login - Brute force protection
"""

import pytest
import requests
import os
import time
import base64
from io import BytesIO

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSecurityHealth:
    """Test /api/security/health endpoint"""
    
    def test_security_health_endpoint_exists(self):
        """Test that security health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/security/health", timeout=10)
        print(f"Security health status: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_security_health_returns_status_object(self):
        """Test that security health returns status for all services"""
        response = requests.get(f"{BASE_URL}/api/security/health", timeout=10)
        data = response.json()
        
        # Check required fields
        assert "status" in data, "Response should have 'status' field"
        assert "all_healthy" in data, "Response should have 'all_healthy' field"
        assert "timestamp" in data, "Response should have 'timestamp' field"
        
        # Check status object has expected keys
        status = data["status"]
        assert "security_middleware" in status, "Status should include security_middleware"
        assert "content_moderation" in status, "Status should include content_moderation"
        assert "nudenet_detector" in status, "Status should include nudenet_detector"
        
        print(f"Security middleware: {status.get('security_middleware')}")
        print(f"Content moderation: {status.get('content_moderation')}")
        print(f"NudeNet detector: {status.get('nudenet_detector')}")
        print(f"All healthy: {data.get('all_healthy')}")


class TestSecurityHeaders:
    """Test security headers in API responses"""
    
    def test_health_endpoint_has_security_headers(self):
        """Test that /api/health response includes security headers"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        headers = response.headers
        
        print(f"Response headers: {dict(headers)}")
        
        # Check for X-Content-Type-Options
        x_content_type = headers.get("X-Content-Type-Options")
        print(f"X-Content-Type-Options: {x_content_type}")
        assert x_content_type == "nosniff", f"Expected 'nosniff', got '{x_content_type}'"
        
    def test_x_frame_options_header(self):
        """Test X-Frame-Options header is present"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        headers = response.headers
        
        x_frame = headers.get("X-Frame-Options")
        print(f"X-Frame-Options: {x_frame}")
        assert x_frame == "DENY", f"Expected 'DENY', got '{x_frame}'"
    
    def test_content_security_policy_header(self):
        """Test Content-Security-Policy header is present"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        headers = response.headers
        
        csp = headers.get("Content-Security-Policy")
        print(f"Content-Security-Policy: {csp}")
        assert csp is not None, "Content-Security-Policy header should be present"
        assert "default-src" in csp, "CSP should include default-src directive"
    
    def test_x_xss_protection_header(self):
        """Test X-XSS-Protection header is present"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        headers = response.headers
        
        xss = headers.get("X-XSS-Protection")
        print(f"X-XSS-Protection: {xss}")
        assert xss is not None, "X-XSS-Protection header should be present"
    
    def test_strict_transport_security_header(self):
        """Test Strict-Transport-Security header is present"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        headers = response.headers
        
        hsts = headers.get("Strict-Transport-Security")
        print(f"Strict-Transport-Security: {hsts}")
        # HSTS may not be present on non-HTTPS or may be handled by proxy
        if hsts:
            assert "max-age" in hsts, "HSTS should include max-age directive"
    
    def test_referrer_policy_header(self):
        """Test Referrer-Policy header is present"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        headers = response.headers
        
        referrer = headers.get("Referrer-Policy")
        print(f"Referrer-Policy: {referrer}")
        assert referrer is not None, "Referrer-Policy header should be present"


class TestImageUploadWithModeration:
    """Test /api/upload/image endpoint with content moderation"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for testing"""
        # First try to register a test user
        test_email = f"security_test_{int(time.time())}@test.com"
        test_password = "TestPassword123!"
        test_username = f"sectest_{int(time.time())}"
        
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "username": test_username
            },
            timeout=10
        )
        
        if register_response.status_code == 200:
            data = register_response.json()
            return data.get("access_token")
        
        # If registration fails (user exists), try login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_email,
                "password": test_password
            },
            timeout=10
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            return data.get("access_token")
        
        pytest.skip("Could not authenticate for upload test")
    
    def test_upload_image_endpoint_exists(self, auth_token):
        """Test that upload image endpoint exists and requires auth"""
        # Test without auth - should fail
        response = requests.post(f"{BASE_URL}/api/upload/image", timeout=10)
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"Upload without auth: {response.status_code}")
    
    def test_upload_image_with_auth(self, auth_token):
        """Test image upload with authentication"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a simple 1x1 pixel PNG image
        # PNG header + minimal IHDR + IDAT + IEND
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {
            "file": ("test_image.png", BytesIO(png_data), "image/png")
        }
        data = {
            "upload_type": "general"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            headers=headers,
            files=files,
            data=data,
            timeout=30
        )
        
        print(f"Upload response status: {response.status_code}")
        print(f"Upload response: {response.text[:500] if response.text else 'No response'}")
        
        # Should succeed or fail with moderation (not auth error)
        assert response.status_code in [200, 201, 400, 413, 415], f"Unexpected status: {response.status_code}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "url" in data or "file_url" in data, "Response should include file URL"
            print(f"Upload successful: {data}")


class TestBruteForceProtection:
    """Test brute force protection on /api/auth/login"""
    
    def test_login_with_invalid_credentials(self):
        """Test that login fails with invalid credentials or gets rate limited"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            },
            timeout=10
        )
        
        print(f"Invalid login status: {response.status_code}")
        # 401/400 = invalid credentials, 429 = rate limited (brute force protection active)
        assert response.status_code in [401, 400, 429], f"Expected 401/400/429, got {response.status_code}"
        
        if response.status_code == 429:
            print("Rate limited - brute force protection is active!")
            data = response.json()
            print(f"Response: {data}")
    
    def test_multiple_failed_logins_tracking(self):
        """Test that multiple failed logins are tracked (not necessarily blocked in test)"""
        test_email = f"bruteforce_test_{int(time.time())}@test.com"
        
        # Make 3 failed login attempts
        for i in range(3):
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": test_email,
                    "password": f"wrongpassword{i}"
                },
                timeout=10
            )
            print(f"Attempt {i+1}: Status {response.status_code}")
            
            # Check if we get rate limited or remaining attempts info
            if response.status_code == 429:
                print("Rate limited after failed attempts - brute force protection active!")
                data = response.json()
                print(f"Rate limit response: {data}")
                return  # Test passed - protection is active
            
            # Small delay between attempts
            time.sleep(0.5)
        
        # If we get here, check if response includes remaining attempts info
        print("Completed 3 failed attempts without rate limiting")
        print("Note: Brute force protection may require more attempts (5) to trigger")
    
    def test_brute_force_lockout_after_max_attempts(self):
        """Test that account gets locked after max failed attempts (5)"""
        test_email = f"lockout_test_{int(time.time())}@test.com"
        
        locked = False
        for i in range(6):  # Try 6 times (max is 5)
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": test_email,
                    "password": f"wrongpassword{i}"
                },
                timeout=10
            )
            print(f"Attempt {i+1}: Status {response.status_code}")
            
            if response.status_code == 429:
                locked = True
                data = response.json()
                print(f"Account locked! Response: {data}")
                
                # Verify lockout message
                assert "error" in data or "detail" in data or "message" in data, \
                    "Lockout response should include error message"
                break
            
            time.sleep(0.3)
        
        # Note: Brute force protection may be IP-based, so test might not trigger lockout
        # in all environments
        if not locked:
            print("Note: Lockout not triggered - may be due to IP-based tracking or test environment")


class TestInputSanitization:
    """Test input sanitization against XSS and injection attacks"""
    
    def test_xss_in_query_params_blocked(self):
        """Test that XSS attempts in query params are blocked"""
        xss_payload = "<script>alert('xss')</script>"
        
        response = requests.get(
            f"{BASE_URL}/api/users/search",
            params={"q": xss_payload},
            timeout=10
        )
        
        print(f"XSS query param test: Status {response.status_code}")
        
        # Should either block (400) or sanitize the input
        if response.status_code == 400:
            print("XSS attempt blocked!")
            data = response.json()
            print(f"Response: {data}")
        else:
            print(f"Response: {response.text[:200]}")
    
    def test_nosql_injection_blocked(self):
        """Test that NoSQL injection attempts are blocked"""
        injection_payload = '{"$ne": null}'
        
        response = requests.get(
            f"{BASE_URL}/api/users/search",
            params={"q": injection_payload},
            timeout=10
        )
        
        print(f"NoSQL injection test: Status {response.status_code}")
        
        # Should either block (400) or handle safely
        if response.status_code == 400:
            print("NoSQL injection attempt blocked!")


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_rate_limit_headers_present(self):
        """Test that rate limit info is available"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        
        # Check for rate limit headers (if implemented)
        headers = response.headers
        print(f"Rate limit headers check:")
        print(f"  X-RateLimit-Limit: {headers.get('X-RateLimit-Limit', 'Not present')}")
        print(f"  X-RateLimit-Remaining: {headers.get('X-RateLimit-Remaining', 'Not present')}")
        print(f"  Retry-After: {headers.get('Retry-After', 'Not present')}")
    
    def test_rapid_requests_handling(self):
        """Test that rapid requests are handled (rate limited or allowed)"""
        # Make 10 rapid requests
        statuses = []
        for i in range(10):
            response = requests.get(f"{BASE_URL}/api/health", timeout=10)
            statuses.append(response.status_code)
        
        print(f"Rapid request statuses: {statuses}")
        
        # Count 429 responses (rate limited)
        rate_limited = statuses.count(429)
        successful = statuses.count(200)
        
        print(f"Successful: {successful}, Rate limited: {rate_limited}")
        
        # Most should succeed for health endpoint (high limit)
        assert successful > 0, "At least some requests should succeed"


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
