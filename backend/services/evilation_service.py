"""
WhatsApp OTP Service — Evolution API (ücretsiz, self-hosted)
OTP kodlarını bağlı WhatsApp hesabından Evolution API üzerinden gönderir.
.env içinde EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE ayarlanmalı.

Deployment seçenekleri:
  - Railway:      https://railway.app  (önerilen, ücretsiz 500 saat/ay)
  - Docker lokal: docker run -p 8080:8080 atendai/evolution-api:latest
  - VPS:          Hetzner/DigitalOcean üzerinde Docker ile
"""
import httpx
import os
import logging
import random
import string

logger = logging.getLogger(__name__)

EVOLUTION_API_URL  = os.environ.get('EVOLUTION_API_URL', '')
EVOLUTION_API_KEY  = os.environ.get('EVOLUTION_API_KEY', '')
EVOLUTION_INSTANCE = os.environ.get('EVOLUTION_INSTANCE', 'socialbeats')


async def send_whatsapp_otp(phone: str, code: str) -> bool:
    """
    WhatsApp üzerinden OTP kodu gönderir (Evolution API).
    EVOLUTION_API_KEY tanımlı değilse sadece log'a yazar (dev mod).
    Telefon: + ile veya olmadan (örn. +905551234567 veya 905551234567)
    """
    if not EVOLUTION_API_KEY or not EVOLUTION_API_URL:
        logger.warning(f"[EVOLUTION] API ayarlanmamış — dev mod OTP: phone={phone} code={code}")
        return True

    # Evolution API + kabul etmez, sadece rakamlar
    number = phone.lstrip('+').replace(' ', '').replace('-', '')

    message = (
        f"🎵 *SocialBeats* doğrulama kodunuz:\n\n"
        f"*{code}*\n\n"
        f"Bu kod 10 dakika geçerlidir.\n"
        f"Kodu kimseyle paylaşmayın."
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}",
                headers={
                    "apikey": EVOLUTION_API_KEY,
                    "Content-Type": "application/json",
                },
                json={"number": number, "text": message},
            )
            if resp.status_code in (200, 201):
                logger.info(f"[EVOLUTION] OTP gönderildi: {phone}")
                return True
            logger.error(f"[EVOLUTION] Hata {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as exc:
        logger.error(f"[EVOLUTION] İstek hatası: {exc}")
        return False


def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))
