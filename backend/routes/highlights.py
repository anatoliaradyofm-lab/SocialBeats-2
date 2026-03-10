# Highlights Routes
# Story highlights management endpoints
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/highlights", tags=["highlights"])

# =====================================================
# MODELLER
# =====================================================

class HighlightCreate(BaseModel):
    name: str
    cover_url: Optional[str] = None
    story_ids: List[str] = []

# =====================================================
# HIGHLIGHTS ENDPOINTS
# =====================================================

@router.get("")
async def get_user_highlights(current_user: dict = Depends(get_current_user)):
    """Get current user's highlights"""
    highlights = await db.highlights.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for hl in highlights:
        story_count = await db.highlight_stories.count_documents({"highlight_id": hl["id"]})
        hl["story_count"] = story_count
        
        if not hl.get("cover_url"):
            first = await db.highlight_stories.find_one(
                {"highlight_id": hl["id"]},
                {"_id": 0}
            )
            if first:
                story = await db.stories.find_one({"id": first["story_id"]}, {"_id": 0})
                if story:
                    hl["cover_url"] = story.get("media_url") or story.get("background_color", "#8B5CF6")
    
    return highlights

@router.post("")
async def create_highlight(
    highlight_data: HighlightCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new highlight"""
    highlight_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    highlight = {
        "id": highlight_id,
        "user_id": current_user["id"],
        "name": highlight_data.name,
        "cover_url": highlight_data.cover_url,
        "created_at": now
    }
    
    await db.highlights.insert_one(highlight)
    
    for story_id in highlight_data.story_ids:
        await db.highlight_stories.insert_one({
            "id": str(uuid.uuid4()),
            "highlight_id": highlight_id,
            "story_id": story_id,
            "added_at": now
        })
    
    highlight.pop("_id", None)
    highlight["story_count"] = len(highlight_data.story_ids)
    
    return highlight

@router.put("/{highlight_id}")
async def update_highlight(
    highlight_id: str,
    data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a highlight"""
    existing = await db.highlights.find_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    update = {}
    if data:
        if "name" in data:
            update["name"] = data["name"]
        if "cover_url" in data:
            update["cover_url"] = data["cover_url"]
    
    if update:
        await db.highlights.update_one({"id": highlight_id}, {"$set": update})
    
    return {"message": "Öne çıkarılan güncellendi"}

@router.delete("/{highlight_id}")
async def delete_highlight(highlight_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a highlight"""
    result = await db.highlights.delete_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    await db.highlight_stories.delete_many({"highlight_id": highlight_id})
    
    return {"message": "Öne çıkarılan silindi"}

@router.post("/{highlight_id}/stories")
async def add_story_to_highlight(
    highlight_id: str,
    data: dict = None,
    story_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Add a story to a highlight"""
    if data and isinstance(data, dict):
        story_id = data.get("story_id", story_id)
    if not story_id:
        raise HTTPException(status_code=400, detail="story_id required")

    highlight = await db.highlights.find_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if not highlight:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    existing = await db.highlight_stories.find_one({
        "highlight_id": highlight_id,
        "story_id": story_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Hikaye zaten ekli")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.highlight_stories.insert_one({
        "id": str(uuid.uuid4()),
        "highlight_id": highlight_id,
        "story_id": story_id,
        "added_at": now
    })
    
    return {"message": "Hikaye eklendi"}

@router.get("/{highlight_id}/stories")
async def get_highlight_stories(
    highlight_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all stories in a highlight"""
    highlight_stories = await db.highlight_stories.find(
        {"highlight_id": highlight_id},
        {"_id": 0}
    ).sort("added_at", 1).to_list(100)
    
    story_ids = [hs["story_id"] for hs in highlight_stories]
    
    stories = await db.stories.find(
        {"id": {"$in": story_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return stories

@router.delete("/{highlight_id}/stories/{story_id}")
async def remove_story_from_highlight(
    highlight_id: str,
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a story from a highlight"""
    highlight = await db.highlights.find_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if not highlight:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    result = await db.highlight_stories.delete_one({
        "highlight_id": highlight_id,
        "story_id": story_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hikaye bu öne çıkarılana ait değil")
    
    return {"message": "Hikaye kaldırıldı"}
