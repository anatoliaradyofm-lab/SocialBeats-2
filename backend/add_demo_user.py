import asyncio, uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

MONGO_URL = 'mongodb+srv://testuser:Testuser1234@cluster0.wered92.mongodb.net/?authSource=admin&appName=Cluster0'

DEMO_USERS = [
    {
        "username": "demo_ahmet",
        "display_name": "Ahmet Yilmaz",
        "email": "ahmet@demo.com",
        "avatar_url": "https://i.pravatar.cc/300?img=12",
        "cover_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80",
        "bio": "Muzik benim hayatim | Istanbul | DJ & Produktor",
        "country": "Turkiye",
        "city": "Istanbul",
        "gender": "male",
        "music_genres": ["Electronic", "Hip-Hop", "R&B"],
        "is_verified": True,
        "followers_count": 1240,
        "following_count": 380,
        "posts_count": 87,
    },
    {
        "username": "demo_zeynep",
        "display_name": "Zeynep Kaya",
        "email": "zeynep@demo.com",
        "avatar_url": "https://i.pravatar.cc/300?img=5",
        "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
        "bio": "Pop & Soul lover. Ankara native, music addict.",
        "country": "Turkiye",
        "city": "Ankara",
        "gender": "female",
        "music_genres": ["Pop", "Soul", "Jazz"],
        "is_verified": False,
        "followers_count": 432,
        "following_count": 210,
        "posts_count": 34,
    },
    {
        "username": "demo_carlos",
        "display_name": "Carlos Rivera",
        "email": "carlos@demo.com",
        "avatar_url": "https://i.pravatar.cc/300?img=33",
        "cover_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80",
        "bio": "Latin vibes | Madrid | Guitar player",
        "country": "Spain",
        "city": "Madrid",
        "gender": "male",
        "music_genres": ["Latin", "Flamenco", "Pop"],
        "is_verified": True,
        "followers_count": 3800,
        "following_count": 920,
        "posts_count": 215,
    },
    {
        "username": "demo_sofia",
        "display_name": "Sofia Dubois",
        "email": "sofia@demo.com",
        "avatar_url": "https://i.pravatar.cc/300?img=47",
        "cover_url": "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80",
        "bio": "Electronic music producer from Paris. Peace & bass.",
        "country": "France",
        "city": "Paris",
        "gender": "female",
        "music_genres": ["Electronic", "House", "Techno"],
        "is_verified": True,
        "followers_count": 8200,
        "following_count": 540,
        "posts_count": 312,
    },
    {
        "username": "demo_mehmet",
        "display_name": "Mehmet Demir",
        "email": "mehmet@demo.com",
        "avatar_url": "https://i.pravatar.cc/300?img=68",
        "cover_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
        "bio": "Hip-hop producer | Izmir | Beats & bars",
        "country": "Turkiye",
        "city": "Izmir",
        "gender": "male",
        "music_genres": ["Hip-Hop", "Trap", "R&B"],
        "is_verified": False,
        "followers_count": 760,
        "following_count": 450,
        "posts_count": 62,
    },
]

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client['socialbeats']

    # Remove existing demo users
    for u in DEMO_USERS:
        await db.users.delete_one({"username": u["username"]})

    pwd = bcrypt.hashpw(b"Test1234!", bcrypt.gensalt()).decode()
    now = datetime.now(timezone.utc).isoformat()

    inserted = 0
    for u in DEMO_USERS:
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "password": pwd,
            "subscription_type": "free",
            "created_at": now,
            "is_online": True,
            "level": 5,
            "xp": 1000,
            "badges": ["new_user"],
            "profile_theme": "default",
            "favorite_genres": u.get("music_genres", []),
            **u,
        }
        await db.users.insert_one(doc)
        inserted += 1
        print("Added: " + u["display_name"] + " @" + u["username"] + " (" + u["country"] + ")")

    print("\nTotal: " + str(inserted) + " demo users added.")

asyncio.run(main())
