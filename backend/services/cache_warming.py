# Cache Warming - placeholder (SoundCloud warmed via _refresh_sc_home_job in server.py)

import logging
logger = logging.getLogger(__name__)


async def warm_music_cache(db):
    """No-op: SoundCloud home cache is refreshed by the scheduled job in server.py."""
    logger.info("warm_music_cache called (no-op — SoundCloud warmed by scheduler)")
