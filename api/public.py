import os
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
import httpx
from datetime import datetime
from database import get_db
from api.auth import get_current_user

router = APIRouter()

class CartAction(BaseModel):
    product_id: int
    quantity: int = 1

class PromoCheck(BaseModel):
    code: str

class PaymentCreate(BaseModel):
    promo_code: str | None = None

class ReviewCreate(BaseModel):
    product_id: int
    rating: int
    comment: str | None = None

@router.get('/init')
async def init_data(user=Depends(get_current_user), db=Depends(get_db)):
    try:
        async with db.execute('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order') as cursor:
            categories = [dict(row) for row in await cursor.fetchall()]
            
        async with db.execute('''
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.is_active = 1 
            ORDER BY p.sales_count DESC LIMIT 6
        ''') as cursor:
            featured = [dict(row) for row in await cursor.fetchall()]
            
        async with db.execute('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?', (user['id'],)) as cursor:
            row = await cursor.fetchone()
            cart_count = row['count']
            
        return {
            "user": {
                "id": user['id'],
                "telegram_id": user['telegram_id'],
                "username": user['username'],
                "first_name": user['first_name'],
                "is_admin": user['is_admin'],
            },
            "categories": categories,
            "featured": featured,
            "cart_count": cart_count
        }
    except Exception as e:
        print(f"Init error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/products')
async def get_products(
    category_id: int | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1),
    db=Depends(get_db)
):
    offset = (page - 1) * limit
    params = []
    where = "WHERE p.is_active = 1"
    
    if category_id:
        where += " AND p.category_id = ?"
        params.append(category_id)
        
    if search:
        where += " AND (p.name LIKE ? OR p.description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
        
    try:
        async with db.execute(f"SELECT COUNT(*) as count FROM products p {where}", params) as cursor:
            total = (await cursor.fetchone())['count']
            
        params.extend([limit, offset])
        async with db.execute(f'''
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            {where} 
            ORDER BY p.created_at DESC LIMIT ? OFFSET ?
        ''', params) as cursor:
            products = [dict(row) for row in await cursor.fetchall()]
            
        import math
        return {
            "products": products,
            "total": total,
            "page": page,
            "pages": math.ceil(total / limit)
        }
    except Exception as e:
        print(f"Products error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/products/{id}')
async def get_product(id: int, db=Depends(get_db)):
    try:
        async with db.execute('''
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ?
        ''', (id,)) as cursor:
            product = await cursor.fetchone()
            
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
            
        product = dict(product)
        
        async with db.execute('''
            SELECT r.*, u.username, u.first_name 
            FROM reviews r 
            LEFT JOIN users u ON r.user_id = u.id 
            WHERE r.product_id = ? 
            ORDER BY r.created_at DESC
        ''', (product['id'],)) as cursor:
            reviews = [dict(row) for row in await cursor.fetchall()]
            
        async with db.execute('SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE product_id = ?', (product['id'],)) as cursor:
            row = await cursor.fetchone()
            avg_rating = round(float(row['avg_rating']), 1) if row['avg_rating'] else 0.0
            review_count = row['review_count']
            
        return {
            "product": product,
            "reviews": reviews,
            "avg_rating": avg_rating,
            "review_count": review_count
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Product detail error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/cart')
async def get_cart(user=Depends(get_current_user), db=Depends(get_db)):
    try:
        async with db.execute('''
            SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.currency, p.image_url, p.stock, p.is_active
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
        ''', (user['id'],)) as cursor:
            items = [dict(row) for row in await cursor.fetchall()]
            
        formatted_items = []
        total = 0.0
        count = 0
        
        for item in items:
            formatted_items.append({
                "id": item['id'],
                "quantity": item['quantity'],
                "product": {
                    "id": item['product_id'],
                    "name": item['name'],
                    "price": item['price'],
                    "currency": item['currency'],
                    "image_url": item['image_url'],
                    "stock": item['stock'],
                    "is_active": item['is_active']
                }
            })
            total += item['price'] * item['quantity']
            count += item['quantity']
            
        return {
            "items": formatted_items,
            "total": round(total, 2),
            "count": count
        }
    except Exception as e:
        print(f"Cart error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/cart/add')
async def cart_add(data: CartAction, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        async with db.execute('SELECT * FROM products WHERE id = ? AND is_active = 1', (data.product_id,)) as cursor:
            product = await cursor.fetchone()
            
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
            
        if product['stock'] != -1 and product['stock'] <= 0:
            raise HTTPException(status_code=400, detail="Out of stock")
            
        async with db.execute('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', (user['id'], data.product_id)) as cursor:
            existing = await cursor.fetchone()
            
        if existing:
            await db.execute('UPDATE cart_items SET quantity = quantity + 1 WHERE id = ?', (existing['id'],))
        else:
            await db.execute('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, 1)', (user['id'], data.product_id))
            
        await db.commit()
        
        async with db.execute('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?', (user['id'],)) as cursor:
            cart_count = (await cursor.fetchone())['count']
            
        return {"success": True, "cart_count": cart_count}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Cart add error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/cart/remove')
async def cart_remove(data: CartAction, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        await db.execute('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', (user['id'], data.product_id))
        await db.commit()
        
        async with db.execute('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?', (user['id'],)) as cursor:
            cart_count = (await cursor.fetchone())['count']
            
        return {"success": True, "cart_count": cart_count}
    except Exception as e:
        print(f"Cart remove error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/cart/update')
async def cart_update(data: CartAction, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        if data.quantity <= 0:
            await db.execute('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', (user['id'], data.product_id))
        else:
            await db.execute('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?', (data.quantity, user['id'], data.product_id))
        await db.commit()
        
        async with db.execute('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?', (user['id'],)) as cursor:
            cart_count = (await cursor.fetchone())['count']
            
        return {"success": True, "cart_count": cart_count}
    except Exception as e:
        print(f"Cart update error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/cart/clear')
async def cart_clear(user=Depends(get_current_user), db=Depends(get_db)):
    try:
        await db.execute('DELETE FROM cart_items WHERE user_id = ?', (user['id'],))
        await db.commit()
        return {"success": True}
    except Exception as e:
        print(f"Cart clear error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/promo/check')
async def promo_check(data: PromoCheck, db=Depends(get_db)):
    try:
        if not data.code:
            return {"valid": False, "message": "Введите промокод"}
            
        async with db.execute('SELECT * FROM promo_codes WHERE code = ?', (data.code.upper(),)) as cursor:
            promo = await cursor.fetchone()
            
        if not promo:
            return {"valid": False, "message": "Промокод не найден"}
            
        if not promo['is_active']:
            return {"valid": False, "message": "Промокод неактивен"}
            
        if promo['expires_at'] and datetime.fromisoformat(promo['expires_at']) < datetime.now():
            return {"valid": False, "message": "Промокод истёк"}
            
        if promo['max_uses'] != -1 and promo['used_count'] >= promo['max_uses']:
            return {"valid": False, "message": "Промокод исчерпан"}
            
        return {
            "valid": True,
            "discount_percent": promo['discount_percent'],
            "message": f"Скидка {promo['discount_percent']}% применена!"
        }
    except Exception as e:
        print(f"Promo check error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/payment/create')
async def payment_create(data: PaymentCreate, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        async with db.execute('''
            SELECT ci.*, p.name, p.price, p.file_content, p.stock, p.is_active
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
        ''', (user['id'],)) as cursor:
            cart_items = [dict(row) for row in await cursor.fetchall()]
            
        if not cart_items:
            raise HTTPException(status_code=400, detail="Корзина пуста")
            
        for item in cart_items:
            if not item['is_active']:
                raise HTTPException(status_code=400, detail=f"Товар '{item['name']}' больше не доступен")
            if item['stock'] != -1 and item['stock'] < item['quantity']:
                raise HTTPException(status_code=400, detail=f"Недостаточно товара '{item['name']}' на складе")
                
        total = sum(item['price'] * item['quantity'] for item in cart_items)
        discount_percent = 0
        
        if data.promo_code:
            async with db.execute('SELECT * FROM promo_codes WHERE code = ?', (data.promo_code.upper(),)) as cursor:
                promo = await cursor.fetchone()
            if promo and promo['is_active']:
                valid = True
                if promo['expires_at'] and datetime.fromisoformat(promo['expires_at']) < datetime.now():
                    valid = False
                if promo['max_uses'] != -1 and promo['used_count'] >= promo['max_uses']:
                    valid = False
                if valid:
                    discount_percent = promo['discount_percent']
                    total = total * (1 - discount_percent / 100)
                    
        total = round(total, 2)
        
        await db.execute('''
            INSERT INTO orders (user_id, total, currency, status, promo_code, discount_percent)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user['id'], total, 'USDT', 'pending', data.promo_code.upper() if data.promo_code else None, discount_percent))
        await db.commit()
        
        async with db.execute('SELECT last_insert_rowid() as id') as cursor:
            order_id = (await cursor.fetchone())['id']
            
        items_data = [(order_id, item['product_id'], item['name'], item['price'], item['quantity'], item['file_content']) for item in cart_items]
        await db.executemany('''
            INSERT INTO order_items (order_id, product_id, product_name, price, quantity, file_content)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', items_data)
        
        # CryptoBot API call
        invoice_url = None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post('https://pay.crypt.bot/api/createInvoice', json={
                    "currency_type": "crypto",
                    "asset": "USDT",
                    "amount": str(total),
                    "description": f"Заказ #{order_id}",
                    "payload": str(order_id),
                    "paid_btn_name": "callback",
                    "paid_btn_url": "https://t.me/bot"
                }, headers={
                    "Crypto-Pay-API-Token": os.getenv('CRYPTO_BOT_TOKEN')
                })
                
                resp_data = response.json()
                if resp_data.get('result'):
                    res = resp_data['result']
                    invoice_url = res.get('mini_app_invoice_url') or res.get('pay_url')
                    invoice_id = res.get('invoice_id')
                    await db.execute('UPDATE orders SET invoice_id = ? WHERE id = ?', (str(invoice_id), order_id))
        except Exception as e:
            print(f"CryptoBot API error: {e}")
            
        # Clear cart & update stock
        await db.execute('DELETE FROM cart_items WHERE user_id = ?', (user['id'],))
        
        for item in cart_items:
            if item['stock'] != -1:
                await db.execute('UPDATE products SET stock = stock - ? WHERE id = ?', (item['quantity'], item['product_id']))
                
        await db.commit()
        
        return {
            "order_id": order_id,
            "invoice_url": invoice_url,
            "total": total
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Payment create error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/orders')
async def get_orders(user=Depends(get_current_user), db=Depends(get_db)):
    try:
        async with db.execute('''
            SELECT o.*, 
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
            FROM orders o
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        ''', (user['id'],)) as cursor:
            orders = [dict(row) for row in await cursor.fetchall()]
            
        return {"orders": orders}
    except Exception as e:
        print(f"Orders error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/orders/{id}')
async def get_order(id: int, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        async with db.execute('SELECT * FROM orders WHERE id = ? AND user_id = ?', (id, user['id'])) as cursor:
            order = await cursor.fetchone()
            
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
            
        order = dict(order)
        
        async with db.execute('SELECT * FROM order_items WHERE order_id = ?', (order['id'],)) as cursor:
            items = [dict(row) for row in await cursor.fetchall()]
            
        formatted_items = []
        for item in items:
            item_dict = dict(item)
            if order['status'] != 'paid':
                item_dict['file_content'] = None
            formatted_items.append(item_dict)
            
        return {"order": order, "items": formatted_items}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Order detail error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/reviews')
async def create_review(data: ReviewCreate, user=Depends(get_current_user), db=Depends(get_db)):
    try:
        if not data.product_id or not data.rating or data.rating < 1 or data.rating > 5:
            raise HTTPException(status_code=400, detail="Invalid data")
            
        async with db.execute('SELECT * FROM reviews WHERE user_id = ? AND product_id = ?', (user['id'], data.product_id)) as cursor:
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail="Вы уже оставили отзыв на этот товар")
                
        async with db.execute('SELECT * FROM products WHERE id = ?', (data.product_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail="Product not found")
                
        await db.execute('INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)',
                         (user['id'], data.product_id, data.rating, data.comment))
        await db.commit()
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Review error: {e}")
        raise HTTPException(status_code=500, detail="Server error")
