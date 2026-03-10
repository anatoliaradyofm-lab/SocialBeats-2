"""
Supabase PostgreSQL bağlantı testi
Kullanım: python scripts/test_postgres.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

async def test_connection():
    pg_url = os.getenv("POSTGRES_URL", "")
    
    if not pg_url or "[YOUR-PASSWORD]" in pg_url:
        print("❌ POSTGRES_URL ayarlanmamış veya şifre girilmemiş!")
        print(f"   Mevcut: {pg_url[:50]}...")
        print("   .env dosyasındaki [YOUR-PASSWORD] kısmını gerçek şifrenizle değiştirin.")
        return False
    
    print(f"🔄 PostgreSQL'e bağlanılıyor...")
    print(f"   Host: {pg_url.split('@')[1].split('/')[0] if '@' in pg_url else 'bilinmiyor'}")
    
    try:
        import asyncpg
        pool = await asyncpg.create_pool(pg_url, min_size=1, max_size=2, command_timeout=10)
        
        async with pool.acquire() as conn:
            version = await conn.fetchval("SELECT version()")
            print(f"✅ PostgreSQL bağlantısı başarılı!")
            print(f"   Versiyon: {version[:60]}...")
            
            # Tabloları oluştur
            print("\n🔄 Tabloları oluşturuluyor...")
            from services.postgresql_service import init_tables
            # Pool'u servis modülünde de kullan
            import services.postgresql_service as pg_svc
            pg_svc._pool = pool
            await init_tables()
            print("✅ Tablolar başarıyla oluşturuldu!")
            
            # Tablo sayısını kontrol et
            tables = await conn.fetch(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
            )
            print(f"✅ Toplam {len(tables)} tablo mevcut:")
            for t in tables:
                print(f"   📋 {t['table_name']}")
        
        await pool.close()
        return True
        
    except ImportError:
        print("❌ asyncpg yüklü değil. Yüklemek için: pip install asyncpg")
        return False
    except Exception as e:
        print(f"❌ Bağlantı hatası: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_connection())
    print(f"\n{'='*50}")
    print(f"Sonuç: {'✅ BAŞARILI' if result else '❌ BAŞARISIZ'}")
    sys.exit(0 if result else 1)
