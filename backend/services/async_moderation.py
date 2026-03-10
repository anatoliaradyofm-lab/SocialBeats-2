# Async Content Moderation Queue
# Background processing for faster uploads with delayed moderation
# Ücretsiz - Python asyncio ve FastAPI BackgroundTasks kullanıyor

import asyncio
import logging
from typing import Dict, List, Optional, Callable
from datetime import datetime, timezone
from collections import deque
import uuid

logger = logging.getLogger(__name__)

class AsyncModerationQueue:
    """
    Asenkron içerik moderasyon kuyruğu
    
    Çalışma şekli:
    1. Kullanıcı görsel/video yükler → Hemen kabul edilir
    2. İçerik kuyruğa eklenir → Arka planda moderasyon başlar
    3. NSFW tespit edilirse → İçerik silinir + kullanıcıya bildirim
    
    Bu sayede yükleme hızlı, moderasyon arka planda çalışır
    """
    
    def __init__(self, db=None):
        self.db = db
        self.queue = deque(maxlen=1000)  # Son 1000 item
        self.processing = False
        self.processed_count = 0
        self.blocked_count = 0
        self._task = None
        self._content_moderator = None
        
    def set_db(self, database):
        """Set database reference"""
        self.db = database
    
    def set_moderator(self, moderator):
        """Set content moderator reference"""
        self._content_moderator = moderator
    
    async def add_to_queue(self, item: Dict) -> str:
        """
        Kuyruğa moderasyon görevi ekle
        
        Args:
            item: {
                "id": str,
                "type": "image" | "video",
                "file_path": str,
                "file_url": str,
                "user_id": str,
                "upload_type": str,  # avatar, post, story, etc.
                "content_type": str
            }
        
        Returns:
            Queue item ID
        """
        queue_id = str(uuid.uuid4())
        queue_item = {
            "queue_id": queue_id,
            "status": "pending",
            "added_at": datetime.now(timezone.utc).isoformat(),
            **item
        }
        
        self.queue.append(queue_item)
        
        # Log to database
        if self.db:
            try:
                await self.db.moderation_queue.insert_one({
                    **queue_item,
                    "processed_at": None,
                    "result": None
                })
            except Exception as e:
                logger.error(f"Failed to log queue item: {e}")
        
        # Start processing if not already running
        if not self.processing:
            asyncio.create_task(self._process_queue())
        
        return queue_id
    
    async def _process_queue(self):
        """Kuyruğu işle - arka plan görevi"""
        if self.processing:
            return
        
        self.processing = True
        logger.info("Starting async moderation queue processing")
        
        try:
            while self.queue:
                item = self.queue.popleft()
                
                try:
                    await self._process_item(item)
                    self.processed_count += 1
                except Exception as e:
                    logger.error(f"Error processing queue item {item.get('queue_id')}: {e}")
                
                # Small delay between items to not overload
                await asyncio.sleep(0.5)
        
        finally:
            self.processing = False
            logger.info(f"Queue processing complete. Processed: {self.processed_count}, Blocked: {self.blocked_count}")
    
    async def _process_item(self, item: Dict):
        """Tek bir kuyruğa alınmış içeriği işle"""
        queue_id = item.get("queue_id")
        file_path = item.get("file_path")
        user_id = item.get("user_id")
        content_type = item.get("content_type", "")
        
        logger.info(f"Processing moderation item {queue_id}")
        
        # Import here to avoid circular imports
        if not self._content_moderator:
            try:
                from services.content_moderation import content_moderator
                self._content_moderator = content_moderator
            except ImportError:
                logger.error("Content moderator not available")
                return
        
        result = None
        
        # Moderate based on type
        if content_type.startswith("image/") and file_path:
            result = await self._content_moderator.check_image(image_path=file_path)
        elif content_type.startswith("video/"):
            # Video moderation - extract frames if ffmpeg available
            result = await self._moderate_video_frames(file_path)
        
        if not result:
            return
        
        # Update database
        if self.db:
            await self.db.moderation_queue.update_one(
                {"queue_id": queue_id},
                {"$set": {
                    "status": "processed",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "result": result
                }}
            )
        
        # If content is not safe, take action
        if not result.get("safe", True):
            self.blocked_count += 1
            await self._handle_violation(item, result)
    
    async def _moderate_video_frames(self, video_path: str) -> Dict:
        """
        Video frame'lerini analiz et
        ffmpeg ile frame çıkar, her birini kontrol et
        """
        import os
        import subprocess
        import tempfile
        
        if not video_path or not os.path.exists(video_path):
            return {"safe": True, "reason": "Video file not found"}
        
        # Check if ffmpeg is available
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            return {"safe": True, "reason": "ffmpeg not available for video moderation"}
        
        # Create temp directory for frames
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract frames (1 frame per 5 seconds, max 10 frames)
            try:
                subprocess.run([
                    "ffmpeg", "-i", video_path,
                    "-vf", "fps=1/5",  # 1 frame every 5 seconds
                    "-frames:v", "10",  # Max 10 frames
                    "-q:v", "2",
                    f"{temp_dir}/frame_%03d.jpg"
                ], capture_output=True, timeout=30)
            except subprocess.TimeoutExpired:
                return {"safe": True, "reason": "Video processing timeout"}
            except Exception as e:
                return {"safe": True, "reason": f"Frame extraction failed: {e}"}
            
            # Check each frame
            import glob
            frames = glob.glob(f"{temp_dir}/frame_*.jpg")
            
            if not frames:
                return {"safe": True, "reason": "No frames extracted"}
            
            violations = []
            for frame_path in frames:
                if self._content_moderator:
                    frame_result = await self._content_moderator.check_image(image_path=frame_path)
                    if not frame_result.get("safe", True):
                        violations.append({
                            "frame": os.path.basename(frame_path),
                            "labels": frame_result.get("labels", []),
                            "score": frame_result.get("nsfw_score", 0)
                        })
            
            if violations:
                return {
                    "safe": False,
                    "nsfw_score": max(v["score"] for v in violations),
                    "violations": violations,
                    "frames_checked": len(frames),
                    "video_moderation": True
                }
            
            return {
                "safe": True,
                "frames_checked": len(frames),
                "video_moderation": True
            }
    
    async def _handle_violation(self, item: Dict, result: Dict):
        """İhlal tespit edildiğinde işlem yap"""
        import os
        
        user_id = item.get("user_id")
        file_path = item.get("file_path")
        file_url = item.get("file_url")
        upload_type = item.get("upload_type", "general")
        
        logger.warning(f"Content violation detected for user {user_id}: {result.get('blocked_reasons', result.get('violations', []))}")
        
        # 1. Delete the file
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted violating file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete file: {e}")
        
        # 2. Remove from database (posts, stories, etc.)
        if self.db and file_url:
            # Remove from posts
            await self.db.posts.delete_many({"image_url": file_url})
            await self.db.posts.delete_many({"video_url": file_url})
            
            # Remove from stories
            await self.db.stories.delete_many({"media_url": file_url})
            
            # If avatar, reset to default
            if upload_type == "avatar":
                await self.db.users.update_one(
                    {"id": user_id},
                    {"$set": {"avatar_url": None}}
                )
        
        # 3. Send notification to user
        if self.db and user_id:
            await self.db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "content_violation",
                "content": "Yüklediğiniz içerik topluluk kurallarımızı ihlal ettiği için kaldırıldı. Lütfen içerik politikamızı inceleyin.",
                "severity": "warning",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # 4. Log violation
        if self.db:
            await self.db.content_violations.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "file_url": file_url,
                "upload_type": upload_type,
                "violation_type": "nsfw" if result.get("nsfw_score", 0) > 0 else "other",
                "details": result,
                "action_taken": "deleted",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # 5. Check for repeat offenders (ban after 3 violations)
        if self.db and user_id:
            violation_count = await self.db.content_violations.count_documents({"user_id": user_id})
            if violation_count >= 3:
                # Temporary ban
                await self.db.users.update_one(
                    {"id": user_id},
                    {"$set": {
                        "is_banned": True,
                        "ban_reason": "Tekrarlanan içerik politikası ihlali",
                        "banned_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.warning(f"User {user_id} banned for repeated violations")
    
    def get_stats(self) -> Dict:
        """Kuyruk istatistiklerini getir"""
        return {
            "queue_size": len(self.queue),
            "processing": self.processing,
            "total_processed": self.processed_count,
            "total_blocked": self.blocked_count,
            "block_rate": f"{(self.blocked_count/self.processed_count*100):.1f}%" if self.processed_count > 0 else "0%"
        }


# Singleton instance
moderation_queue = AsyncModerationQueue()
