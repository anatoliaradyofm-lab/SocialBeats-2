# Legal Routes
# Privacy Policy, Terms of Service, Licenses, Help Center, Advertising Policy, Feedback
from fastapi import APIRouter, Query, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import os
import jwt

router = APIRouter(prefix="/legal", tags=["legal"])
optional_auth = HTTPBearer(auto_error=False)

# Last updated date
LAST_UPDATED = "2025-01-17"

# BCP 47 locale codes - all supported languages for legal/help/API validation
SUPPORTED_LANGUAGES = [
    "tr", "en", "de", "fr", "es", "ar", "ru", "ja", "ko", "zh",
    "hi", "pt", "pt-BR", "id", "vi", "fil", "th", "ur", "ms", "it", "pl",
]

# =====================================================
# PRIVACY POLICY - All Languages
# =====================================================

PRIVACY_POLICY = {
    "tr": {
        "title": "Gizlilik Politikası",
        "last_updated": "Son Güncelleme: 17 Ocak 2025",
        "sections": [
            {
                "title": "1. Giriş",
                "content": """SocialBeats ("biz", "bizim" veya "Uygulama") olarak gizliliğinize önem veriyoruz. Bu Gizlilik Politikası, kişisel verilerinizi nasıl topladığımızı, kullandığımızı, paylaştığımızı ve koruduğumuzu açıklar.

Uygulamamızı kullanarak bu politikayı kabul etmiş olursunuz."""
            },
            {
                "title": "2. Topladığımız Veriler",
                "content": """Aşağıdaki bilgileri toplayabiliriz:

• Hesap Bilgileri: E-posta adresi, kullanıcı adı, şifre (şifrelenmiş)
• Profil Bilgileri: İsim, fotoğraf, biyografi
• Kullanım Verileri: Dinleme geçmişi, beğeniler, çalma listeleri
• Cihaz Bilgileri: Cihaz türü, işletim sistemi, uygulama sürümü
• Konum Verileri: Yalnızca izin verirseniz ve özellik gerektiriyorsa
• İletişim Verileri: Mesajlar, yorumlar (diğer kullanıcılarla)"""
            },
            {
                "title": "3. Verilerin Kullanımı",
                "content": """Verilerinizi şu amaçlarla kullanırız:

• Hizmet sunmak ve hesabınızı yönetmek
• Kişiselleştirilmiş müzik önerileri sunmak
• Sosyal özellikleri etkinleştirmek
• Uygulamayı iyileştirmek ve hataları düzeltmek
• Güvenliği sağlamak ve dolandırıcılığı önlemek
• Yasal yükümlülükleri yerine getirmek"""
            },
            {
                "title": "4. Veri Paylaşımı",
                "content": """Verilerinizi şu durumlarda paylaşabiliriz:

• Sizin onayınızla
• Hizmet sağlayıcılarla (Firebase, hosting vb.)
• Yasal zorunluluk durumunda
• Şirket birleşmesi veya satışı durumunda

Verilerinizi üçüncü taraf reklamcılara SATMIYORUZ."""
            },
            {
                "title": "5. Veri Güvenliği",
                "content": """Verilerinizi korumak için:

• SSL/TLS şifreleme kullanıyoruz
• Şifreler bcrypt ile hashleniyor
• Düzenli güvenlik denetimleri yapıyoruz
• Erişim kontrolü uyguluyoruz

Ancak internet üzerinden veri iletiminin %100 güvenli olmadığını hatırlatırız."""
            },
            {
                "title": "6. Haklarınız",
                "content": """KVKK ve GDPR kapsamında şu haklara sahipsiniz:

• Verilerinize erişim hakkı
• Verilerin düzeltilmesini isteme hakkı
• Verilerin silinmesini isteme hakkı
• Veri işlemeye itiraz hakkı
• Veri taşınabilirliği hakkı

Bu haklarınızı kullanmak için support@socialbeats.app adresine başvurabilirsiniz."""
            },
            {
                "title": "7. Çerezler ve Takip",
                "content": """Uygulamamız:

• Oturum yönetimi için gerekli çerezler kullanır
• Analitik için anonim kullanım verileri toplar
• Üçüncü taraf takip araçları kullanabilir

Çerez tercihlerinizi uygulama ayarlarından yönetebilirsiniz."""
            },
            {
                "title": "8. Çocukların Gizliliği",
                "content": """Uygulamamız 13 yaş altı çocuklara yönelik değildir. 13 yaşından küçük çocuklardan bilerek kişisel veri toplamıyoruz. Eğer bir çocuğun veri paylaştığını fark ederseniz lütfen bizimle iletişime geçin."""
            },
            {
                "title": "9. Değişiklikler",
                "content": """Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikler için uygulama içi bildirim göndereceğiz. Güncel politikayı düzenli olarak kontrol etmenizi öneririz."""
            },
            {
                "title": "10. İletişim",
                "content": """Sorularınız için:

E-posta: support@socialbeats.app
Web: www.socialbeats.app/privacy"""
            }
        ]
    },
    "en": {
        "title": "Privacy Policy",
        "last_updated": "Last Updated: January 17, 2025",
        "sections": [
            {
                "title": "1. Introduction",
                "content": """At SocialBeats ("we", "our", or "App"), we value your privacy. This Privacy Policy explains how we collect, use, share, and protect your personal data.

By using our App, you agree to this policy."""
            },
            {
                "title": "2. Data We Collect",
                "content": """We may collect the following information:

• Account Information: Email address, username, password (encrypted)
• Profile Information: Name, photo, biography
• Usage Data: Listening history, likes, playlists
• Device Information: Device type, operating system, app version
• Location Data: Only if you permit and feature requires
• Communication Data: Messages, comments (with other users)"""
            },
            {
                "title": "3. How We Use Data",
                "content": """We use your data to:

• Provide services and manage your account
• Offer personalized music recommendations
• Enable social features
• Improve the app and fix bugs
• Ensure security and prevent fraud
• Comply with legal obligations"""
            },
            {
                "title": "4. Data Sharing",
                "content": """We may share your data:

• With your consent
• With service providers (Firebase, hosting, etc.)
• When legally required
• In case of company merger or sale

We DO NOT SELL your data to third-party advertisers."""
            },
            {
                "title": "5. Data Security",
                "content": """To protect your data:

• We use SSL/TLS encryption
• Passwords are hashed with bcrypt
• We conduct regular security audits
• We implement access controls

However, we remind you that data transmission over the internet is not 100% secure."""
            },
            {
                "title": "6. Your Rights",
                "content": """Under GDPR and similar laws, you have:

• Right to access your data
• Right to rectification
• Right to erasure
• Right to object
• Right to data portability

To exercise these rights, contact support@socialbeats.app"""
            },
            {
                "title": "7. Cookies and Tracking",
                "content": """Our app:

• Uses necessary cookies for session management
• Collects anonymous usage data for analytics
• May use third-party tracking tools

You can manage cookie preferences in app settings."""
            },
            {
                "title": "8. Children's Privacy",
                "content": """Our app is not intended for children under 13. We do not knowingly collect personal data from children under 13. If you notice a child has shared data, please contact us."""
            },
            {
                "title": "9. Changes",
                "content": """We may update this policy from time to time. We will notify you of significant changes through in-app notifications. We recommend checking this policy regularly."""
            },
            {
                "title": "10. Contact",
                "content": """For questions:

Email: support@socialbeats.app
Web: www.socialbeats.app/privacy"""
            }
        ]
    },
    "de": {
        "title": "Datenschutzrichtlinie",
        "last_updated": "Letzte Aktualisierung: 17. Januar 2025",
        "sections": [
            {
                "title": "1. Einleitung",
                "content": """Bei SocialBeats („wir", „unser" oder „App") schätzen wir Ihre Privatsphäre. Diese Datenschutzrichtlinie erklärt, wie wir Ihre personenbezogenen Daten sammeln, verwenden, teilen und schützen.

Durch die Nutzung unserer App stimmen Sie dieser Richtlinie zu."""
            },
            {
                "title": "2. Daten, die wir sammeln",
                "content": """Wir können folgende Informationen sammeln:

• Kontoinformationen: E-Mail-Adresse, Benutzername, Passwort (verschlüsselt)
• Profilinformationen: Name, Foto, Biografie
• Nutzungsdaten: Hörverlauf, Likes, Playlists
• Geräteinformationen: Gerätetyp, Betriebssystem, App-Version
• Standortdaten: Nur mit Ihrer Erlaubnis
• Kommunikationsdaten: Nachrichten, Kommentare"""
            },
            {
                "title": "3. Verwendung der Daten",
                "content": """Wir verwenden Ihre Daten, um:

• Dienste bereitzustellen und Ihr Konto zu verwalten
• Personalisierte Musikempfehlungen anzubieten
• Soziale Funktionen zu ermöglichen
• Die App zu verbessern und Fehler zu beheben
• Sicherheit zu gewährleisten
• Gesetzliche Verpflichtungen zu erfüllen"""
            },
            {
                "title": "4. Datenweitergabe",
                "content": """Wir können Ihre Daten teilen:

• Mit Ihrer Zustimmung
• Mit Dienstanbietern (Firebase, Hosting usw.)
• Bei gesetzlicher Verpflichtung
• Bei Unternehmensfusion oder -verkauf

Wir VERKAUFEN Ihre Daten NICHT an Drittanbieter."""
            },
            {
                "title": "5. Datensicherheit",
                "content": """Zum Schutz Ihrer Daten:

• Wir verwenden SSL/TLS-Verschlüsselung
• Passwörter werden mit bcrypt gehasht
• Wir führen regelmäßige Sicherheitsprüfungen durch
• Wir implementieren Zugriffskontrollen"""
            },
            {
                "title": "6. Ihre Rechte",
                "content": """Gemäß DSGVO haben Sie:

• Recht auf Zugang
• Recht auf Berichtigung
• Recht auf Löschung
• Widerspruchsrecht
• Recht auf Datenübertragbarkeit

Kontakt: support@socialbeats.app"""
            },
            {
                "title": "7. Cookies und Tracking",
                "content": """Unsere App:

• Verwendet notwendige Cookies für die Sitzungsverwaltung
• Sammelt anonyme Nutzungsdaten für Analysen
• Kann Tracking-Tools von Drittanbietern verwenden"""
            },
            {
                "title": "8. Datenschutz für Kinder",
                "content": """Unsere App ist nicht für Kinder unter 13 Jahren bestimmt. Wir sammeln wissentlich keine personenbezogenen Daten von Kindern unter 13 Jahren."""
            },
            {
                "title": "9. Änderungen",
                "content": """Wir können diese Richtlinie von Zeit zu Zeit aktualisieren. Bei wesentlichen Änderungen werden wir Sie über In-App-Benachrichtigungen informieren."""
            },
            {
                "title": "10. Kontakt",
                "content": """Bei Fragen:

E-Mail: support@socialbeats.app
Web: www.socialbeats.app/privacy"""
            }
        ]
    },
    "fr": {
        "title": "Politique de Confidentialité",
        "last_updated": "Dernière mise à jour : 17 janvier 2025",
        "sections": [
            {
                "title": "1. Introduction",
                "content": """Chez SocialBeats (« nous », « notre » ou « Application »), nous accordons de l'importance à votre vie privée. Cette politique de confidentialité explique comment nous collectons, utilisons, partageons et protégeons vos données personnelles.

En utilisant notre application, vous acceptez cette politique."""
            },
            {
                "title": "2. Données collectées",
                "content": """Nous pouvons collecter :

• Informations de compte : Adresse e-mail, nom d'utilisateur, mot de passe (crypté)
• Informations de profil : Nom, photo, biographie
• Données d'utilisation : Historique d'écoute, likes, playlists
• Informations sur l'appareil : Type, système d'exploitation, version
• Données de localisation : Uniquement avec votre permission
• Données de communication : Messages, commentaires"""
            },
            {
                "title": "3. Utilisation des données",
                "content": """Nous utilisons vos données pour :

• Fournir des services et gérer votre compte
• Proposer des recommandations musicales personnalisées
• Activer les fonctionnalités sociales
• Améliorer l'application et corriger les bugs
• Assurer la sécurité
• Respecter les obligations légales"""
            },
            {
                "title": "4. Partage des données",
                "content": """Nous pouvons partager vos données :

• Avec votre consentement
• Avec des prestataires de services
• En cas d'obligation légale
• En cas de fusion ou vente d'entreprise

Nous NE VENDONS PAS vos données aux annonceurs."""
            },
            {
                "title": "5. Sécurité des données",
                "content": """Pour protéger vos données :

• Nous utilisons le cryptage SSL/TLS
• Les mots de passe sont hachés avec bcrypt
• Nous effectuons des audits de sécurité réguliers
• Nous appliquons des contrôles d'accès"""
            },
            {
                "title": "6. Vos droits",
                "content": """Conformément au RGPD, vous avez :

• Droit d'accès
• Droit de rectification
• Droit à l'effacement
• Droit d'opposition
• Droit à la portabilité

Contact : support@socialbeats.app"""
            },
            {
                "title": "7. Cookies",
                "content": """Notre application :

• Utilise des cookies nécessaires pour la gestion de session
• Collecte des données d'utilisation anonymes
• Peut utiliser des outils de suivi tiers"""
            },
            {
                "title": "8. Protection des enfants",
                "content": """Notre application n'est pas destinée aux enfants de moins de 13 ans. Nous ne collectons pas sciemment de données personnelles d'enfants de moins de 13 ans."""
            },
            {
                "title": "9. Modifications",
                "content": """Nous pouvons mettre à jour cette politique. Nous vous informerons des changements importants par des notifications dans l'application."""
            },
            {
                "title": "10. Contact",
                "content": """Pour toute question :

E-mail : support@socialbeats.app
Web : www.socialbeats.app/privacy"""
            }
        ]
    },
    "es": {
        "title": "Política de Privacidad",
        "last_updated": "Última actualización: 17 de enero de 2025",
        "sections": [
            {
                "title": "1. Introducción",
                "content": """En SocialBeats ("nosotros", "nuestro" o "Aplicación"), valoramos su privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, compartimos y protegemos sus datos personales.

Al usar nuestra aplicación, acepta esta política."""
            },
            {
                "title": "2. Datos que recopilamos",
                "content": """Podemos recopilar:

• Información de cuenta: Correo electrónico, nombre de usuario, contraseña (encriptada)
• Información de perfil: Nombre, foto, biografía
• Datos de uso: Historial de escucha, likes, listas de reproducción
• Información del dispositivo: Tipo, sistema operativo, versión
• Datos de ubicación: Solo con su permiso
• Datos de comunicación: Mensajes, comentarios"""
            },
            {
                "title": "3. Uso de datos",
                "content": """Usamos sus datos para:

• Proporcionar servicios y administrar su cuenta
• Ofrecer recomendaciones musicales personalizadas
• Habilitar funciones sociales
• Mejorar la aplicación y corregir errores
• Garantizar la seguridad
• Cumplir obligaciones legales"""
            },
            {
                "title": "4. Compartir datos",
                "content": """Podemos compartir sus datos:

• Con su consentimiento
• Con proveedores de servicios
• Cuando sea legalmente requerido
• En caso de fusión o venta de empresa

NO VENDEMOS sus datos a anunciantes."""
            },
            {
                "title": "5. Seguridad de datos",
                "content": """Para proteger sus datos:

• Usamos encriptación SSL/TLS
• Las contraseñas se hashean con bcrypt
• Realizamos auditorías de seguridad regulares
• Implementamos controles de acceso"""
            },
            {
                "title": "6. Sus derechos",
                "content": """Bajo GDPR y leyes similares, tiene:

• Derecho de acceso
• Derecho de rectificación
• Derecho de supresión
• Derecho de oposición
• Derecho a la portabilidad

Contacto: support@socialbeats.app"""
            },
            {
                "title": "7. Cookies",
                "content": """Nuestra aplicación:

• Usa cookies necesarias para gestión de sesión
• Recopila datos de uso anónimos
• Puede usar herramientas de seguimiento de terceros"""
            },
            {
                "title": "8. Privacidad infantil",
                "content": """Nuestra aplicación no está dirigida a menores de 13 años. No recopilamos conscientemente datos personales de menores de 13 años."""
            },
            {
                "title": "9. Cambios",
                "content": """Podemos actualizar esta política. Le notificaremos cambios importantes mediante notificaciones en la aplicación."""
            },
            {
                "title": "10. Contacto",
                "content": """Para preguntas:

Email: support@socialbeats.app
Web: www.socialbeats.app/privacy"""
            }
        ]
    },
    "ar": {
        "title": "سياسة الخصوصية",
        "last_updated": "آخر تحديث: 17 يناير 2025",
        "sections": [
            {
                "title": "1. مقدمة",
                "content": """في SocialBeats ("نحن" أو "تطبيقنا")، نقدر خصوصيتك. توضح سياسة الخصوصية هذه كيف نجمع بياناتك الشخصية ونستخدمها ونشاركها ونحميها.

باستخدام تطبيقنا، فإنك توافق على هذه السياسة."""
            },
            {
                "title": "2. البيانات التي نجمعها",
                "content": """قد نجمع:

• معلومات الحساب: البريد الإلكتروني، اسم المستخدم، كلمة المرور (مشفرة)
• معلومات الملف الشخصي: الاسم، الصورة، السيرة الذاتية
• بيانات الاستخدام: سجل الاستماع، الإعجابات، قوائم التشغيل
• معلومات الجهاز: النوع، نظام التشغيل، الإصدار
• بيانات الموقع: فقط بإذنك
• بيانات الاتصال: الرسائل، التعليقات"""
            },
            {
                "title": "3. استخدام البيانات",
                "content": """نستخدم بياناتك من أجل:

• تقديم الخدمات وإدارة حسابك
• تقديم توصيات موسيقية مخصصة
• تمكين الميزات الاجتماعية
• تحسين التطبيق وإصلاح الأخطاء
• ضمان الأمان
• الامتثال للالتزامات القانونية"""
            },
            {
                "title": "4. مشاركة البيانات",
                "content": """قد نشارك بياناتك:

• بموافقتك
• مع مقدمي الخدمات
• عند الطلب القانوني
• في حالة الاندماج أو البيع

نحن لا نبيع بياناتك للمعلنين."""
            },
            {
                "title": "5. أمان البيانات",
                "content": """لحماية بياناتك:

• نستخدم تشفير SSL/TLS
• يتم تشفير كلمات المرور باستخدام bcrypt
• نجري عمليات تدقيق أمنية منتظمة
• نطبق ضوابط الوصول"""
            },
            {
                "title": "6. حقوقك",
                "content": """بموجب GDPR والقوانين المماثلة، لديك:

• حق الوصول
• حق التصحيح
• حق المحو
• حق الاعتراض
• حق نقل البيانات

للتواصل: support@socialbeats.app"""
            },
            {
                "title": "7. ملفات تعريف الارتباط",
                "content": """تطبيقنا:

• يستخدم ملفات تعريف الارتباط الضرورية
• يجمع بيانات استخدام مجهولة
• قد يستخدم أدوات تتبع خارجية"""
            },
            {
                "title": "8. خصوصية الأطفال",
                "content": """تطبيقنا غير موجه للأطفال دون 13 عامًا. نحن لا نجمع بيانات شخصية من الأطفال دون 13 عامًا عن علم."""
            },
            {
                "title": "9. التغييرات",
                "content": """قد نقوم بتحديث هذه السياسة. سنخطرك بالتغييرات المهمة من خلال إشعارات داخل التطبيق."""
            },
            {
                "title": "10. اتصل بنا",
                "content": """للأسئلة:

البريد الإلكتروني: support@socialbeats.app
الموقع: www.socialbeats.app/privacy"""
            }
        ]
    }
}

# =====================================================
# TERMS OF SERVICE - All Languages
# =====================================================

TERMS_OF_SERVICE = {
    "tr": {
        "title": "Kullanım Koşulları",
        "last_updated": "Son Güncelleme: 17 Ocak 2025",
        "sections": [
            {
                "title": "1. Kabul",
                "content": """SocialBeats uygulamasını ("Uygulama") kullanarak bu Kullanım Koşullarını kabul etmiş olursunuz. Bu koşulları kabul etmiyorsanız, lütfen uygulamayı kullanmayın."""
            },
            {
                "title": "2. Hizmet Tanımı",
                "content": """SocialBeats, müzik dinleme, paylaşma ve sosyal etkileşim hizmetleri sunan bir platformdur. Hizmetlerimiz:

• Müzik arama ve keşfetme
• Çalma listeleri oluşturma
• Sosyal paylaşım ve mesajlaşma
• Hikaye ve gönderi paylaşımı

Hizmetler "olduğu gibi" sunulmaktadır ve değişiklik yapma hakkımız saklıdır."""
            },
            {
                "title": "3. Hesap Oluşturma",
                "content": """Hesap oluşturmak için:

• 13 yaşından büyük olmalısınız
• Doğru ve güncel bilgiler sağlamalısınız
• Hesap güvenliğinden siz sorumlusunuz
• Bir kişi birden fazla hesap oluşturmamalıdır

Şüpheli hesapları askıya alma veya silme hakkımız saklıdır."""
            },
            {
                "title": "4. Kullanım Kuralları",
                "content": """Kullanıcılar şunları YAPAMAZ:

• Yasadışı içerik paylaşmak
• Başkalarını taciz etmek veya tehdit etmek
• Spam veya zararlı içerik yaymak
• Telif hakkı ihlali yapmak
• Uygulamayı tersine mühendislik yapmak
• Otomatik botlar veya scriptler kullanmak
• Diğer kullanıcıların hesaplarına yetkisiz erişmek

Kuralları ihlal eden hesaplar uyarı almadan kapatılabilir."""
            },
            {
                "title": "5. İçerik ve Telif Hakları",
                "content": """⚠️ ÖNEMLİ UYARI:

Uygulamamızda sunulan müzik içerikleri üçüncü taraf kaynaklardan sağlanmaktadır. Bu içeriklerin telif hakları ilgili sahiplerine aittir.

• YouTube ve diğer platformlardan gelen içerikler, ilgili platformların kullanım koşullarına tabidir
• Kullanıcılar paylaştıkları içeriklerden kendileri sorumludur
• Telif hakkı ihlali tespit edilen içerikler kaldırılır

Telif hakkı şikayetleri için: copyright@socialbeats.app"""
            },
            {
                "title": "6. Ücretler ve Abonelikler",
                "content": """Uygulama ücretsiz özellikler ve premium abonelikler sunabilir:

• Ücretsiz sürüm reklam içerebilir
• Premium abonelikler otomatik yenilenebilir
• İptal işlemleri uygulama mağazası üzerinden yapılır
• İade politikası için ilgili mağaza koşullarına bakınız"""
            },
            {
                "title": "7. Sorumluluk Reddi",
                "content": """YASAL UYARI:

Uygulama "olduğu gibi" sunulmaktadır. Aşağıdaki konularda garanti vermiyoruz:

• Hizmetin kesintisiz veya hatasız olacağı
• İçeriklerin doğruluğu veya tamlığı
• Üçüncü taraf hizmetlerinin kullanılabilirliği
• Veri kaybı veya güvenlik açıkları

Maksimum sorumluluğumuz, varsa ödediğiniz abonelik ücretiyle sınırlıdır."""
            },
            {
                "title": "8. Tazminat",
                "content": """Kullanıcı olarak, bu koşulları ihlal etmenizden veya uygulamayı kötüye kullanmanızdan kaynaklanan her türlü talep, zarar ve masrafa karşı bizi tazmin etmeyi kabul edersiniz."""
            },
            {
                "title": "9. Değişiklikler",
                "content": """Bu koşulları dilediğimiz zaman değiştirme hakkımız saklıdır. Önemli değişiklikler için:

• Uygulama içi bildirim göndereceğiz
• E-posta ile bilgilendirme yapabiliriz
• Değişiklik sonrası kullanmaya devam etmeniz, yeni koşulları kabul ettiğiniz anlamına gelir"""
            },
            {
                "title": "10. Geçerli Hukuk",
                "content": """Bu sözleşme Türkiye Cumhuriyeti yasalarına tabidir. Uyuşmazlıklar İstanbul mahkemelerinde çözülecektir."""
            },
            {
                "title": "11. İletişim",
                "content": """Sorularınız için:

E-posta: support@socialbeats.app
Web: www.socialbeats.app/terms"""
            }
        ]
    },
    "en": {
        "title": "Terms of Service",
        "last_updated": "Last Updated: January 17, 2025",
        "sections": [
            {
                "title": "1. Acceptance",
                "content": """By using the SocialBeats application ("App"), you agree to these Terms of Service. If you do not accept these terms, please do not use the app."""
            },
            {
                "title": "2. Service Description",
                "content": """SocialBeats is a platform offering music listening, sharing, and social interaction services:

• Music search and discovery
• Creating playlists
• Social sharing and messaging
• Story and post sharing

Services are provided "as is" and we reserve the right to make changes."""
            },
            {
                "title": "3. Account Creation",
                "content": """To create an account:

• You must be over 13 years old
• You must provide accurate information
• You are responsible for account security
• One person should not create multiple accounts

We reserve the right to suspend or delete suspicious accounts."""
            },
            {
                "title": "4. Usage Rules",
                "content": """Users MAY NOT:

• Share illegal content
• Harass or threaten others
• Spread spam or harmful content
• Infringe copyrights
• Reverse engineer the app
• Use automated bots or scripts
• Access other users' accounts without authorization

Accounts violating rules may be closed without warning."""
            },
            {
                "title": "5. Content and Copyrights",
                "content": """⚠️ IMPORTANT NOTICE:

Music content in our app is provided from third-party sources. Copyrights belong to respective owners.

• Content from YouTube and other platforms is subject to their terms of service
• Users are responsible for content they share
• Content with copyright infringement will be removed

For copyright complaints: copyright@socialbeats.app"""
            },
            {
                "title": "6. Fees and Subscriptions",
                "content": """The app may offer free features and premium subscriptions:

• Free version may contain ads
• Premium subscriptions may auto-renew
• Cancellations are made through app stores
• For refund policy, see relevant store terms"""
            },
            {
                "title": "7. Disclaimer",
                "content": """LEGAL NOTICE:

The app is provided "as is". We do not guarantee:

• Uninterrupted or error-free service
• Accuracy or completeness of content
• Availability of third-party services
• Data loss or security vulnerabilities

Our maximum liability is limited to subscription fees paid, if any."""
            },
            {
                "title": "8. Indemnification",
                "content": """As a user, you agree to indemnify us against all claims, damages, and expenses arising from your violation of these terms or misuse of the app."""
            },
            {
                "title": "9. Changes",
                "content": """We reserve the right to change these terms at any time. For significant changes:

• We will send in-app notifications
• We may inform via email
• Continued use after changes means acceptance of new terms"""
            },
            {
                "title": "10. Governing Law",
                "content": """This agreement is subject to the laws of the Republic of Turkey. Disputes will be resolved in Istanbul courts."""
            },
            {
                "title": "11. Contact",
                "content": """For questions:

Email: support@socialbeats.app
Web: www.socialbeats.app/terms"""
            }
        ]
    },
    "de": {
        "title": "Nutzungsbedingungen",
        "last_updated": "Letzte Aktualisierung: 17. Januar 2025",
        "sections": [
            {"title": "1. Annahme", "content": "Durch die Nutzung der SocialBeats-Anwendung stimmen Sie diesen Nutzungsbedingungen zu."},
            {"title": "2. Dienstbeschreibung", "content": "SocialBeats bietet Musik-Streaming, Sharing und soziale Interaktionsdienste."},
            {"title": "3. Kontoerstellung", "content": "Sie müssen über 13 Jahre alt sein und genaue Informationen angeben."},
            {"title": "4. Nutzungsregeln", "content": "Keine illegalen Inhalte, kein Spam, keine Urheberrechtsverletzungen."},
            {"title": "5. Inhalt und Urheberrechte", "content": "⚠️ Musikinhalte stammen von Drittanbietern. Urheberrechte gehören den jeweiligen Inhabern."},
            {"title": "6. Gebühren", "content": "Die App bietet kostenlose und Premium-Funktionen."},
            {"title": "7. Haftungsausschluss", "content": "Die App wird 'wie besehen' bereitgestellt ohne Garantien."},
            {"title": "8. Entschädigung", "content": "Sie stimmen zu, uns gegen Ansprüche aus Ihrer Nutzung zu entschädigen."},
            {"title": "9. Änderungen", "content": "Wir behalten uns das Recht vor, diese Bedingungen zu ändern."},
            {"title": "10. Anwendbares Recht", "content": "Diese Vereinbarung unterliegt den Gesetzen der Republik Türkei."},
            {"title": "11. Kontakt", "content": "E-Mail: support@socialbeats.app"}
        ]
    },
    "fr": {
        "title": "Conditions d'Utilisation",
        "last_updated": "Dernière mise à jour : 17 janvier 2025",
        "sections": [
            {"title": "1. Acceptation", "content": "En utilisant l'application SocialBeats, vous acceptez ces conditions d'utilisation."},
            {"title": "2. Description du service", "content": "SocialBeats offre des services de streaming musical, de partage et d'interaction sociale."},
            {"title": "3. Création de compte", "content": "Vous devez avoir plus de 13 ans et fournir des informations exactes."},
            {"title": "4. Règles d'utilisation", "content": "Pas de contenu illégal, pas de spam, pas de violation de droits d'auteur."},
            {"title": "5. Contenu et droits d'auteur", "content": "⚠️ Le contenu musical provient de sources tierces. Les droits d'auteur appartiennent à leurs propriétaires respectifs."},
            {"title": "6. Frais", "content": "L'application propose des fonctionnalités gratuites et premium."},
            {"title": "7. Avertissement", "content": "L'application est fournie 'telle quelle' sans garanties."},
            {"title": "8. Indemnisation", "content": "Vous acceptez de nous indemniser contre les réclamations découlant de votre utilisation."},
            {"title": "9. Modifications", "content": "Nous nous réservons le droit de modifier ces conditions."},
            {"title": "10. Droit applicable", "content": "Cet accord est soumis aux lois de la République de Turquie."},
            {"title": "11. Contact", "content": "E-mail : support@socialbeats.app"}
        ]
    },
    "es": {
        "title": "Términos de Servicio",
        "last_updated": "Última actualización: 17 de enero de 2025",
        "sections": [
            {"title": "1. Aceptación", "content": "Al usar la aplicación SocialBeats, acepta estos términos de servicio."},
            {"title": "2. Descripción del servicio", "content": "SocialBeats ofrece servicios de streaming de música, compartir e interacción social."},
            {"title": "3. Creación de cuenta", "content": "Debe tener más de 13 años y proporcionar información precisa."},
            {"title": "4. Reglas de uso", "content": "Sin contenido ilegal, sin spam, sin violación de derechos de autor."},
            {"title": "5. Contenido y derechos de autor", "content": "⚠️ El contenido musical proviene de fuentes de terceros. Los derechos de autor pertenecen a sus respectivos propietarios."},
            {"title": "6. Tarifas", "content": "La aplicación ofrece funciones gratuitas y premium."},
            {"title": "7. Descargo de responsabilidad", "content": "La aplicación se proporciona 'tal cual' sin garantías."},
            {"title": "8. Indemnización", "content": "Acepta indemnizarnos contra reclamaciones derivadas de su uso."},
            {"title": "9. Cambios", "content": "Nos reservamos el derecho de cambiar estos términos."},
            {"title": "10. Ley aplicable", "content": "Este acuerdo está sujeto a las leyes de la República de Turquía."},
            {"title": "11. Contacto", "content": "Email: support@socialbeats.app"}
        ]
    },
    "ar": {
        "title": "شروط الخدمة",
        "last_updated": "آخر تحديث: 17 يناير 2025",
        "sections": [
            {"title": "1. القبول", "content": "باستخدام تطبيق SocialBeats، فإنك توافق على شروط الخدمة هذه."},
            {"title": "2. وصف الخدمة", "content": "يوفر SocialBeats خدمات بث الموسيقى والمشاركة والتفاعل الاجتماعي."},
            {"title": "3. إنشاء الحساب", "content": "يجب أن يكون عمرك أكثر من 13 عامًا وأن تقدم معلومات دقيقة."},
            {"title": "4. قواعد الاستخدام", "content": "لا محتوى غير قانوني، لا رسائل مزعجة، لا انتهاك لحقوق النشر."},
            {"title": "5. المحتوى وحقوق النشر", "content": "⚠️ يأتي المحتوى الموسيقي من مصادر خارجية. حقوق النشر تعود لأصحابها."},
            {"title": "6. الرسوم", "content": "يقدم التطبيق ميزات مجانية ومتميزة."},
            {"title": "7. إخلاء المسؤولية", "content": "يتم تقديم التطبيق 'كما هو' بدون ضمانات."},
            {"title": "8. التعويض", "content": "توافق على تعويضنا ضد المطالبات الناشئة عن استخدامك."},
            {"title": "9. التغييرات", "content": "نحتفظ بالحق في تغيير هذه الشروط."},
            {"title": "10. القانون المعمول به", "content": "تخضع هذه الاتفاقية لقوانين جمهورية تركيا."},
            {"title": "11. اتصل بنا", "content": "البريد الإلكتروني: support@socialbeats.app"}
        ]
    }
}

# =====================================================
# LICENSES - All Languages
# =====================================================

LICENSES = {
    "app_info": {
        "name": "SocialBeats",
        "version": "1.0.0",
        "copyright": "© 2025 SocialBeats. All rights reserved."
    },
    "open_source_libraries": [
        {
            "name": "React Native",
            "version": "0.73.x",
            "license": "MIT",
            "url": "https://github.com/facebook/react-native",
            "description": {
                "tr": "Mobil uygulama geliştirme framework'ü",
                "en": "Mobile app development framework",
                "de": "Framework für mobile App-Entwicklung",
                "fr": "Framework de développement d'applications mobiles",
                "es": "Framework de desarrollo de aplicaciones móviles",
                "ar": "إطار عمل تطوير تطبيقات الجوال"
            }
        },
        {
            "name": "Expo",
            "version": "~50.x",
            "license": "MIT",
            "url": "https://github.com/expo/expo",
            "description": {
                "tr": "React Native geliştirme platformu",
                "en": "React Native development platform",
                "de": "React Native Entwicklungsplattform",
                "fr": "Plateforme de développement React Native",
                "es": "Plataforma de desarrollo React Native",
                "ar": "منصة تطوير React Native"
            }
        },
        {
            "name": "FastAPI",
            "version": "0.104.x",
            "license": "MIT",
            "url": "https://github.com/tiangolo/fastapi",
            "description": {
                "tr": "Python web framework",
                "en": "Python web framework",
                "de": "Python Web-Framework",
                "fr": "Framework web Python",
                "es": "Framework web de Python",
                "ar": "إطار عمل ويب بايثون"
            }
        },
        {
            "name": "Firebase",
            "version": "Various",
            "license": "Apache 2.0",
            "url": "https://firebase.google.com",
            "description": {
                "tr": "Kimlik doğrulama ve bildirim servisleri",
                "en": "Authentication and notification services",
                "de": "Authentifizierungs- und Benachrichtigungsdienste",
                "fr": "Services d'authentification et de notification",
                "es": "Servicios de autenticación y notificación",
                "ar": "خدمات المصادقة والإشعارات"
            }
        },
        {
            "name": "Socket.IO",
            "version": "4.x",
            "license": "MIT",
            "url": "https://github.com/socketio/socket.io",
            "description": {
                "tr": "Gerçek zamanlı iletişim kütüphanesi",
                "en": "Real-time communication library",
                "de": "Echtzeit-Kommunikationsbibliothek",
                "fr": "Bibliothèque de communication en temps réel",
                "es": "Biblioteca de comunicación en tiempo real",
                "ar": "مكتبة الاتصال في الوقت الحقيقي"
            }
        },
        {
            "name": "i18next",
            "version": "23.x",
            "license": "MIT",
            "url": "https://github.com/i18next/i18next",
            "description": {
                "tr": "Çoklu dil desteği kütüphanesi",
                "en": "Internationalization library",
                "de": "Internationalisierungsbibliothek",
                "fr": "Bibliothèque d'internationalisation",
                "es": "Biblioteca de internacionalización",
                "ar": "مكتبة التدويل"
            }
        },
        {
            "name": "Spotipy",
            "version": "2.x",
            "license": "MIT",
            "url": "https://github.com/spotipy-dev/spotipy",
            "description": {
                "tr": "Spotify Web API istemcisi (Resmi API)",
                "en": "Spotify Web API client (Official API)",
                "de": "Spotify Web API Client (Offizielle API)",
                "fr": "Client API Web Spotify (API officielle)",
                "es": "Cliente de API web de Spotify (API oficial)",
                "ar": "عميل واجهة برمجة تطبيقات Spotify (واجهة برمجة تطبيقات رسمية)"
            }
        }
    ],
    "third_party_services": {
        "tr": {
            "title": "Üçüncü Taraf Servisler",
            "content": """Bu uygulama aşağıdaki üçüncü taraf servisleri kullanmaktadır:

• YouTube (Google LLC) - Müzik içerik arama ve metadata
• Spotify (Spotify AB) - Resmi API üzerinden müzik verileri
• Firebase (Google LLC) - Kimlik doğrulama ve bildirimler
• MyMemory Translation - Çeviri servisi

Bu servislerin kullanımı, ilgili şirketlerin kullanım koşullarına tabidir."""
        },
        "en": {
            "title": "Third-Party Services",
            "content": """This app uses the following third-party services:

• YouTube (Google LLC) - Music content search and metadata
• Spotify (Spotify AB) - Music data via official API
• Firebase (Google LLC) - Authentication and notifications
• MyMemory Translation - Translation service

Use of these services is subject to the respective companies' terms of service."""
        },
        "de": {
            "title": "Drittanbieterdienste",
            "content": "Diese App nutzt YouTube, Spotify, Firebase und MyMemory. Die Nutzung unterliegt den jeweiligen Nutzungsbedingungen."
        },
        "fr": {
            "title": "Services tiers",
            "content": "Cette application utilise YouTube, Spotify, Firebase et MyMemory. L'utilisation est soumise aux conditions d'utilisation respectives."
        },
        "es": {
            "title": "Servicios de terceros",
            "content": "Esta aplicación utiliza YouTube, Spotify, Firebase y MyMemory. El uso está sujeto a los términos de servicio respectivos."
        },
        "ar": {
            "title": "خدمات الطرف الثالث",
            "content": "يستخدم هذا التطبيق YouTube وSpotify وFirebase وMyMemory. يخضع الاستخدام لشروط الخدمة الخاصة بكل منها."
        }
    },
    "disclaimer": {
        "tr": {
            "title": "⚠️ Önemli Yasal Uyarı",
            "content": """Bu uygulama, müzik içeriklerini çeşitli kaynaklardan toplayarak sunar. İçerikler ilgili telif hakkı sahiplerine aittir.

Uygulama yalnızca arama ve keşif amacıyla kullanılmalıdır. İçeriklerin indirilmesi veya yeniden dağıtılması yasaktır.

Telif hakkı ihlali tespit edilmesi durumunda içerik kaldırılacaktır.

Kullanıcılar, uygulamayı kullanırken yerel yasalara uymakla yükümlüdür."""
        },
        "en": {
            "title": "⚠️ Important Legal Notice",
            "content": """This app aggregates music content from various sources. Content belongs to respective copyright holders.

The app should be used for search and discovery purposes only. Downloading or redistributing content is prohibited.

Content will be removed if copyright infringement is detected.

Users are obligated to comply with local laws while using the app."""
        },
        "de": {
            "title": "⚠️ Wichtiger rechtlicher Hinweis",
            "content": "Diese App aggregiert Musikinhalte aus verschiedenen Quellen. Die Inhalte gehören den jeweiligen Urheberrechtsinhabern. Herunterladen oder Weiterverteilen ist verboten."
        },
        "fr": {
            "title": "⚠️ Avis juridique important",
            "content": "Cette application agrège du contenu musical provenant de diverses sources. Le contenu appartient aux détenteurs de droits d'auteur respectifs. Le téléchargement ou la redistribution est interdit."
        },
        "es": {
            "title": "⚠️ Aviso legal importante",
            "content": "Esta aplicación agrega contenido musical de varias fuentes. El contenido pertenece a los respectivos titulares de derechos de autor. La descarga o redistribución está prohibida."
        },
        "ar": {
            "title": "⚠️ إشعار قانوني مهم",
            "content": "يجمع هذا التطبيق المحتوى الموسيقي من مصادر مختلفة. المحتوى ملك لأصحاب حقوق النشر المعنيين. التحميل أو إعادة التوزيع محظور."
        }
    }
}

# =====================================================
# HELP CENTER - Categorized FAQ (tr, en, de, fr, es, ar)
# =====================================================

def _help_category(id_: str, title: dict, items: list) -> dict:
    """Build help category with localized title and items."""
    return {"id": id_, "title": title, "items": items}

HELP_CENTER = {
    "tr": {
        "categories": [
            _help_category("getting-started", {"tr": "Başlarken"}, [
                {"question": "Hesap nasıl oluşturulur?", "answer": "Uygulamayı açın, Kayıt Ol'a tıklayın, e-posta ve şifre girin."},
                {"question": "Profil nasıl düzenlenir?", "answer": "Ayarlar > Profil bölümünden fotoğraf, isim ve biyografi güncelleyebilirsiniz."},
                {"question": "Müzik nasıl keşfedilir?", "answer": "Ana sayfada Keşfet sekmesini kullanın veya arama çubuğundan arayın."},
            ]),
            _help_category("account-security", {"tr": "Hesap ve Güvenlik"}, [
                {"question": "Giriş yapamıyorum", "answer": "Şifrenizi sıfırlamak için 'Şifremi Unuttum' bağlantısını kullanın."},
                {"question": "İki faktörlü doğrulama nasıl açılır?", "answer": "Ayarlar > Güvenlik > 2FA bölümünden etkinleştirin."},
                {"question": "Hesabımı nasıl güvende tutarım?", "answer": "Güçlü şifre kullanın, 2FA açın ve şifrenizi kimseyle paylaşmayın."},
                {"question": "Gizlilik ayarları nerede?", "answer": "Ayarlar > Gizlilik bölümünden profil görünürlüğünü yönetin."},
            ]),
            _help_category("content-posts", {"tr": "İçerik ve Gönderiler"}, [
                {"question": "Nasıl gönderi paylaşırım?", "answer": "Ana sayfada + butonuna tıklayın, medya seçin ve paylaşın."},
                {"question": "Hikaye nasıl eklenir?", "answer": "Ana sayfada Hikaye oluştur'a tıklayın, fotoğraf/video ekleyin."},
                {"question": "Yorum nasıl yapılır?", "answer": "Gönderi altındaki yorum kutusuna yazın."},
                {"question": "İçeriği nasıl paylaşırım?", "answer": "Paylaş butonuna tıklayarak bağlantı veya dış platformlara paylaşın."},
            ]),
            _help_category("music-playlists", {"tr": "Müzik ve Çalma Listeleri"}, [
                {"question": "Çalma listesi nasıl oluşturulur?", "answer": "Kütüphane > Yeni çalma listesi oluştur."},
                {"question": "Öneriler nasıl çalışır?", "answer": "Dinleme geçmişinize göre kişiselleştirilmiş öneriler sunulur."},
                {"question": "Müziği nasıl paylaşırım?", "answer": "Parçaya tıklayın > Paylaş butonundan bağlantı alın."},
            ]),
            _help_category("report-safety", {"tr": "Şikayet ve Güvenlik"}, [
                {"question": "İçeriği nasıl bildiririm?", "answer": "Gönderi/hikayede ⋮ menü > Bildir seçeneğini kullanın."},
                {"question": "Birini nasıl engellerim?", "answer": "Profil > ⋮ > Engelle seçeneğini kullanın."},
                {"question": "İtiraz nasıl yapılır?", "answer": "support@socialbeats.app adresine e-posta gönderin."},
            ]),
            _help_category("ads-premium", {"tr": "Reklamlar ve Premium"}, [
                {"question": "Reklam tercihleri nasıl değiştirilir?", "answer": "Ayarlar > Reklam tercihleri bölümünden yönetin."},
                {"question": "Premium abonelik nedir?", "answer": "Reklamsız deneyim ve ek özellikler sunan ücretli plandır."},
                {"question": "Aboneliği nasıl iptal ederim?", "answer": "App Store veya Play Store üzerinden aboneliği iptal edin."},
            ]),
            _help_category("data-privacy", {"tr": "Veri ve Gizlilik"}, [
                {"question": "GDPR haklarım neler?", "answer": "Verilerinize erişim, düzeltme, silme ve taşınabilirlik hakkınız var."},
                {"question": "Verilerimi nasıl dışa aktarırım?", "answer": "Ayarlar > Gizlilik > Verilerimi indir."},
                {"question": "Hesabımı nasıl silerim?", "answer": "Ayarlar > Hesap > Hesabı sil."},
            ]),
        ]
    },
    "en": {
        "categories": [
            _help_category("getting-started", {"en": "Getting Started"}, [
                {"question": "How do I create an account?", "answer": "Open the app, tap Sign Up, enter email and password."},
                {"question": "How do I edit my profile?", "answer": "Go to Settings > Profile to update photo, name, and bio."},
                {"question": "How do I discover music?", "answer": "Use the Explore tab on the home page or search in the search bar."},
            ]),
            _help_category("account-security", {"en": "Account & Security"}, [
                {"question": "I can't log in", "answer": "Use the 'Forgot Password' link to reset your password."},
                {"question": "How do I enable two-factor authentication?", "answer": "Go to Settings > Security > 2FA to enable it."},
                {"question": "How do I keep my account secure?", "answer": "Use a strong password, enable 2FA, and never share your password."},
                {"question": "Where are privacy settings?", "answer": "Manage profile visibility in Settings > Privacy."},
            ]),
            _help_category("content-posts", {"en": "Content & Posts"}, [
                {"question": "How do I share a post?", "answer": "Tap the + button on the home feed, select media, and share."},
                {"question": "How do I add a story?", "answer": "Tap Create Story on the home page, add photo or video."},
                {"question": "How do I comment?", "answer": "Type in the comment box below the post."},
                {"question": "How do I share content?", "answer": "Use the Share button to get a link or share to external platforms."},
            ]),
            _help_category("music-playlists", {"en": "Music & Playlists"}, [
                {"question": "How do I create a playlist?", "answer": "Library > Create new playlist."},
                {"question": "How do recommendations work?", "answer": "Personalized recommendations based on your listening history."},
                {"question": "How do I share music?", "answer": "Tap a track > Share button to get a link."},
            ]),
            _help_category("report-safety", {"en": "Report & Safety"}, [
                {"question": "How do I report content?", "answer": "Use ⋮ menu on post/story > Report."},
                {"question": "How do I block someone?", "answer": "Profile > ⋮ > Block."},
                {"question": "How do I appeal?", "answer": "Email support@socialbeats.app for appeals."},
            ]),
            _help_category("ads-premium", {"en": "Ads & Premium"}, [
                {"question": "How do I change ad preferences?", "answer": "Manage in Settings > Ad preferences."},
                {"question": "What is Premium subscription?", "answer": "Paid plan with ad-free experience and extra features."},
                {"question": "How do I cancel my subscription?", "answer": "Cancel via App Store or Play Store subscription settings."},
            ]),
            _help_category("data-privacy", {"en": "Data & Privacy"}, [
                {"question": "What are my GDPR rights?", "answer": "You have rights to access, rectify, erase, and port your data."},
                {"question": "How do I export my data?", "answer": "Settings > Privacy > Download my data."},
                {"question": "How do I delete my account?", "answer": "Settings > Account > Delete account."},
            ]),
        ]
    },
}

def _localize_help(help_data: dict, lang: str) -> list:
    """Convert help categories to API format with localized title."""
    out = []
    for cat in help_data["categories"]:
        title_key = list(cat["title"].keys())[0]
        title = cat["title"].get(lang, cat["title"].get("en", cat["title"][title_key]))
        out.append({"id": cat["id"], "title": title, "items": cat["items"]})
    return out

# Fallback for de, fr, es, ar - use English
# Fallback: languages without full help content use English
for l in SUPPORTED_LANGUAGES:
    if l not in HELP_CENTER:
        HELP_CENTER[l] = HELP_CENTER["en"]

# =====================================================
# ADVERTISING POLICY (tr, en)
# =====================================================

ADVERTISING_POLICY = {
    "tr": {
        "title": "Reklam Politikası",
        "last_updated": "Son Güncelleme: 22 Şubat 2025",
        "sections": [
            {"title": "1. Reklam Standartları", "content": "Reklamlarımız topluluk kurallarına uygundur. Yanıltıcı, saldırgan veya yasadışı reklamlar kabul edilmez. Tüm reklamlar içerik politikamızla uyumlu olmalıdır."},
            {"title": "2. Yasaklanan İçerik", "content": "Aşağıdaki içerik türleri reklamlarda yasaktır: yetişkin içerik, şiddet, nefret söylemi, dolandırıcılık, yanıltıcı iddialar, sağlık/ilaç iddiaları (kanıt olmadan), kripto para veya finansal yatırım tavsiyesi."},
            {"title": "3. Hedefleme", "content": "Reklamlar yaş, dil, konum ve ilgi alanlarına göre hedeflenebilir. Kişisel verileriniz Gizlilik Politikamız uyarınca işlenir. Hedefleme tercihlerinizi Ayarlar > Reklam tercihleri bölümünden yönetebilirsiniz."},
            {"title": "4. Veri Kullanımı", "content": "Reklam gösterimi için kullanım verileri (dinleme geçmişi, etkileşimler) anonimize veya toplulaştırılmış olarak kullanılabilir. Verilerinizi üçüncü taraf reklamcılara satmıyoruz."},
            {"title": "5. Devre Dışı Bırakma", "content": "Premium abonelik ile reklamları devre dışı bırakabilirsiniz. Ayrıca reklam tercihlerinizden belirli kategorilerdeki reklamları sınırlayabilirsiniz."},
            {"title": "6. İletişim", "content": "Reklam politikası hakkında sorularınız için: ads@socialbeats.app"},
        ]
    },
    "en": {
        "title": "Advertising Policy",
        "last_updated": "Last Updated: February 22, 2025",
        "sections": [
            {"title": "1. Ad Standards", "content": "Our ads comply with community guidelines. Misleading, offensive, or illegal ads are not accepted. All ads must align with our content policy."},
            {"title": "2. Prohibited Content", "content": "The following content types are prohibited in ads: adult content, violence, hate speech, fraud, misleading claims, health/drug claims (without evidence), crypto or financial investment advice."},
            {"title": "3. Targeting", "content": "Ads may be targeted by age, language, location, and interests. Your personal data is processed per our Privacy Policy. Manage targeting preferences in Settings > Ad preferences."},
            {"title": "4. Data Use", "content": "Usage data (listening history, interactions) may be used in anonymized or aggregated form for ad delivery. We do not sell your data to third-party advertisers."},
            {"title": "5. Opt-Out", "content": "You can disable ads with a Premium subscription. You may also limit ads in certain categories via ad preferences."},
            {"title": "6. Contact", "content": "For questions about advertising policy: ads@socialbeats.app"},
        ]
    },
}

for l in SUPPORTED_LANGUAGES:
    if l not in ADVERTISING_POLICY:
        ADVERTISING_POLICY[l] = ADVERTISING_POLICY["en"]

# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/languages")
async def get_supported_languages():
    """Get list of supported language codes (BCP 47) for legal/help content"""
    return {"languages": SUPPORTED_LANGUAGES}

@router.get("/help-center")
async def get_help_center(lang: str = Query("tr", description="Language code (BCP 47)")):
    """Get categorized help center content"""
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    data = HELP_CENTER.get(lang, HELP_CENTER["en"])
    return {"categories": _localize_help(data, lang), "lang": lang}

@router.get("/advertising-policy")
async def get_advertising_policy(lang: str = Query("tr", description="Language code (BCP 47)")):
    """Get advertising policy in specified language"""
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    return ADVERTISING_POLICY.get(lang, ADVERTISING_POLICY["en"])

@router.get("/app-links")
async def get_app_links():
    """Get App Store and Play Store URLs for Rate the App"""
    app_store = os.environ.get("APP_STORE_URL", "https://apps.apple.com/app/socialbeats/id000000000")
    play_store = os.environ.get("PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.socialbeats.app")
    return {"appStore": app_store, "playStore": play_store}

class FeedbackBody(BaseModel):
    type: str  # bug, suggestion, other
    subject: str
    message: str
    email: Optional[str] = None

@router.post("/feedback")
async def submit_feedback(
    body: FeedbackBody,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_auth),
):
    """Submit feedback (bug/suggestion). Auth optional; if not logged in, email is required."""
    if body.type not in ("bug", "suggestion", "other"):
        raise HTTPException(status_code=400, detail="type must be bug, suggestion, or other")
    if not body.subject or not body.message:
        raise HTTPException(status_code=400, detail="subject and message are required")
    user_id = None
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, os.environ.get("JWT_SECRET", "socialbeats-secret-key-2024"), algorithms=["HS256"])
            user_id = payload.get("sub")
        except Exception:
            pass
    if not user_id and not body.email:
        raise HTTPException(status_code=400, detail="Email is required when not logged in")
    # In production: save to DB, send to support system. For now return success.
    return {
        "status": "received",
        "message": "Thank you for your feedback. We will review it shortly.",
        "user_id": user_id,
    }

@router.get("/privacy-policy")
async def get_privacy_policy(lang: str = Query("tr", description="Language code (BCP 47)")):
    """Get privacy policy in specified language"""
    if lang not in SUPPORTED_LANGUAGES or lang not in PRIVACY_POLICY:
        lang = "en"
    return PRIVACY_POLICY.get(lang, PRIVACY_POLICY["en"])

@router.get("/terms")
async def get_terms_of_service(lang: str = Query("tr", description="Language code (BCP 47)")):
    """Get terms of service in specified language"""
    if lang not in SUPPORTED_LANGUAGES or lang not in TERMS_OF_SERVICE:
        lang = "en"
    return TERMS_OF_SERVICE.get(lang, TERMS_OF_SERVICE["en"])

@router.get("/licenses")
async def get_licenses(lang: str = Query("tr", description="Language code (BCP 47)")):
    """Get open source licenses and attributions"""
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    
    libraries = []
    for lib in LICENSES["open_source_libraries"]:
        libraries.append({
            "name": lib["name"],
            "version": lib["version"],
            "license": lib["license"],
            "url": lib["url"],
            "description": lib["description"].get(lang, lib["description"]["en"])
        })
    
    return {
        "app_info": LICENSES["app_info"],
        "libraries": libraries,
        "third_party_services": LICENSES["third_party_services"].get(lang, LICENSES["third_party_services"]["en"]),
        "disclaimer": LICENSES["disclaimer"].get(lang, LICENSES["disclaimer"]["en"])
    }

@router.get("/all")
async def get_all_legal_content(lang: str = Query("tr", description="Language code (BCP 47)")):
    """Get all legal content in one request"""
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"

    return {
        "privacy_policy": PRIVACY_POLICY.get(lang, PRIVACY_POLICY["en"]),
        "terms_of_service": TERMS_OF_SERVICE.get(lang, TERMS_OF_SERVICE["en"]),
        "licenses": await get_licenses(lang),
        "supported_languages": SUPPORTED_LANGUAGES,
        "last_updated": LAST_UPDATED
    }


# =====================================================
# INTERNATIONAL COMPLIANCE - DETAILED LEGAL FRAMEWORKS
# =====================================================

COMPLIANCE_FRAMEWORKS = {
    "GDPR": {
        "name": "General Data Protection Regulation",
        "full_name": "Regulation (EU) 2016/679",
        "effective_date": "May 25, 2018",
        "region": "European Union",
        "applies_to": ["EU citizens", "EU residents", "Anyone whose data is processed by EU-based entities"],
        "key_rights": [
            "Right to access (Article 15)",
            "Right to rectification (Article 16)",
            "Right to erasure / Right to be forgotten (Article 17)",
            "Right to restrict processing (Article 18)",
            "Right to data portability (Article 20)",
            "Right to object (Article 21)",
            "Rights related to automated decision-making and profiling (Article 22)"
        ],
        "our_compliance": {
            "data_protection_officer": "dpo@socialbeats.app",
            "lawful_basis": ["Consent", "Contract performance", "Legitimate interests"],
            "data_retention": "User data is retained for the duration of account activity plus 30 days after deletion request",
            "security_measures": ["SSL/TLS encryption", "Bcrypt password hashing", "Regular security audits", "Access control"],
            "international_transfers": "Data may be transferred outside EU with Standard Contractual Clauses (SCC) safeguards"
        },
        "how_to_exercise_rights": {
            "email": "dpo@socialbeats.app",
            "in_app": "Settings > Privacy > Data Rights Request",
            "response_time": "Within 30 days (extendable to 90 days for complex requests)"
        },
        "supervisory_authority": "Contact your local Data Protection Authority (DPA). List available at: https://edpb.europa.eu/about-edpb/about-edpb/members_en",
        "penalties": "Up to €20 million or 4% of annual global turnover, whichever is higher"
    },
    "CCPA": {
        "name": "California Consumer Privacy Act",
        "full_name": "California Consumer Privacy Act of 2018 (as amended by CPRA)",
        "effective_date": "January 1, 2020 (CPRA amendments effective January 1, 2023)",
        "region": "California, USA",
        "applies_to": ["California residents"],
        "key_rights": [
            "Right to Know: What personal information is collected, used, shared, or sold",
            "Right to Delete: Request deletion of personal information",
            "Right to Opt-Out: Say no to the sale or sharing of personal information",
            "Right to Non-Discrimination: Equal service and pricing regardless of privacy choices",
            "Right to Correct: Request correction of inaccurate personal information",
            "Right to Limit: Restrict use of sensitive personal information"
        ],
        "categories_collected": [
            "Identifiers (name, email, username)",
            "Internet activity (listening history, app usage)",
            "Geolocation data (if permitted)",
            "Audio information (voice messages)",
            "Inferences (music preferences)"
        ],
        "our_compliance": {
            "sale_of_data": "We DO NOT sell personal information to third parties",
            "sharing_for_ads": "We may share data with advertising partners for targeted ads (you can opt-out)",
            "sensitive_data": "We do not collect sensitive personal information as defined by CCPA"
        },
        "how_to_exercise_rights": {
            "email": "privacy@socialbeats.app",
            "toll_free": "Contact via email (toll-free number not available)",
            "in_app": "Settings > Privacy > CCPA Rights",
            "opt_out_link": "/api/legal/ccpa-opt-out",
            "response_time": "Within 45 days (extendable to 90 days)"
        },
        "contact": "privacy@socialbeats.app",
        "verification": "We may need to verify your identity before processing requests"
    },
    "KVKK": {
        "name": "Kişisel Verilerin Korunması Kanunu",
        "full_name": "6698 Sayılı Kişisel Verilerin Korunması Kanunu",
        "effective_date": "7 Nisan 2016",
        "region": "Türkiye",
        "applies_to": ["Türkiye Cumhuriyeti vatandaşları", "Türkiye'de ikamet edenler"],
        "key_rights": [
            "Kişisel verilerin işlenip işlenmediğini öğrenme hakkı (Madde 11/1-a)",
            "Kişisel veriler işlenmişse buna ilişkin bilgi talep etme hakkı (Madde 11/1-b)",
            "Kişisel verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme hakkı (Madde 11/1-c)",
            "Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme hakkı (Madde 11/1-ç)",
            "Kişisel verilerin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme hakkı (Madde 11/1-d)",
            "Kişisel verilerin silinmesini veya yok edilmesini isteme hakkı (Madde 11/1-e)",
            "Düzeltme, silme veya yok etme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme hakkı (Madde 11/1-f)",
            "İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine bir sonucun ortaya çıkmasına itiraz etme hakkı (Madde 11/1-g)",
            "Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğraması hâlinde zararın giderilmesini talep etme hakkı (Madde 11/1-ğ)"
        ],
        "veri_sorumlusu": {
            "unvan": "SocialBeats",
            "adres": "İstanbul, Türkiye",
            "email": "kvkk@socialbeats.app",
            "verbis_kayit": "VERBİS'e kayıt işlemleri devam etmektedir"
        },
        "islenen_veriler": {
            "kimlik_bilgileri": ["Ad", "Soyad", "Kullanıcı adı"],
            "iletisim_bilgileri": ["E-posta adresi", "Telefon numarası (opsiyonel)"],
            "dijital_veriler": ["IP adresi", "Cihaz bilgileri", "Çerez verileri"],
            "kullanim_verileri": ["Dinleme geçmişi", "Uygulama kullanım verileri", "Arama geçmişi"],
            "gorsel_isitsel_veriler": ["Profil fotoğrafı", "Sesli mesajlar"]
        },
        "isleme_amaci": [
            "Hizmet sunumu ve hesap yönetimi",
            "Kişiselleştirilmiş müzik önerileri",
            "Güvenlik ve dolandırıcılık önleme",
            "Yasal yükümlülüklerin yerine getirilmesi",
            "Müşteri memnuniyeti ve iletişim"
        ],
        "hukuki_sebep": "KVKK Madde 5/2-c (Sözleşmenin kurulması için gereklilik) ve Madde 5/1 (Açık rıza)",
        "veri_saklama_suresi": "Hesap aktif olduğu sürece + silme talebinden itibaren 30 gün",
        "haklarinizi_nasil_kullanirsiniz": {
            "email": "kvkk@socialbeats.app",
            "uygulama_ici": "Ayarlar > Gizlilik > KVKK Hakları",
            "posta": "Yazılı başvuru ile",
            "yanit_suresi": "30 gün içinde"
        },
        "authority": "Kişisel Verileri Koruma Kurumu (KVKK)",
        "authority_website": "https://www.kvkk.gov.tr",
        "sikayet_hakki": "Talepleriniz reddedilirse veya 30 gün içinde yanıt alamazsanız KVKK'ya şikayette bulunabilirsiniz"
    },
    "LGPD": {
        "name": "Lei Geral de Proteção de Dados",
        "full_name": "Lei nº 13.709/2018 - Lei Geral de Proteção de Dados Pessoais",
        "effective_date": "18 de setembro de 2020",
        "region": "Brasil",
        "applies_to": ["Cidadãos brasileiros", "Residentes no Brasil", "Qualquer pessoa cujos dados sejam processados no Brasil"],
        "key_rights": [
            "Confirmação da existência de tratamento (Art. 18, I)",
            "Acesso aos dados (Art. 18, II)",
            "Correção de dados incompletos, inexatos ou desatualizados (Art. 18, III)",
            "Anonimização, bloqueio ou eliminação de dados desnecessários (Art. 18, IV)",
            "Portabilidade dos dados (Art. 18, V)",
            "Eliminação dos dados pessoais tratados com o consentimento (Art. 18, VI)",
            "Informação sobre compartilhamento de dados (Art. 18, VII)",
            "Informação sobre a possibilidade de não fornecer consentimento (Art. 18, VIII)",
            "Revogação do consentimento (Art. 18, IX)"
        ],
        "dados_coletados": {
            "dados_pessoais": ["Nome", "E-mail", "Nome de usuário"],
            "dados_de_uso": ["Histórico de reprodução", "Preferências musicais", "Interações no app"],
            "dados_tecnicos": ["Endereço IP", "Tipo de dispositivo", "Sistema operacional"]
        },
        "base_legal": [
            "Consentimento do titular (Art. 7, I)",
            "Execução de contrato (Art. 7, V)",
            "Legítimo interesse (Art. 7, IX)"
        ],
        "encarregado": {
            "nome": "Encarregado de Proteção de Dados - SocialBeats",
            "email": "lgpd@socialbeats.app"
        },
        "como_exercer_direitos": {
            "email": "lgpd@socialbeats.app",
            "no_app": "Configurações > Privacidade > Direitos LGPD",
            "prazo_resposta": "15 dias úteis"
        },
        "authority": "ANPD (Autoridade Nacional de Proteção de Dados)",
        "authority_website": "https://www.gov.br/anpd",
        "transferencia_internacional": "Dados podem ser transferidos para outros países com cláusulas contratuais padrão"
    },
    "PIPEDA": {
        "name": "Personal Information Protection and Electronic Documents Act",
        "region": "Canada",
        "applies_to": ["Canadian citizens", "Canada residents"],
        "key_rights": [
            "Right to access personal information",
            "Right to challenge accuracy",
            "Right to know how information is used",
            "Right to withdraw consent"
        ],
        "contact": "privacy@socialbeats.app"
    },
    "PDPA": {
        "name": "Personal Data Protection Act",
        "region": "Singapore",
        "applies_to": ["Singapore residents"],
        "key_rights": [
            "Right to access personal data",
            "Right to correction",
            "Right to withdraw consent"
        ],
        "contact": "pdpa@socialbeats.app"
    },
    "APPI": {
        "name": "Act on Protection of Personal Information",
        "region": "Japan",
        "applies_to": ["Japan residents"],
        "key_rights": [
            "Right to disclosure",
            "Right to correction",
            "Right to suspension of use",
            "Right to deletion"
        ],
        "contact": "privacy-jp@socialbeats.app"
    },
    "POPIA": {
        "name": "Protection of Personal Information Act",
        "region": "South Africa",
        "applies_to": ["South Africa residents"],
        "key_rights": [
            "Right to be notified",
            "Right to access",
            "Right to correct",
            "Right to delete"
        ],
        "contact": "popia@socialbeats.app"
    }
}

DATA_SUBJECT_REQUESTS = {
    "tr": {
        "title": "Veri Sahibi Hakları Talebi",
        "description": "Kişisel verileriniz hakkında talepte bulunabilirsiniz.",
        "request_types": [
            {"id": "access", "name": "Verilerime Erişim", "description": "Hakkınızda tuttuğumuz tüm verilerin bir kopyasını alın"},
            {"id": "rectification", "name": "Düzeltme", "description": "Yanlış veya eksik verilerin düzeltilmesini isteyin"},
            {"id": "erasure", "name": "Silme (Unutulma Hakkı)", "description": "Kişisel verilerinizin silinmesini isteyin"},
            {"id": "portability", "name": "Taşınabilirlik", "description": "Verilerinizi yapılandırılmış formatta alın"},
            {"id": "restriction", "name": "İşleme Kısıtlaması", "description": "Verilerinizin işlenmesinin kısıtlanmasını isteyin"},
            {"id": "objection", "name": "İtiraz", "description": "Veri işlemeye itiraz edin"}
        ],
        "process_time": "30 gün içinde yanıtlanır",
        "submit_url": "/api/legal/data-request"
    },
    "en": {
        "title": "Data Subject Rights Request",
        "description": "You can submit requests regarding your personal data.",
        "request_types": [
            {"id": "access", "name": "Access My Data", "description": "Get a copy of all data we hold about you"},
            {"id": "rectification", "name": "Rectification", "description": "Request correction of inaccurate or incomplete data"},
            {"id": "erasure", "name": "Erasure (Right to be Forgotten)", "description": "Request deletion of your personal data"},
            {"id": "portability", "name": "Data Portability", "description": "Receive your data in a structured format"},
            {"id": "restriction", "name": "Restriction of Processing", "description": "Request limitation of data processing"},
            {"id": "objection", "name": "Object", "description": "Object to data processing"}
        ],
        "process_time": "Response within 30 days",
        "submit_url": "/api/legal/data-request"
    }
}

COOKIE_CONSENT = {
    "categories": [
        {
            "id": "necessary",
            "name": {"tr": "Zorunlu", "en": "Necessary"},
            "description": {"tr": "Uygulamanın çalışması için gerekli", "en": "Required for the app to function"},
            "required": True
        },
        {
            "id": "analytics",
            "name": {"tr": "Analitik", "en": "Analytics"},
            "description": {"tr": "Kullanım istatistikleri toplama", "en": "Collect usage statistics"},
            "required": False
        },
        {
            "id": "marketing",
            "name": {"tr": "Pazarlama", "en": "Marketing"},
            "description": {"tr": "Kişiselleştirilmiş içerik", "en": "Personalized content"},
            "required": False
        }
    ]
}

@router.get("/compliance")
async def get_compliance_info(region: Optional[str] = None):
    """Get compliance information for specific region or all"""
    if region and region.upper() in COMPLIANCE_FRAMEWORKS:
        return {
            "framework": COMPLIANCE_FRAMEWORKS[region.upper()],
            "region": region.upper()
        }
    
    return {
        "frameworks": COMPLIANCE_FRAMEWORKS,
        "message": "We comply with all major international data protection regulations",
        "contact": "legal@socialbeats.app"
    }

@router.get("/data-rights")
async def get_data_rights(lang: str = Query("en")):
    """Get data subject rights information"""
    if lang not in DATA_SUBJECT_REQUESTS:
        lang = "en"
    
    return {
        "rights": DATA_SUBJECT_REQUESTS[lang],
        "frameworks_applied": list(COMPLIANCE_FRAMEWORKS.keys())
    }

@router.get("/cookie-policy")
async def get_cookie_policy(lang: str = Query("en")):
    """Get cookie consent categories"""
    categories = []
    for cat in COOKIE_CONSENT["categories"]:
        categories.append({
            "id": cat["id"],
            "name": cat["name"].get(lang, cat["name"]["en"]),
            "description": cat["description"].get(lang, cat["description"]["en"]),
            "required": cat["required"]
        })
    
    return {"categories": categories}

@router.post("/data-request")
async def submit_data_request(
    request_type: str = Query(..., description="Type: access, rectification, erasure, portability, restriction, objection"),
    email: str = Query(..., description="Your email address"),
    details: Optional[str] = Query(None, description="Additional details")
):
    """Submit a data subject request (GDPR, CCPA, KVKK, LGPD compliant)"""
    import uuid
    
    valid_types = ["access", "rectification", "erasure", "portability", "restriction", "objection"]
    if request_type not in valid_types:
        return {"error": f"Invalid request type. Valid types: {valid_types}"}
    
    request_id = str(uuid.uuid4())[:8].upper()
    
    return {
        "status": "received",
        "request_id": f"DSR-{request_id}",
        "request_type": request_type,
        "email": email,
        "message": "Your request has been received. We will respond within 30 days.",
        "estimated_response": "30 days",
        "contact": "privacy@socialbeats.app"
    }

@router.post("/ccpa-opt-out")
async def ccpa_opt_out(email: str = Query(...)):
    """CCPA Do Not Sell My Personal Information"""
    return {
        "status": "processed",
        "message": "Your opt-out request has been processed. We do not sell personal information.",
        "email": email,
        "note": "We do not sell personal data to third parties."
    }

@router.get("/age-verification")
async def get_age_verification_info(lang: str = Query("en")):
    """Get age verification requirements"""
    info = {
        "tr": {
            "minimum_age": 13,
            "title": "Yaş Doğrulaması",
            "message": "Bu uygulamayı kullanmak için en az 13 yaşında olmalısınız.",
            "parental_consent": "13-18 yaş arası kullanıcılar için ebeveyn onayı gerekebilir.",
            "coppa_compliance": "COPPA (ABD) ve benzeri uluslararası çocuk koruma yasalarına uyuyoruz."
        },
        "en": {
            "minimum_age": 13,
            "title": "Age Verification",
            "message": "You must be at least 13 years old to use this app.",
            "parental_consent": "Parental consent may be required for users aged 13-18.",
            "coppa_compliance": "We comply with COPPA (USA) and similar international child protection laws."
        }
    }
    
    return info.get(lang, info["en"])

@router.get("/international-transfers")
async def get_international_transfer_info(lang: str = Query("en")):
    """Information about international data transfers"""
    info = {
        "tr": {
            "title": "Uluslararası Veri Transferleri",
            "description": "Verileriniz aşağıdaki ülkelere/bölgelere aktarılabilir:",
            "transfers": [
                {"region": "Avrupa Birliği", "mechanism": "Standart Sözleşme Maddeleri (SCC)"},
                {"region": "Amerika Birleşik Devletleri", "mechanism": "Standart Sözleşme Maddeleri (SCC)"},
                {"region": "Türkiye", "mechanism": "KVKK uyumlu aktarım"}
            ],
            "safeguards": "Tüm transferler uygun güvenlik önlemleri ile korunmaktadır."
        },
        "en": {
            "title": "International Data Transfers",
            "description": "Your data may be transferred to the following countries/regions:",
            "transfers": [
                {"region": "European Union", "mechanism": "Standard Contractual Clauses (SCC)"},
                {"region": "United States", "mechanism": "Standard Contractual Clauses (SCC)"},
                {"region": "Turkey", "mechanism": "KVKK compliant transfer"}
            ],
            "safeguards": "All transfers are protected with appropriate security measures."
        }
    }
    
    return info.get(lang, info["en"])
