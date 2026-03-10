"""
Evolution API Service - Uygulama ici mesajlasma sunucusu
WhatsApp baglantisi YOK - Kullanicilarin WhatsApp'ina dokunulmaz.
Evolution API, mesaj routing, depolama ve gercek zamanli iletisim icin kullanilir.
Mesajlar kullanici ID'leri uzerinden yonetilir (telefon numarasi degil).

Ozellikler:
- Birebir sohbet (DM)
- Grup sohbeti (256+ kisi)
- Medya paylasimi (foto, video, sesli mesaj)
- Mesaj tepkileri (emoji)
- Okundu bilgisi
- Yaziyor gostergesi
- Mesaj silme/duzenleme
- Konum paylasimi
- Iletisim karti paylasimi
- Webhook entegrasyonu (gercek zamanli bildirim)
"""
import os
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

EVOLUTION_URL = os.getenv("EVOLUTION_API_URL", "")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "socialbeats")


def is_available() -> bool:
    """Evolution API servisinin aktif olup olmadigini kontrol et"""
    return bool(EVOLUTION_URL and EVOLUTION_API_KEY)


async def _request(method: str, endpoint: str, data: dict = None) -> Optional[dict]:
    """Evolution API'ye HTTP istegi gonder"""
    if not is_available():
        return None
    try:
        import httpx
        headers = {"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}
        url = f"{EVOLUTION_URL}/{endpoint}"

        async with httpx.AsyncClient(timeout=15) as client:
            if method == "GET":
                resp = await client.get(url, headers=headers)
            elif method == "POST":
                resp = await client.post(url, json=data or {}, headers=headers)
            elif method == "PUT":
                resp = await client.put(url, json=data or {}, headers=headers)
            elif method == "DELETE":
                resp = await client.delete(url, headers=headers)
            else:
                return None

            if resp.status_code in (200, 201):
                try:
                    return resp.json()
                except Exception:
                    return {"status": "ok"}
            logger.warning(f"Evolution API {endpoint}: {resp.status_code}")
            return None
    except Exception as e:
        logger.warning(f"Evolution API error ({endpoint}): {e}")
        return None


# =====================================================
# INSTANCE YONETIMI
# =====================================================

async def create_instance(instance_name: str = None) -> Optional[dict]:
    """Mesajlasma instance olustur"""
    name = instance_name or EVOLUTION_INSTANCE
    return await _request("POST", "instance/create", {
        "instanceName": name,
    })


async def get_instance_status(instance_name: str = None) -> Optional[dict]:
    """Instance durumunu kontrol et"""
    name = instance_name or EVOLUTION_INSTANCE
    return await _request("GET", f"instance/connectionState/{name}")


async def restart_instance(instance_name: str = None) -> Optional[dict]:
    """Instance yeniden baslat"""
    name = instance_name or EVOLUTION_INSTANCE
    return await _request("PUT", f"instance/restart/{name}")


# =====================================================
# BIREBIR MESAJLASMA
# Kullanici ID'si uzerinden (telefon numarasi DEGIL)
# =====================================================

async def send_text(to_user_id: str, message: str) -> Optional[dict]:
    """Birebir metin mesaji gonder"""
    return await _request("POST", f"message/sendText/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "text": message,
    })


async def send_media(to_user_id: str, media_url: str, caption: str = "",
                     media_type: str = "image") -> Optional[dict]:
    """Medya mesaji gonder (image, video, audio, document)"""
    return await _request("POST", f"message/sendMedia/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "mediatype": media_type,
        "media": media_url,
        "caption": caption,
    })


async def send_audio(to_user_id: str, audio_url: str) -> Optional[dict]:
    """Sesli mesaj gonder"""
    return await _request("POST", f"message/sendWhatsAppAudio/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "audio": audio_url,
    })


async def send_location(to_user_id: str, lat: float, lng: float,
                        name: str = "", address: str = "") -> Optional[dict]:
    """Konum mesaji gonder"""
    return await _request("POST", f"message/sendLocation/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "latitude": lat,
        "longitude": lng,
        "name": name,
        "address": address,
    })


async def send_contact(to_user_id: str, contact_name: str,
                       contact_info: str) -> Optional[dict]:
    """Kisi karti gonder"""
    return await _request("POST", f"message/sendContact/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "contact": [{"fullName": contact_name, "phoneNumber": contact_info}],
    })


async def send_sticker(to_user_id: str, sticker_url: str) -> Optional[dict]:
    """Sticker gonder"""
    return await _request("POST", f"message/sendSticker/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "sticker": sticker_url,
    })


async def send_reaction(message_id: str, emoji: str) -> Optional[dict]:
    """Mesaja emoji tepki gonder"""
    return await _request("POST", f"message/sendReaction/{EVOLUTION_INSTANCE}", {
        "key": {"id": message_id},
        "reaction": emoji,
    })


async def delete_message_evo(message_id: str) -> Optional[dict]:
    """Evolution API uzerinden mesaj sil"""
    return await _request("DELETE", f"message/delete/{EVOLUTION_INSTANCE}", {
        "messageId": message_id,
    })


# =====================================================
# GRUP YONETIMI
# =====================================================

async def create_group(group_name: str, participant_ids: List[str]) -> Optional[dict]:
    """Grup olustur (kullanici ID'leri ile)"""
    return await _request("POST", f"group/create/{EVOLUTION_INSTANCE}", {
        "subject": group_name,
        "participants": participant_ids,
    })


async def add_group_participants(group_id: str,
                                 participant_ids: List[str]) -> Optional[dict]:
    """Gruba uye ekle"""
    return await _request("POST", f"group/updateParticipant/{EVOLUTION_INSTANCE}", {
        "groupJid": group_id,
        "action": "add",
        "participants": participant_ids,
    })


async def remove_group_participants(group_id: str,
                                    participant_ids: List[str]) -> Optional[dict]:
    """Gruptan uye cikar"""
    return await _request("POST", f"group/updateParticipant/{EVOLUTION_INSTANCE}", {
        "groupJid": group_id,
        "action": "remove",
        "participants": participant_ids,
    })


async def update_group_subject(group_id: str, new_subject: str) -> Optional[dict]:
    """Grup adini degistir"""
    return await _request("PUT", f"group/updateGroupSubject/{EVOLUTION_INSTANCE}", {
        "groupJid": group_id,
        "subject": new_subject,
    })


async def update_group_description(group_id: str, description: str) -> Optional[dict]:
    """Grup aciklamasini degistir"""
    return await _request("PUT", f"group/updateGroupDescription/{EVOLUTION_INSTANCE}", {
        "groupJid": group_id,
        "description": description,
    })


async def get_group_info(group_id: str) -> Optional[dict]:
    """Grup bilgilerini al"""
    return await _request("GET",
        f"group/findGroupInfos/{EVOLUTION_INSTANCE}?groupJid={group_id}")


async def get_all_groups() -> list:
    """Tum gruplari listele"""
    result = await _request("GET", f"group/fetchAllGroups/{EVOLUTION_INSTANCE}")
    return result if isinstance(result, list) else []


# =====================================================
# GRUP MESAJLASMA
# =====================================================

async def send_group_text(group_id: str, message: str) -> Optional[dict]:
    """Gruba metin mesaji gonder"""
    return await _request("POST", f"message/sendText/{EVOLUTION_INSTANCE}", {
        "number": group_id,
        "text": message,
    })


async def send_group_media(group_id: str, media_url: str, caption: str = "",
                           media_type: str = "image") -> Optional[dict]:
    """Gruba medya mesaji gonder"""
    return await _request("POST", f"message/sendMedia/{EVOLUTION_INSTANCE}", {
        "number": group_id,
        "mediatype": media_type,
        "media": media_url,
        "caption": caption,
    })


# =====================================================
# PRESENCE & READ RECEIPTS
# =====================================================

async def send_presence(to_user_id: str, presence: str = "composing") -> Optional[dict]:
    """Yaziyor gostergesi gonder (composing / recording / paused)"""
    return await _request("POST", f"chat/sendPresence/{EVOLUTION_INSTANCE}", {
        "number": to_user_id,
        "options": {"presence": presence},
    })


async def mark_as_read(message_id: str) -> Optional[dict]:
    """Mesaji okundu olarak isaretle"""
    return await _request("POST", f"chat/markMessageAsRead/{EVOLUTION_INSTANCE}", {
        "readMessages": [{"id": message_id}],
    })


# =====================================================
# WEBHOOK
# =====================================================

async def set_webhook(webhook_url: str, instance_name: str = None) -> Optional[dict]:
    """Mesaj bildirimleri icin webhook URL ayarla"""
    name = instance_name or EVOLUTION_INSTANCE
    return await _request("POST", f"webhook/set/{name}", {
        "url": webhook_url,
        "webhook_by_events": True,
        "events": [
            "messages.upsert", "messages.update",
            "groups.upsert", "groups.update",
            "group-participants.update",
            "connection.update",
        ],
    })


# =====================================================
# STATUS & HEALTH
# =====================================================

def get_status() -> dict:
    """Servis durumu"""
    return {
        "service": "Evolution API",
        "mode": "in-app-only",
        "whatsapp_connected": False,
        "available": is_available(),
        "instance": EVOLUTION_INSTANCE,
        "url": EVOLUTION_URL[:40] + "..." if len(EVOLUTION_URL) > 40 else EVOLUTION_URL,
        "features": [
            "birebir_sohbet", "grup_sohbet", "medya_paylasimi",
            "mesaj_tepkileri", "okundu_bilgisi", "yaziyor_gostergesi",
            "mesaj_silme_duzenleme", "konum_paylasimi",
            "iletisim_karti", "webhook"
        ]
    }


async def health_check() -> dict:
    """Saglik kontrolu"""
    if not is_available():
        return {"status": "not_configured", "available": False}
    status = await get_instance_status()
    return {
        "status": "connected" if status else "unreachable",
        "available": is_available(),
        "mode": "in-app-only",
        "instance_state": status
    }
