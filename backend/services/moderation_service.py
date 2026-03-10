# Content Moderation Service
# Wraps NudeNet-based content_moderation.py for backward compatibility

import logging

from services.content_moderation import content_moderator

MODERATION_THRESHOLDS = {
    "adult": 3,
    "violence": 3,
    "racy": 4,
    "medical": 4,
    "spoof": 4,
}


class ContentModerationService:
    """Backward-compatible wrapper around NudeNet content moderator"""

    def __init__(self):
        self.enabled = content_moderator.detector is not None

    async def analyze_image(self, image_content: bytes = None, image_url: str = None) -> dict:
        """
        Analyze image for inappropriate content via NudeNet.

        Returns:
            dict with safe_search scores, labels, detected text, and moderation decision
            (same shape as the old Vision API response for compatibility)
        """
        if not self.enabled:
            return self._mock_safe_result()

        try:
            result = await content_moderator.check_image(
                image_bytes=image_content
            )

            nsfw_score = result.get("nsfw_score", 0)
            is_flagged = not result.get("safe", True)
            blocked_reasons = result.get("blocked_reasons", [])

            rejection_reasons = [
                reason.replace("NSFW content:", "Adult içerik tespit edildi:")
                for reason in blocked_reasons
            ]

            score_int = min(int(nsfw_score * 4), 4)
            likelihood_map = {
                0: "VERY_UNLIKELY",
                1: "UNLIKELY",
                2: "POSSIBLE",
                3: "LIKELY",
                4: "VERY_LIKELY",
            }
            likelihood_name = likelihood_map.get(score_int, "VERY_UNLIKELY")

            safe_search_result = {
                "adult": {"likelihood": likelihood_name, "score": score_int},
                "violence": {"likelihood": "VERY_UNLIKELY", "score": 0},
                "racy": {"likelihood": likelihood_name, "score": score_int},
                "medical": {"likelihood": "VERY_UNLIKELY", "score": 0},
                "spoof": {"likelihood": "VERY_UNLIKELY", "score": 0},
            }

            detected_labels = [
                {"description": det.get("label", ""), "score": det.get("score", 0)}
                for det in result.get("labels", [])
            ]

            return {
                "safe_search": safe_search_result,
                "labels": detected_labels,
                "detected_text": None,
                "flagged": is_flagged,
                "rejection_reasons": rejection_reasons,
                "confidence_score": round(nsfw_score, 3),
                "api_used": True,
            }

        except Exception as e:
            logging.error(f"NudeNet moderation error: {e}")
            return self._mock_safe_result()

    def _mock_safe_result(self) -> dict:
        """Return mock safe result when NudeNet is not available"""
        return {
            "safe_search": {
                "adult": {"likelihood": "VERY_UNLIKELY", "score": 0},
                "violence": {"likelihood": "VERY_UNLIKELY", "score": 0},
                "racy": {"likelihood": "VERY_UNLIKELY", "score": 0},
                "medical": {"likelihood": "VERY_UNLIKELY", "score": 0},
                "spoof": {"likelihood": "VERY_UNLIKELY", "score": 0},
            },
            "labels": [],
            "detected_text": None,
            "flagged": False,
            "rejection_reasons": [],
            "confidence_score": 0.0,
            "api_used": False,
            "mock": True,
        }


moderation_service = ContentModerationService()
