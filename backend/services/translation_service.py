import aiohttp
import logging

logger = logging.getLogger(__name__)

MYMEMORY_API = "https://api.mymemory.translated.net/get"
LINGVA_API = "https://lingva.ml/api/v1"


async def translate_text(text: str, target_language: str = "tr", source_language: str = "auto") -> dict:
    """Translate text using MyMemory API (free, 5000 chars/day without key, 50k with key)
    Falls back to Lingva Translate if MyMemory fails."""
    if not text or not text.strip():
        return {"translated": text, "source_language": source_language}

    src = source_language if source_language != "auto" else "en"
    lang_pair = f"{src}|{target_language}"

    try:
        async with aiohttp.ClientSession() as session:
            params = {"q": text[:500], "langpair": lang_pair}
            async with session.get(MYMEMORY_API, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    match = data.get("responseData", {})
                    translated = match.get("translatedText", "")
                    if translated and translated.lower() != text.lower():
                        return {
                            "translated": translated,
                            "source_language": src,
                            "confidence": match.get("match", 0),
                        }
    except Exception as e:
        logger.warning(f"MyMemory translation failed: {e}")

    try:
        async with aiohttp.ClientSession() as session:
            url = f"{LINGVA_API}/{src}/{target_language}/{text[:500]}"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    translated = data.get("translation", "")
                    if translated:
                        return {"translated": translated, "source_language": src}
    except Exception as e:
        logger.warning(f"Lingva translation failed: {e}")

    return {"translated": f"[{target_language.upper()}] {text}", "source_language": src}
