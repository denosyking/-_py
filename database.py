import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'store.db')

async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db

async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('PRAGMA journal_mode = WAL;')
        await db.execute('PRAGMA foreign_keys = ON;')
        
        await db.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                is_admin INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon TEXT DEFAULT 'package',
                description TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER,
                name TEXT NOT NULL,
                description TEXT,
                short_description TEXT,
                price REAL NOT NULL,
                currency TEXT DEFAULT 'USDT',
                file_content TEXT,
                image_url TEXT,
                is_active INTEGER DEFAULT 1,
                stock INTEGER DEFAULT -1,
                sales_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );

            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, product_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total REAL NOT NULL,
                currency TEXT DEFAULT 'USDT',
                status TEXT DEFAULT 'pending',
                invoice_id TEXT,
                promo_code TEXT,
                discount_percent REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                paid_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                price REAL NOT NULL,
                quantity INTEGER DEFAULT 1,
                file_content TEXT,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );

            CREATE TABLE IF NOT EXISTS promo_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                discount_percent REAL NOT NULL,
                max_uses INTEGER DEFAULT -1,
                used_count INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
        ''')
        await db.commit()

        # Seed data
        async with db.execute('SELECT COUNT(*) as count FROM categories') as cursor:
            row = await cursor.fetchone()
            category_count = row[0]

        if category_count == 0:
            print('Seeding database...')
            
            categories = [
                ('Аккаунты', 'user', 'Готовые аккаунты популярных сервисов', 1),
                ('Ключи и лицензии', 'key', 'Лицензионные ключи для программ и игр', 2),
                ('Подписки', 'crown', 'Подписки на стриминговые и облачные сервисы', 3),
                ('Софт', 'code', 'Программное обеспечение и утилиты', 4),
                ('Гайды', 'book', 'Обучающие материалы и руководства', 5),
                ('Прочее', 'package', 'Другие цифровые товары', 6),
            ]
            
            await db.executemany(
                'INSERT INTO categories (name, icon, description, sort_order) VALUES (?, ?, ?, ?)',
                categories
            )

            products = [
                (1, 'Netflix Premium', 'Аккаунт Netflix Premium с полным доступом ко всем фильмам, сериалам и документальным фильмам в Ultra HD 4K качестве. Поддержка до 4 экранов одновременно. Аккаунт выдаётся мгновенно после оплаты.', 'Аккаунт Netflix Premium Ultra HD 4K', 3.99, 'USDT', 'Login: netflix_user@mail.com\nPassword: Nx!92kPm\n\nИнструкция:\n1. Перейдите на netflix.com\n2. Войдите с указанными данными\n3. НЕ меняйте пароль', 50, 127),
                (1, 'Spotify Premium Family', 'Семейная подписка Spotify Premium на 6 участников. Без рекламы, оффлайн-прослушивание, максимальное качество звука 320 kbps. Доступ к 100+ миллионам треков.', 'Spotify Premium Family на 6 человек', 1.99, 'USDT', 'Invite Link: https://spotify.com/family/invite/abc123\n\nИнструкция:\n1. Перейдите по ссылке\n2. Войдите в свой Spotify аккаунт\n3. Примите приглашение в семейный план', 100, 243),
                (2, 'Windows 11 Pro Key', 'Лицензионный ключ активации Windows 11 Professional. Поддержка всех функций: BitLocker, Remote Desktop, Hyper-V, Windows Sandbox. Привязка к Microsoft аккаунту. Пожизненная лицензия.', 'Лицензионный ключ Windows 11 Pro', 12.99, 'USDT', 'Product Key: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX\n\nАктивация:\n1. Настройки → Обновление и безопасность → Активация\n2. Изменить ключ продукта\n3. Введите ключ выше\n4. Следуйте инструкциям', 30, 89),
                (2, 'Office 365', 'Подписка Microsoft Office 365 на 1 год. Включает Word, Excel, PowerPoint, Outlook, OneDrive 1TB. Работает на 5 устройствах одновременно. Автообновление до последних версий.', 'Microsoft Office 365 подписка 1 год', 8.99, 'USDT', 'Account: office_user@outlook.com\nPassword: Of!365xKm\n\nИнструкция:\n1. Перейдите на office.com\n2. Войдите с указанными данными\n3. Скачайте приложения Office', 25, 156),
                (3, 'YouTube Premium 3 мес', 'Подписка YouTube Premium на 3 месяца. Без рекламы, фоновое воспроизведение, скачивание видео, доступ к YouTube Music Premium. Активация через invite-ссылку семейного плана.', 'YouTube Premium подписка 3 месяца', 4.99, 'USDT', 'Family Invite: https://youtube.com/family/invite/xyz789\n\nИнструкция:\n1. Откройте ссылку\n2. Войдите в свой Google аккаунт\n3. Примите приглашение', 40, 198),
                (3, 'ChatGPT Plus 1 мес', 'Подписка ChatGPT Plus на 1 месяц. Доступ к GPT-4, приоритетный доступ в часы пик, быстрые ответы, доступ к плагинам и Code Interpreter. Аккаунт выдаётся мгновенно.', 'ChatGPT Plus подписка 1 месяц', 6.99, 'USDT', 'Account: chatgpt_user@proton.me\nPassword: Cg!4pLus\n\nИнструкция:\n1. Перейдите на chat.openai.com\n2. Войдите с указанными данными\n3. Не меняйте email и пароль', 20, 312),
                (4, 'VPN WireGuard', 'Конфигурация VPN на протоколе WireGuard. Высокая скорость, низкий пинг, серверы в 15 странах. Подходит для ПК, Mac, Android, iOS. Безлимитный трафик на 30 дней.', 'VPN WireGuard конфиг на 30 дней', 2.49, 'USDT', '[Interface]\nPrivateKey = XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\nAddress = 10.0.0.2/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY\nEndpoint = vpn.server.com:51820\nAllowedIPs = 0.0.0.0/0', -1, 445),
                (5, 'Гайд по заработку на NFT', 'Подробное руководство по заработку на NFT в 2024 году. 150+ страниц: создание, продвижение и продажа NFT на OpenSea, Rarible, Foundation. Стратегии минтинга, вайтлисты, флиппинг. Реальные кейсы с доходом $10,000+.', 'Полный гайд по заработку на NFT', 14.99, 'USDT', '📖 Гайд по NFT - Содержание:\n\n1. Основы NFT и блокчейна\n2. Создание NFT коллекции\n3. Маркетплейсы и листинг\n4. Продвижение в Discord и Twitter\n5. Стратегии флиппинга\n6. Кейсы заработка\n\n[Полный текст гайда - 150 страниц]\n\nСкачать PDF: https://example.com/nft-guide.pdf', -1, 67),
                (3, 'Discord Nitro', 'Discord Nitro подписка на 1 месяц. Animated аватар, кастомные эмодзи везде, стриминг 4K 60fps, Upload до 500MB, 2 буста серверу, эксклюзивные стикеры и профиль.', 'Discord Nitro подписка 1 месяц', 5.49, 'USDT', 'Gift Link: https://discord.gift/XXXXXXXXXXXXXXXXX\n\nИнструкция:\n1. Откройте ссылку\n2. Войдите в Discord аккаунт\n3. Активируйте подарок\n4. Наслаждайтесь Nitro!', 35, 178),
                (3, 'Adobe Creative Cloud 1 мес', 'Подписка Adobe Creative Cloud на 1 месяц. Полный пакет: Photoshop, Illustrator, Premiere Pro, After Effects, Lightroom и 20+ приложений. 100GB облачного хранилища. Adobe Fonts и Stock.', 'Adobe Creative Cloud полный пакет 1 мес', 9.99, 'USDT', 'Account: adobe_user@mail.com\nPassword: Ad!0beCc\n\nИнструкция:\n1. Скачайте Creative Cloud с adobe.com\n2. Войдите с указанными данными\n3. Установите нужные приложения\n4. НЕ меняйте пароль', 15, 94),
            ]

            await db.executemany(
                '''INSERT INTO products (category_id, name, description, short_description, price, currency, file_content, stock, sales_count)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                products
            )
            
            await db.commit()
            print('✅ Database seeded with 6 categories and 10 products')
