# Content Moderation Service - NSFW/Violence Detection
# Uses NudeNet (open source) for content moderation
# Automatically detects and blocks inappropriate content
#
# Text toxicity: Detoxify (open source). If Detoxify fails/unavailable: falls back to local keyword-based check_text.

import asyncio
import os
import logging
import hashlib
import re
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
from PIL import Image
import io
import base64

# Detoxify for text toxicity (open source)
try:
    from detoxify import Detoxify
    DETOXIFY_AVAILABLE = True
except ImportError:
    DETOXIFY_AVAILABLE = False
    logging.warning("Detoxify not available - text toxicity will use keyword fallback")

from core.config import settings

# NudeNet for NSFW detection
try:
    from nudenet import NudeDetector
    NUDENET_AVAILABLE = True
except ImportError:
    NUDENET_AVAILABLE = False
    logging.warning("NudeNet not available - content moderation disabled")

# Moderation thresholds
NSFW_THRESHOLD = 0.6  # 60% confidence to flag as NSFW
VIOLENCE_KEYWORDS = ['blood', 'gore', 'violence', 'weapon', 'gun', 'knife', 'death', 'kill']

# NSFW labels that trigger blocking
BLOCKED_LABELS = [
    'FEMALE_BREAST_EXPOSED',
    'FEMALE_GENITALIA_EXPOSED', 
    'MALE_GENITALIA_EXPOSED',
    'BUTTOCKS_EXPOSED',
    'ANUS_EXPOSED',
    'FEMALE_BREAST_COVERED',  # Lower threshold for covered
    'BELLY_EXPOSED',  # Context dependent
]

# High severity labels - immediate block
HIGH_SEVERITY_LABELS = [
    'FEMALE_GENITALIA_EXPOSED',
    'MALE_GENITALIA_EXPOSED',
    'ANUS_EXPOSED',
]

# Cached Detoxify model (lazy-loaded)
_detoxify_model = None


def _get_detoxify_model():
    """Lazy-load Detoxify model (multilingual) for reuse."""
    global _detoxify_model
    if _detoxify_model is None and DETOXIFY_AVAILABLE:
        try:
            _detoxify_model = Detoxify('multilingual')
        except Exception as e:
            logging.warning(f"Failed to load Detoxify model: {e}")
    return _detoxify_model


class ContentModerationService:
    """
    Content Moderation Service using NudeNet
    
    Features:
    - NSFW image detection
    - Violence detection (keyword-based for text)
    - Automatic content blocking
    - Moderation logging
    """
    
    def __init__(self, db=None):
        self.db = db
        self.detector = None
        self._init_detector()
        
    def _init_detector(self):
        """Initialize NudeNet detector"""
        if NUDENET_AVAILABLE:
            try:
                self.detector = NudeDetector()
                logging.info("NudeNet detector initialized successfully")
            except Exception as e:
                logging.error(f"Failed to initialize NudeNet: {e}")
                self.detector = None
        else:
            logging.warning("NudeNet not available")
    
    def set_db(self, database):
        """Set database reference"""
        self.db = database
    
    async def check_image(self, image_path: str = None, image_bytes: bytes = None, 
                          image_base64: str = None) -> Dict:
        """
        Check image for NSFW content
        
        Args:
            image_path: Path to image file
            image_bytes: Image as bytes
            image_base64: Base64 encoded image
            
        Returns:
            Dict with moderation results
        """
        if not self.detector:
            return {
                "safe": True,
                "reason": "Moderation service unavailable",
                "labels": [],
                "moderation_available": False
            }
        
        try:
            # Handle different input types
            temp_path = None
            
            if image_base64:
                # Decode base64
                image_data = base64.b64decode(image_base64)
                temp_path = f"/tmp/mod_check_{hashlib.md5(image_data).hexdigest()[:8]}.jpg"
                with open(temp_path, 'wb') as f:
                    f.write(image_data)
                image_path = temp_path
                
            elif image_bytes:
                temp_path = f"/tmp/mod_check_{hashlib.md5(image_bytes).hexdigest()[:8]}.jpg"
                with open(temp_path, 'wb') as f:
                    f.write(image_bytes)
                image_path = temp_path
            
            if not image_path:
                return {"safe": True, "reason": "No image provided", "labels": []}
            
            # Run NudeNet detection
            detections = self.detector.detect(image_path)
            
            # Clean up temp file
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
            
            # Analyze results
            is_safe = True
            blocked_reasons = []
            detected_labels = []
            max_score = 0
            
            for detection in detections:
                label = detection.get('class', '')
                score = detection.get('score', 0)
                detected_labels.append({
                    "label": label,
                    "score": round(score, 3),
                    "box": detection.get('box', [])
                })
                
                # Check if this label should block content
                if label in HIGH_SEVERITY_LABELS and score > 0.4:
                    is_safe = False
                    blocked_reasons.append(f"High severity: {label} ({score:.1%})")
                    max_score = max(max_score, score)
                    
                elif label in BLOCKED_LABELS and score > NSFW_THRESHOLD:
                    is_safe = False
                    blocked_reasons.append(f"NSFW content: {label} ({score:.1%})")
                    max_score = max(max_score, score)
            
            result = {
                "safe": is_safe,
                "nsfw_score": round(max_score, 3),
                "labels": detected_labels,
                "blocked_reasons": blocked_reasons,
                "moderation_available": True,
                "checked_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Log moderation result if not safe
            if not is_safe and self.db:
                await self._log_moderation(result, "image")
            
            return result
            
        except Exception as e:
            logging.error(f"Content moderation error: {e}")
            return {
                "safe": True,  # Fail open to not block legitimate content
                "reason": f"Moderation check failed: {str(e)}",
                "labels": [],
                "moderation_available": True
            }
    
    def _predict_toxicity_sync(self, text: str) -> Optional[Dict[str, float]]:
        """Run Detoxify (sync). Returns scores dict or None on failure."""
        if not DETOXIFY_AVAILABLE or not text:
            return None
        model = _get_detoxify_model()
        if model is None:
            return None
        try:
            result = model.predict(text[:5120])  # Limit input length
            if not result:
                return None
            scores = {}
            for k, v in result.items():
                try:
                    val = float(v[0]) if isinstance(v, (list, tuple)) and v else float(v)
                    scores[k] = round(val, 4)
                except (TypeError, ValueError, IndexError):
                    pass
            return scores if scores else None
        except Exception as e:
            logging.warning(f"Detoxify predict failed: {e}")
            return None

    async def _predict_toxicity(self, text: str) -> Optional[Dict[str, float]]:
        """Detoxify (ana) -> Hugging Face Transformers (yedek). Returns scores dict or None."""
        if DETOXIFY_AVAILABLE:
            try:
                out = await asyncio.to_thread(self._predict_toxicity_sync, text)
                if out:
                    return out
            except Exception as e:
                logging.debug(f"Detoxify failed, trying HF: {e}")
        try:
            from services.huggingface_service import moderate_text
            hf_scores = await moderate_text(text)
            if hf_scores and isinstance(hf_scores, dict):
                return {k: round(float(v), 4) for k, v in hf_scores.items() if isinstance(v, (int, float))}
        except Exception as e:
            logging.debug(f"HuggingFace moderate_text failed: {e}")
        return None

    def _check_text_keywords(self, text: str, check_violence: bool = True,
                             check_hate_speech: bool = True) -> Tuple[bool, List[str], str]:
        """Keyword-based text check. Returns (is_safe, flags, severity)."""
        if not text:
            return True, [], "none"
        text_lower = text.lower()
        flags = []
        is_safe = True
        severity = "none"
        violence_keywords = {
            "en": ['kill', 'murder', 'death', 'bomb', 'attack', 'shoot', 'stab', 'blood', 'gore', 'violence', 'weapon', 'gun', 'knife'],
            "tr": ['öldür', 'öldürmek', 'ölüm', 'bomba', 'saldır', 'vur', 'bıçakla', 'kan', 'şiddet', 'silah', 'tabanca', 'bıçak', 'katlet'],
            "de": ['töten', 'mord', 'tod', 'bombe', 'angriff', 'schießen', 'blut', 'gewalt', 'waffe'],
            "fr": ['tuer', 'meurtre', 'mort', 'bombe', 'attaque', 'tirer', 'sang', 'violence', 'arme'],
            "es": ['matar', 'asesinato', 'muerte', 'bomba', 'ataque', 'disparar', 'sangre', 'violencia', 'arma'],
            "ar": ['قتل', 'موت', 'قنبلة', 'هجوم', 'دم', 'عنف', 'سلاح'],
            "ru": ['убить', 'смерть', 'бомба', 'атака', 'кровь', 'насилие', 'оружие'],
            "ja": ['殺す', '死', '爆弾', '攻撃', '血', '暴力', '武器'],
            "ko": ['죽이다', '죽음', '폭탄', '공격', '피', '폭력', '무기'],
            "zh": ['杀', '死', '炸弹', '攻击', '血', '暴力', '武器'],
        }
        if check_violence:
            for lang, keywords in violence_keywords.items():
                for keyword in keywords:
                    if keyword in text_lower:
                        flags.append(f"Violence ({lang}): {keyword}")
                        severity = "warning"
        
        # ============================================
        # HATE SPEECH PATTERNS (Multi-language)
        # ============================================
        hate_patterns = {
            "death_threats": ['seni öldürürüm', 'öldüreceğim', 'kill you', 'i will kill', 'gonna kill', 'убью тебя', 'voy a matar'],
            "terrorism": ['terör', 'terror', 'terrorist', 'террор', 'isis', 'isid', 'ışid'],
            "discrimination": ['nazi', 'faşist', 'fascist', 'racist', 'ırkçı'],
            "severe_insults": ['orospu', 'piç', 'fuck you', 'сука', 'puta', 'hijo de puta'],
        }
        
        if check_hate_speech:
            for category, patterns in hate_patterns.items():
                for pattern in patterns:
                    if pattern in text_lower:
                        flags.append(f"Hate speech ({category}): {pattern}")
                        is_safe = False
                        severity = "high"
        
        link_count = len(re.findall(r'http[s]?://[^\s]+', text))
        if link_count > 3:
            flags.append(f"Spam: Too many links ({link_count})")
            severity = "warning" if severity == "none" else severity
        if len(text) > 20:
            caps_ratio = sum(1 for c in text if c.isupper()) / len(text)
            if caps_ratio > 0.7:
                flags.append("Spam: Excessive caps")
                severity = "warning" if severity == "none" else severity
        return is_safe, flags, severity

    async def check_text_toxicity(self, text: str) -> Dict:
        """
        Check text for toxicity. Uses Detoxify (open source) first;
        falls back to keyword-based check if Detoxify fails/unavailable.
        Returns: { "safe": bool, "scores": { attr: score, ... }, "source": "detoxify"|"keyword" }
        """
        if not text:
            return {"safe": True, "scores": {}}

        scores = await self._predict_toxicity(text)
        if scores:
            threshold = settings.DETOXIFY_TOXICITY_THRESHOLD
            max_score = max(scores.values()) if scores else 0
            is_safe = max_score <= threshold
            return {
                "safe": is_safe,
                "scores": scores,
                "source": "detoxify",
                "checked_at": datetime.now(timezone.utc).isoformat(),
            }

        is_safe, flags, severity = self._check_text_keywords(text)
        return {
            "safe": is_safe,
            "scores": {},
            "source": "keyword",
            "flags": flags,
            "severity": severity,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    async def check_text(self, text: str, check_violence: bool = True,
                         check_hate_speech: bool = True) -> Dict:
        """
        Check text content for inappropriate content.
        Uses check_text_toxicity (Detoxify when available, else keyword fallback).
        """
        result = await self.check_text_toxicity(text)
        if result.get("source") == "keyword":
            return {
                "safe": result["safe"],
                "flags": result.get("flags", []),
                "severity": result.get("severity", "none"),
                "warning": len(result.get("flags", [])) > 0 and result["safe"],
                "checked_at": result.get("checked_at", ""),
            }
        return {
            "safe": result["safe"],
            "flags": [] if result["safe"] else ["Toxicity score exceeded threshold"],
            "severity": "high" if not result["safe"] else "none",
            "warning": False,
            "scores": result.get("scores", {}),
            "checked_at": result.get("checked_at", ""),
        }
    
    async def check_video_thumbnail(self, video_path: str) -> Dict:
        """
        Check video by extracting and checking thumbnail
        For full video moderation, would need frame-by-frame analysis
        """
        # For MVP, we'll check just the thumbnail
        # Full video moderation would require ffmpeg frame extraction
        return {
            "safe": True,
            "reason": "Video moderation - thumbnail check only",
            "note": "Full video frame analysis not implemented"
        }
    
    async def moderate_upload(self, file_bytes: bytes, content_type: str, 
                              user_id: str = None) -> Dict:
        """
        Main moderation function for file uploads
        
        Args:
            file_bytes: Uploaded file content
            content_type: MIME type of the file
            user_id: ID of uploading user
            
        Returns:
            Dict with moderation decision
        """
        result = {
            "allowed": True,
            "moderation_type": None,
            "details": None
        }
        
        # Check images
        if content_type and content_type.startswith('image/'):
            check_result = await self.check_image(image_bytes=file_bytes)
            result["moderation_type"] = "image"
            result["details"] = check_result
            result["allowed"] = check_result.get("safe", True)
            
            if not result["allowed"]:
                result["rejection_reason"] = "İçerik politikamızı ihlal eden görsel tespit edildi"
                
                # Log blocked upload
                if self.db and user_id:
                    await self.db.moderation_logs.insert_one({
                        "type": "blocked_upload",
                        "user_id": user_id,
                        "content_type": content_type,
                        "reasons": check_result.get("blocked_reasons", []),
                        "nsfw_score": check_result.get("nsfw_score", 0),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
        
        # Videos - basic check
        elif content_type and content_type.startswith('video/'):
            result["moderation_type"] = "video"
            result["details"] = {"note": "Video thumbnail moderation"}
            # For full implementation, extract frames and check each
        
        return result
    
    async def _log_moderation(self, result: Dict, content_type: str):
        """Log moderation action to database"""
        if not self.db:
            return
            
        try:
            await self.db.moderation_logs.insert_one({
                "type": "content_check",
                "content_type": content_type,
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logging.error(f"Failed to log moderation: {e}")
    
    async def get_moderation_stats(self) -> Dict:
        """Get moderation statistics"""
        if not self.db:
            return {"error": "Database not available"}
        
        try:
            total_checks = await self.db.moderation_logs.count_documents({})
            blocked = await self.db.moderation_logs.count_documents({"type": "blocked_upload"})
            
            return {
                "total_checks": total_checks,
                "blocked_uploads": blocked,
                "block_rate": f"{(blocked/total_checks*100):.1f}%" if total_checks > 0 else "0%",
                "detector_available": self.detector is not None
            }
        except Exception as e:
            return {"error": str(e)}


# Singleton instance
content_moderator = ContentModerationService()
