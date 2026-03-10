"""
TestSprite test kullanıcısı oluşturur.
Kullanım: backend klasöründen: python -m scripts.seed_testsprite_user
Veya: python scripts/seed_testsprite_user.py (backend cwd)
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone

# backend root
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

TEST_EMAIL = "testsprite@test.com"
TEST_USERNAME = "testsprite"
TEST_PASSWORD = "TestSprite123!"
DISPLAY_NAME = "TestSprite User"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "socialbeats")
    if not mongo_url:
        print("MONGO_URL bulunamadı. .env dosyasını kontrol edin.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    existing = await db.users.find_one({"email": TEST_EMAIL})
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        # Şifreyi güncelle (test ortamında aynı şifre kalsın)
        await db.users.update_one(
            {"email": TEST_EMAIL},
            {"$set": {"password": hash_password(TEST_PASSWORD), "updated_at": now}}
        )
        print(f"TestSprite kullanıcısı güncellendi: {TEST_EMAIL}")
    else:
        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "email": TEST_EMAIL,
            "username": TEST_USERNAME,
            "display_name": DISPLAY_NAME,
            "password": hash_password(TEST_PASSWORD),
            "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={TEST_USERNAME}",
            "bio": None,
            "connected_services": [],
            "created_at": now,
            "subscription_type": "free",
            "followers_count": 0,
            "following_count": 0,
            "posts_count": 0,
            "favorite_genres": [],
            "favorite_artists": [],
            "music_mood": None,
            "is_verified": False,
            "level": 1,
            "xp": 0,
            "badges": ["new_user"],
            "profile_theme": "default",
            "is_online": False,
        }
        await db.users.insert_one(user_doc)
        print(f"TestSprite kullanıcısı oluşturuldu: {TEST_EMAIL}")

    print(f"  E-posta: {TEST_EMAIL}")
    print(f"  Şifre:   {TEST_PASSWORD}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
