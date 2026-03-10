# Email Service - Multi-provider SMTP (Brevo, Gmail, Outlook, custom)
# Supports: Brevo (smtp-relay.brevo.com), Gmail (smtp.gmail.com),
#           Outlook (smtp-mail.outlook.com), any SMTP server
# Falls back to console logging when SMTP is not configured

import logging
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

try:
    import aiosmtplib
except ImportError:
    aiosmtplib = None

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
EMAIL_FROM_RAW = os.environ.get("EMAIL_FROM", "SocialBeats <noreply@socialbeats.app>")

SMTP_PRESETS = {
    "brevo": {"host": "smtp-relay.brevo.com", "port": 587},
    "gmail": {"host": "smtp.gmail.com", "port": 587},
    "outlook": {"host": "smtp-mail.outlook.com", "port": 587},
    "yahoo": {"host": "smtp.mail.yahoo.com", "port": 587},
    "mailhog": {"host": "localhost", "port": 1025},
}


def _smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def _detect_provider() -> str:
    if not SMTP_HOST:
        return "none"
    host = SMTP_HOST.lower()
    if "brevo" in host or "sendinblue" in host:
        return "brevo"
    if "gmail" in host:
        return "gmail"
    if "outlook" in host or "office365" in host:
        return "outlook"
    if "yahoo" in host:
        return "yahoo"
    if "localhost" in host or "127.0.0.1" in host:
        return "mailhog"
    return "custom"


class EmailService:
    """Multi-provider email service with graceful fallback."""

    @staticmethod
    def is_configured() -> bool:
        return _smtp_configured()

    @staticmethod
    def get_provider() -> str:
        return _detect_provider()

    @staticmethod
    async def send_email(to_email: str, subject: str, html_content: str) -> dict:
        if not to_email or not isinstance(to_email, str):
            return {"status": "error", "message": "Geçersiz alıcı"}
        
        if _smtp_configured() and aiosmtplib:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = EMAIL_FROM_RAW
                msg["To"] = to_email
                msg.attach(MIMEText(html_content, "html"))
                
                use_tls = SMTP_PORT == 465
                async with aiosmtplib.SMTP(
                    hostname=SMTP_HOST,
                    port=SMTP_PORT,
                    use_tls=use_tls,
                ) as smtp:
                    if SMTP_PORT == 587:
                        await smtp.starttls()
                    if SMTP_USER and SMTP_PASS:
                        await smtp.login(SMTP_USER, SMTP_PASS)
                    await smtp.send_message(msg)
                
                provider = _detect_provider()
                logging.info(f"[{provider.upper()} SMTP] Email sent to {to_email}: {subject}")
                return {"status": "sent", "provider": provider}
            except Exception as e:
                logging.error(f"[SMTP] Email error ({_detect_provider()}): {e}")
                return {"status": "error", "message": str(e), "provider": _detect_provider()}
        
        logging.info(f"[MOCK EMAIL] To: {to_email} | Subject: {subject}")
        logging.info(f"[MOCK EMAIL] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env")
        logging.info(f"[MOCK EMAIL] Free options: Gmail (smtp.gmail.com + App Password), Brevo (300/day free)")
        return {"status": "mocked", "message": "Email servisi kapalı - .env SMTP ayarlarını kontrol edin"}

    @staticmethod
    async def send_suspicious_login_alert(user_email: str, user_name: str, details: dict):
        """Send suspicious login alert email"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0E0E0E; color: #FFFFFF; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 12px; padding: 30px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #8B5CF6; }}
                h2 {{ color: #FFFFFF; margin-bottom: 10px; }}
                .info-box {{ background-color: #0E0E0E; border-radius: 8px; padding: 15px; margin: 15px 0; }}
                .info-item {{ margin: 10px 0; }}
                .label {{ color: #888888; font-size: 12px; }}
                .value {{ color: #FFFFFF; font-size: 14px; }}
                .warning {{ color: #F59E0B; font-size: 14px; margin: 20px 0; }}
                .btn {{ display: inline-block; background-color: #8B5CF6; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎵 SocialBeats</div>
                </div>
                <h2>🔐 Yeni Giriş Tespit Edildi</h2>
                <p>Merhaba {user_name},</p>
                <p>Hesabına yeni bir cihazdan giriş yapıldı.</p>
                
                <div class="info-box">
                    <div class="info-item">
                        <div class="label">IP Adresi</div>
                        <div class="value">{details.get('ip_address', 'Bilinmiyor')}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Cihaz</div>
                        <div class="value">{details.get('user_agent', 'Bilinmiyor')}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Konum</div>
                        <div class="value">{details.get('location', 'Bilinmiyor')}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">Tarih</div>
                        <div class="value">{datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}</div>
                    </div>
                </div>
                
                <p class="warning">⚠️ Bu sen değilsen, hemen şifreni değiştir ve 2FA etkinleştir.</p>
                
                <a href="https://socialbeats.app/settings/security" class="btn">Güvenlik Ayarlarına Git</a>
            </div>
        </body>
        </html>
        """
        return await EmailService.send_email(user_email, "🔐 Yeni Giriş Tespit Edildi - SocialBeats", html)

    @staticmethod
    async def send_weekly_summary(user_email: str, user_name: str, stats: dict):
        """Send weekly music summary email"""
        hours = stats.get('total_minutes', 0) // 60
        minutes = stats.get('total_minutes', 0) % 60

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0E0E0E; color: #FFFFFF; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 12px; padding: 30px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #8B5CF6; }}
                h2 {{ color: #FFFFFF; }}
                .stats-grid {{ display: flex; justify-content: space-around; margin: 20px 0; }}
                .stat-box {{ text-align: center; background-color: #0E0E0E; border-radius: 12px; padding: 20px; flex: 1; margin: 0 5px; }}
                .stat-number {{ font-size: 28px; font-weight: bold; color: #8B5CF6; }}
                .stat-label {{ font-size: 12px; color: #888888; margin-top: 5px; }}
                .top-item {{ background-color: #0E0E0E; border-radius: 8px; padding: 15px; margin: 10px 0; }}
                .top-label {{ color: #888888; font-size: 12px; }}
                .top-value {{ color: #FFFFFF; font-size: 16px; font-weight: 500; }}
                .btn {{ display: inline-block; background-color: #8B5CF6; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎵 SocialBeats</div>
                </div>
                <h2>Merhaba {user_name}! 👋</h2>
                <p>Haftalık müzik özetin hazır:</p>
                
                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-number">{hours}s {minutes}d</div>
                        <div class="stat-label">Dinleme Süresi</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">{stats.get('total_songs', 0)}</div>
                        <div class="stat-label">Şarkı</div>
                    </div>
                </div>
                
                <div class="top-item">
                    <div class="top-label">🎤 En Çok Dinlediğin Sanatçı</div>
                    <div class="top-value">{stats.get('top_artist', 'Henüz yok')}</div>
                </div>
                
                <div class="top-item">
                    <div class="top-label">🎵 En Sevdiğin Şarkı</div>
                    <div class="top-value">{stats.get('top_song', 'Henüz yok')}</div>
                </div>
                
                <center>
                    <a href="https://socialbeats.app/stats" class="btn">Detaylı Raporu Görüntüle</a>
                </center>
            </div>
        </body>
        </html>
        """
        return await EmailService.send_email(user_email, "🎵 Haftalık Müzik Özetin - SocialBeats", html)

    @staticmethod
    async def send_password_reset(user_email: str, user_name: str, reset_token: str):
        """Send password reset email"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0E0E0E; color: #FFFFFF; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 12px; padding: 30px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #8B5CF6; }}
                h2 {{ color: #FFFFFF; }}
                .code {{ font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; background-color: #0E0E0E; padding: 20px; border-radius: 8px; margin: 20px 0; color: #8B5CF6; }}
                .warning {{ color: #888888; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎵 SocialBeats</div>
                </div>
                <h2>Şifre Sıfırlama</h2>
                <p>Merhaba {user_name},</p>
                <p>Şifreni sıfırlamak için aşağıdaki kodu kullan:</p>
                
                <div class="code">{reset_token}</div>
                
                <p class="warning">Bu kod 15 dakika geçerlidir. Bu talebi sen yapmadıysan bu emaili yoksay.</p>
            </div>
        </body>
        </html>
        """
        return await EmailService.send_email(user_email, "🔑 Şifre Sıfırlama - SocialBeats", html)

    @staticmethod
    async def send_2fa_code(user_email: str, user_name: str, code: str):
        """Send 2FA verification code email"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0E0E0E; color: #FFFFFF; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 12px; padding: 30px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #8B5CF6; }}
                h2 {{ color: #FFFFFF; }}
                .code {{ font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; background-color: #0E0E0E; padding: 20px; border-radius: 8px; margin: 20px 0; color: #8B5CF6; }}
                .warning {{ color: #888888; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎵 SocialBeats</div>
                </div>
                <h2>🔐 2FA Doğrulama</h2>
                <p>Merhaba {user_name},</p>
                <p>Hesabına giriş yapmak için aşağıdaki 2FA kodunu kullan:</p>
                
                <div class="code">{code}</div>
                
                <p class="warning">Bu kod 10 dakika geçerlidir. Bu işlemi sen yapmadıysan hemen şifreni değiştir.</p>
            </div>
        </body>
        </html>
        """
        return await EmailService.send_email(user_email, "🔐 2FA Doğrulama Kodu - SocialBeats", html)

    @staticmethod
    async def send_deletion_code(user_email: str, user_name: str, code: str):
        """Send account deletion verification code"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0E0E0E; color: #FFFFFF; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background-color: #1A1A1A; border-radius: 12px; padding: 30px; }}
                .header {{ text-align: center; margin-bottom: 20px; }}
                .logo {{ font-size: 24px; font-weight: bold; color: #8B5CF6; }}
                h2 {{ color: #FFFFFF; }}
                .code {{ font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; background-color: #0E0E0E; padding: 20px; border-radius: 8px; margin: 20px 0; color: #8B5CF6; }}
                .warning {{ color: #F59E0B; font-size: 14px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎵 SocialBeats</div>
                </div>
                <h2>Hesap Silme Onayı</h2>
                <p>Merhaba {user_name},</p>
                <p>Hesabınızı silmek için aşağıdaki kodu kullanın:</p>
                
                <div class="code">{code}</div>
                
                <p class="warning">⚠️ Bu işlem geri alınamaz. Kod 15 dakika geçerlidir.</p>
            </div>
        </body>
        </html>
        """
        return await EmailService.send_email(user_email, "🗑️ Hesap Silme Onay Kodu - SocialBeats", html)


# Singleton instance
email_service = EmailService()
