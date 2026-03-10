# Ads Routes - Reklam analitiği, geçmiş, tercihler, geri bildirim
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/ads", tags=["ads"])

# =====================================================
# MODELS
# =====================================================


class AdEventRequest(BaseModel):
    event: str  # impression, click, feedback
    ad_type: Optional[str] = None
    ad_placement: Optional[str] = None
    ad_unit_id: Optional[str] = None
    feedback: Optional[str] = None  # relevant, irrelevant
    extra: Optional[Dict[str, Any]] = None


class AdFeedbackRequest(BaseModel):
    ad_event_id: Optional[str] = None
    feedback: str  # relevant, irrelevant
    ad_type: Optional[str] = None
    ad_placement: Optional[str] = None


class AdSettingsUpdate(BaseModel):
    interest_targeting: Optional[bool] = None
    ad_notifications: Optional[bool] = None
    interests: Optional[List[str]] = None


# =====================================================
# EVENTS (impression, click, feedback)
# =====================================================


@router.post("/events")
async def track_ad_event(body: AdEventRequest, current_user: dict = Depends(get_current_user)):
    """Reklam olayı kaydet (impression, click, feedback)"""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "event": body.event,
        "ad_type": body.ad_type,
        "ad_placement": body.ad_placement,
        "ad_unit_id": body.ad_unit_id,
        "feedback": body.feedback,
        "extra": body.extra or {},
        "created_at": now,
    }
    await db.ad_events.insert_one(doc)
    return {"message": "ok", "id": doc["id"]}


@router.post("/feedback")
async def submit_ad_feedback(
    body: AdFeedbackRequest, current_user: dict = Depends(get_current_user)
):
    """Reklam geri bildirimi (ilgili/ilgisiz)"""
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "event": "feedback",
        "feedback": body.feedback,
        "ad_event_id": body.ad_event_id,
        "ad_type": body.ad_type,
        "ad_placement": body.ad_placement,
        "created_at": now,
    }
    await db.ad_events.insert_one(doc)
    return {"message": "Geri bildiriminiz kaydedildi"}
# AD HISTORY (geçmiş)
# =====================================================


@router.get("/history")
async def get_ad_history(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """Kullanıcının reklam etkileşim geçmişi"""
    cursor = (
        db.ad_events.find({"user_id": current_user["id"]})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    items = []
    async for doc in cursor:
        doc.pop("_id", None)
        items.append(doc)
    return {"history": items, "has_more": len(items) == limit}


# =====================================================


# =====================================================
# AD SETTINGS (tercihler - kapatma YOK)
# =====================================================


@router.get("/settings")
async def get_ad_settings(current_user: dict = Depends(get_current_user)):
    """Reklam tercihleri"""
    s = await db.user_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0, "ad_interest_targeting": 1, "ad_notifications": 1, "ad_interests": 1},
    )
    return {
        "interest_targeting": s.get("ad_interest_targeting", True) if s else True,
        "ad_notifications": s.get("ad_notifications", False) if s else False,
        "interests": s.get("ad_interests", []) if s else [],
    }


@router.put("/settings")
async def update_ad_settings(
    body: AdSettingsUpdate, current_user: dict = Depends(get_current_user)
):
    """Reklam tercihlerini güncelle (reklamları kapatma seçeneği YOK)"""
    update = {}
    if body.interest_targeting is not None:
        update["ad_interest_targeting"] = body.interest_targeting
    if body.ad_notifications is not None:
        update["ad_notifications"] = body.ad_notifications
    if body.interests is not None:
        update["ad_interests"] = body.interests
    if not update:
        raise HTTPException(status_code=400, detail="Güncellenecek alan yok")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_settings.update_one(
        {"user_id": current_user["id"]}, {"$set": update}, upsert=True
    )
# =====================================================
# ANALYTICS (admin / dashboard)
# =====================================================
    return {"message": "Reklam ayarları güncellendi"}




@router.get("/analytics/summary")
async def get_ad_analytics_summary(
    days: int = 7,
    current_user: dict = Depends(get_current_user),
):
    """Reklam özet (gösterim, tıklama, CTR) - kendi verisi"""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"user_id": current_user["id"], "created_at": {"$gte": since}}},
        {"$group": {"_id": "$event", "count": {"$sum": 1}}},
    ]
    results = await db.ad_events.aggregate(pipeline).to_list(20)
    by_event = {r["_id"]: r["count"] for r in results}
    impressions = by_event.get("impression", 0)
    clicks = by_event.get("click", 0)
    ctr = (clicks / impressions * 100) if impressions else 0
    return {
        "impressions": impressions,
        "clicks": clicks,
        "ctr_percent": round(ctr, 2),
        "feedbacks": by_event.get("feedback", 0),
        "period_days": days,
    }


@router.get("/analytics/categories")
async def get_ad_category_stats(
    days: int = 7,
    current_user: dict = Depends(get_current_user),
):
    """En çok tıklanan reklam kategorileri"""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {
            "$match": {
                "user_id": current_user["id"],
                "event": "click",
                "created_at": {"$gte": since},
            }
        },
        {"$addFields": {"cat": {"$ifNull": ["$extra.category", "unknown"]}}},
        {"$group": {"_id": "$cat", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    results = await db.ad_events.aggregate(pipeline).to_list(10)
    categories = [{"category": r["_id"], "clicks": r["count"]} for r in results]
    return {"categories": categories}
