import os
import hmac
import hashlib
import json
from urllib.parse import parse_qsl
from fastapi import Request, HTTPException, Depends
from database import get_db

def validate_init_data(init_data: str, bot_token: str) -> bool:
    try:
        parsed_data = dict(parse_qsl(init_data))
        if 'hash' not in parsed_data:
            return False
            
        hash_val = parsed_data.pop('hash')
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        return calculated_hash == hash_val
    except Exception:
        return False

async def get_current_user(request: Request, db=Depends(get_db)):
    auth_header = request.headers.get('authorization', '')
    init_data = auth_header.replace('tma ', '').strip()
    
    # Dev bypass
    if os.getenv('NODE_ENV') == 'development' and not init_data:
        admin_id = int(os.getenv('ADMIN_ID', '0'))
        async with db.execute('SELECT * FROM users WHERE telegram_id = ?', (admin_id,)) as cursor:
            user = await cursor.fetchone()
        if not user:
            await db.execute('INSERT INTO users (telegram_id, username, first_name, is_admin) VALUES (?, ?, ?, ?)', 
                             (admin_id, 'admin', 'Admin', 1))
            await db.commit()
            async with db.execute('SELECT * FROM users WHERE telegram_id = ?', (admin_id,)) as cursor:
                user = await cursor.fetchone()
        return dict(user)
        
    if not init_data:
        raise HTTPException(status_code=401, detail="No authorization data")
        
    bot_token = os.getenv('BOT_TOKEN')
    is_valid = validate_init_data(init_data, bot_token)
    
    if not is_valid and os.getenv('NODE_ENV') != 'development':
        raise HTTPException(status_code=401, detail="Invalid authorization data")
        
    try:
        parsed = dict(parse_qsl(init_data))
        user_data = json.loads(parsed.get('user', '{}'))
        
        telegram_id = user_data.get('id')
        if not telegram_id:
            raise HTTPException(status_code=401, detail="No user data")
            
        async with db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)) as cursor:
            existing_user = await cursor.fetchone()
            
        admin_id = int(os.getenv('ADMIN_ID', '0'))
        is_admin_flag = 1 if telegram_id == admin_id else 0
            
        if existing_user:
            await db.execute('''
                UPDATE users 
                SET username = ?, first_name = ?, last_name = ?
                WHERE telegram_id = ?
            ''', (user_data.get('username'), user_data.get('first_name'), user_data.get('last_name'), telegram_id))
        else:
            await db.execute('''
                INSERT INTO users (telegram_id, username, first_name, last_name, is_admin)
                VALUES (?, ?, ?, ?, ?)
            ''', (telegram_id, user_data.get('username'), user_data.get('first_name'), user_data.get('last_name'), is_admin_flag))
            
        await db.commit()
        
        async with db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)) as cursor:
            user = await cursor.fetchone()
            user_dict = dict(user)
            
        if telegram_id == admin_id and not user_dict['is_admin']:
            await db.execute('UPDATE users SET is_admin = 1 WHERE telegram_id = ?', (telegram_id,))
            await db.commit()
            user_dict['is_admin'] = 1
            
        return user_dict
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Auth failed")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user
