from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_db
from api.auth import get_admin_user

router = APIRouter()

class ProductData(BaseModel):
    name: str
    description: str | None = None
    short_description: str | None = None
    price: float
    currency: str = "USDT"
    category_id: int | None = None
    file_content: str | None = None
    image_url: str | None = None
    stock: int = -1
    is_active: int = 1

class CategoryData(BaseModel):
    name: str
    icon: str = "package"
    description: str | None = None
    sort_order: int = 0
    is_active: int = 1

class OrderStatus(BaseModel):
    status: str

@router.get('/stats')
async def get_stats(admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        async with db.execute('SELECT COUNT(*) as count FROM users') as cursor:
            total_users = (await cursor.fetchone())['count']
            
        async with db.execute('SELECT COUNT(*) as count FROM orders') as cursor:
            total_orders = (await cursor.fetchone())['count']
            
        async with db.execute("SELECT COUNT(*) as count FROM orders WHERE status='paid'") as cursor:
            paid_orders = (await cursor.fetchone())['count']
            
        async with db.execute("SELECT COALESCE(SUM(total), 0) as rev FROM orders WHERE status='paid'") as cursor:
            total_revenue = (await cursor.fetchone())['rev']
            
        async with db.execute('SELECT COUNT(*) as count FROM products') as cursor:
            total_products = (await cursor.fetchone())['count']
            
        async with db.execute('''
            SELECT o.*, u.username, u.first_name 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            ORDER BY o.created_at DESC LIMIT 10
        ''') as cursor:
            recent_orders = [dict(row) for row in await cursor.fetchall()]
            
        async with db.execute('''
            SELECT * FROM products 
            ORDER BY sales_count DESC LIMIT 5
        ''') as cursor:
            top_products = [dict(row) for row in await cursor.fetchall()]
            
        return {
            "total_users": total_users,
            "total_orders": total_orders,
            "paid_orders": paid_orders,
            "total_revenue": round(total_revenue, 2),
            "total_products": total_products,
            "recent_orders": recent_orders,
            "top_products": top_products
        }
    except Exception as e:
        print(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/products')
async def admin_get_products(admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        async with db.execute('''
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            ORDER BY p.created_at DESC
        ''') as cursor:
            products = [dict(row) for row in await cursor.fetchall()]
        return {"products": products}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/products')
async def create_product(data: ProductData, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('''
            INSERT INTO products (name, description, short_description, price, currency, category_id, file_content, image_url, stock, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data.name, data.description, data.short_description, data.price, data.currency, data.category_id, data.file_content, data.image_url, data.stock, data.is_active))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.put('/products/{id}')
async def update_product(id: int, data: ProductData, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('''
            UPDATE products 
            SET name=?, description=?, short_description=?, price=?, currency=?, category_id=?, file_content=?, image_url=?, stock=?, is_active=?
            WHERE id=?
        ''', (data.name, data.description, data.short_description, data.price, data.currency, data.category_id, data.file_content, data.image_url, data.stock, data.is_active, id))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.delete('/products/{id}')
async def delete_product(id: int, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('DELETE FROM products WHERE id=?', (id,))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/categories')
async def admin_get_categories(admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        async with db.execute('SELECT * FROM categories ORDER BY sort_order') as cursor:
            categories = [dict(row) for row in await cursor.fetchall()]
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.post('/categories')
async def create_category(data: CategoryData, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('''
            INSERT INTO categories (name, icon, description, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?)
        ''', (data.name, data.icon, data.description, data.sort_order, data.is_active))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.put('/categories/{id}')
async def update_category(id: int, data: CategoryData, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('''
            UPDATE categories 
            SET name=?, icon=?, description=?, sort_order=?, is_active=?
            WHERE id=?
        ''', (data.name, data.icon, data.description, data.sort_order, data.is_active, id))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.delete('/categories/{id}')
async def delete_category(id: int, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('DELETE FROM categories WHERE id=?', (id,))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.get('/orders')
async def admin_get_orders(admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        async with db.execute('''
            SELECT o.*, u.username, u.first_name,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        ''') as cursor:
            orders = [dict(row) for row in await cursor.fetchall()]
        return {"orders": orders}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")

@router.put('/orders/{id}/status')
async def update_order_status(id: int, data: OrderStatus, admin=Depends(get_admin_user), db=Depends(get_db)):
    try:
        await db.execute('UPDATE orders SET status=? WHERE id=?', (data.status, id))
        if data.status == 'paid':
            await db.execute('UPDATE orders SET paid_at=CURRENT_TIMESTAMP WHERE id=?', (id,))
        await db.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server error")
