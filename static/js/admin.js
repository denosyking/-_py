window.Admin = {
  currentTab: 'dashboard',

  async render() {
    const container = document.getElementById('view-admin');
    container.innerHTML = `
      <div class="admin-tabs" id="admin-tabs">
        <div class="admin-tab active" onclick="window.Admin.switchTab('dashboard')">Дашборд</div>
        <div class="admin-tab" onclick="window.Admin.switchTab('products')">Товары</div>
        <div class="admin-tab" onclick="window.Admin.switchTab('categories')">Категории</div>
        <div class="admin-tab" onclick="window.Admin.switchTab('orders')">Заказы</div>
        <div class="admin-tab" onclick="window.Admin.switchTab('promo')">Промокоды</div>
        <div class="admin-tab" onclick="window.Admin.switchTab('users')">Юзеры</div>
      </div>
      <div class="admin-content" id="admin-content">
        <div class="spinner" style="margin:40px auto;"></div>
      </div>
    `;
    this.switchTab(this.currentTab);
  },

  async switchTab(tab) {
    this.currentTab = tab;
    const tabs = {
      dashboard: 'Дашборд', products: 'Товары', categories: 'Категории',
      orders: 'Заказы', promo: 'Промокоды', users: 'Юзеры'
    };
    document.querySelectorAll('.admin-tab').forEach(el => {
      el.classList.toggle('active', el.innerText === tabs[tab]);
    });

    const content = document.getElementById('admin-content');
    content.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

    try {
      switch(tab) {
        case 'dashboard': await this.renderDashboard(content); break;
        case 'products': await this.renderProducts(content); break;
        case 'categories': await this.renderCategories(content); break;
        case 'orders': await this.renderOrders(content); break;
        case 'promo': await this.renderPromo(content); break;
        case 'users': await this.renderUsers(content); break;
      }
    } catch(err) {
      console.error(err);
      content.innerHTML = '<div class="text-center text-muted mt-24">Ошибка загрузки</div>';
    }
  },

  async renderDashboard(content) {
    const res = await window.App.api('/admin/stats');
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${res.total_users}</div>
          <div class="stat-label">Юзеры</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${res.total_orders}</div>
          <div class="stat-label">Заказы</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${res.paid_orders}</div>
          <div class="stat-label">Оплачено</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${(res.total_revenue || 0).toFixed(2)}</div>
          <div class="stat-label">Выручка</div>
        </div>
      </div>
      <h3 class="section-title text-sm text-uppercase text-muted">Топ товары</h3>
      <div class="flex-col gap-8 mb-24">
        ${(res.top_products || []).map(p => `
          <div class="card p-16 flex-between">
            <div>${p.name}</div>
            <div class="badge">${p.sales_count} продаж</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async renderProducts(content) {
    const data = await window.App.api('/admin/products');
    const products = Array.isArray(data) ? data : (data.products || []);
    let html = `
      <div class="flex-between mb-16">
        <h3 class="section-title m-0" style="margin:0;">Все товары</h3>
        <button class="btn btn-sm btn-primary" onclick="window.Admin.showProductModal()">+ Товар</button>
      </div>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <tr><th>ID</th><th>Иконка</th><th>Название</th><th>Цена</th><th>Категория</th><th>Статус</th><th>Действия</th></tr>
    `;
    products.forEach(p => {
      const iconInfo = window.Store.getProductIcon(p);
      const thumb = p.image_url
        ? `<img src="${p.image_url}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;">`
        : `<div style="width:32px;height:32px;border-radius:8px;background:${iconInfo.grad};display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.9);">${window.Icons[iconInfo.icon]?window.Icons[iconInfo.icon](16):window.Icons.package(16)}</div>`;
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${thumb}</td>
          <td><div class="truncate" style="max-width:130px;">${p.name}</div></td>
          <td>${p.price} ${p.currency}</td>
          <td>${p.category_name || '—'}</td>
          <td>${p.is_active ? '<span style="color:var(--success)">●</span> Вкл' : '<span style="color:var(--danger)">●</span> Выкл'}</td>
          <td>
            <div class="admin-actions">
              <button class="btn-icon" style="width:28px;height:28px;" onclick='window.Admin.showProductModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>${window.Icons.edit(14)}</button>
              <button class="btn-icon" style="width:28px;height:28px;color:var(--danger);" onclick="window.Admin.deleteProduct(${p.id})">${window.Icons.trash(14)}</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</table></div>';
    content.innerHTML = html;
  },

  async showProductModal(product = null) {
    const catData = await window.App.api('/admin/categories');
    const categories = Array.isArray(catData) ? catData : (catData.categories || []);
    const isNew = !product;
    product = product || { name:'', description:'', short_description:'', price:0, currency:'USDT', category_id: categories[0]?.id, file_content:'', stock:-1, is_active:1, image_url:'' };

    window.App.showModal(isNew ? '➕ Новый товар' : '✏️ Редактировать товар', `
      <div class="form-group">
        <label class="form-label">Название *</label>
        <input type="text" class="form-input" id="admin-prod-name" value="${product.name}" placeholder="Например: Netflix Premium 1 месяц">
      </div>
      <div class="form-group">
        <label class="form-label">Категория</label>
        <select class="form-select" id="admin-prod-category">
          <option value="">— Без категории —</option>
          ${categories.map(c => `<option value="${c.id}" ${c.id === product.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-12">
        <div class="form-group" style="flex:2;">
          <label class="form-label">Цена *</label>
          <input type="number" step="0.01" min="0" class="form-input" id="admin-prod-price" value="${product.price}" placeholder="0.00">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Валюта</label>
          <select class="form-select" id="admin-prod-currency">
            <option value="USDT" ${product.currency==='USDT'?'selected':''}>USDT</option>
            <option value="TON" ${product.currency==='TON'?'selected':''}>TON</option>
            <option value="BTC" ${product.currency==='BTC'?'selected':''}>BTC</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Краткое описание</label>
        <input type="text" class="form-input" id="admin-prod-short" value="${product.short_description||''}" placeholder="Одна строка для карточки товара">
      </div>
      <div class="form-group">
        <label class="form-label">Полное описание</label>
        <textarea class="form-textarea" id="admin-prod-desc" placeholder="Подробное описание товара...">${product.description||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">🔑 Контент (выдается покупателю после оплаты)</label>
        <textarea class="form-textarea" id="admin-prod-content" placeholder="Ключ активации, логин:пароль, ссылка...">${product.file_content||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Остаток (-1 = безлимит)</label>
        <input type="number" class="form-input" id="admin-prod-stock" value="${product.stock !== undefined ? product.stock : -1}">
      </div>
      <div class="form-group">
        <label class="form-label">🖼 URL изображения (необязательно)</label>
        <input type="text" class="form-input" id="admin-prod-image" value="${product.image_url||''}" placeholder="https://... (оставьте пустым для авто-иконки)">
      </div>
      <label class="form-checkbox">
        <input type="checkbox" id="admin-prod-active" ${product.is_active ? 'checked' : ''}>
        Активен (виден в каталоге)
      </label>
    `, `
      <button class="btn btn-secondary" onclick="window.App.closeModal()">Отмена</button>
      <button class="btn btn-primary" onclick="window.Admin.saveProduct(${product.id || 'null'})">💾 Сохранить</button>
    `);
  },

  async saveProduct(id) {
    const data = {
      name: document.getElementById('admin-prod-name').value,
      category_id: parseInt(document.getElementById('admin-prod-category').value),
      price: parseFloat(document.getElementById('admin-prod-price').value),
      currency: document.getElementById('admin-prod-currency').value,
      short_description: document.getElementById('admin-prod-short').value,
      description: document.getElementById('admin-prod-desc').value,
      file_content: document.getElementById('admin-prod-content').value,
      image_url: document.getElementById('admin-prod-image').value,
      stock: parseInt(document.getElementById('admin-prod-stock').value),
      is_active: document.getElementById('admin-prod-active').checked ? 1 : 0
    };

    try {
      await window.App.api(id ? `/admin/products/${id}` : '/admin/products', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      window.App.closeModal();
      window.App.showToast('Сохранено', 'success');
      this.renderProducts(document.getElementById('admin-content'));
    } catch(err) {
      window.App.showToast('Ошибка сохранения', 'error');
    }
  },

  async deleteProduct(id) {
    if(!await window.App.confirm('Удалить товар?')) return;
    try {
      await window.App.api(`/admin/products/${id}`, { method: 'DELETE' });
      window.App.showToast('Удалено', 'success');
      this.renderProducts(document.getElementById('admin-content'));
    } catch(err) {
      window.App.showToast('Ошибка', 'error');
    }
  },

  async renderCategories(content) {
    const data = await window.App.api('/admin/categories');
    const categories = Array.isArray(data) ? data : (data.categories || []);
    let html = `
      <div class="flex-between mb-16">
        <h3 class="section-title m-0" style="margin:0;">Категории</h3>
        <button class="btn btn-sm btn-primary" onclick="window.Admin.showCategoryModal()">+ Категория</button>
      </div>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <tr><th>ID</th><th>Иконка</th><th>Название</th><th>Сорт.</th><th>Действия</th></tr>
    `;
    categories.forEach(c => {
      html += `
        <tr>
          <td>${c.id}</td>
          <td>${window.Icons[c.icon] ? window.Icons[c.icon](16) : window.Icons.package(16)}</td>
          <td>${c.name}</td>
          <td>${c.sort_order}</td>
          <td>
            <div class="admin-actions">
              <button class="btn-icon" style="width:28px;height:28px;" onclick='window.Admin.showCategoryModal(${JSON.stringify(c).replace(/'/g, "&#39;")})'>${window.Icons.edit(14)}</button>
              <button class="btn-icon" style="width:28px;height:28px;color:var(--danger);" onclick="window.Admin.deleteCategory(${c.id})">${window.Icons.trash(14)}</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</table></div>';
    content.innerHTML = html;
  },

  showCategoryModal(cat = null) {
    const isNew = !cat;
    cat = cat || { name:'', icon:'package', description:'', sort_order:0 };
    const icons = Object.keys(window.Icons);
    
    window.App.showModal(isNew ? 'Новая категория' : 'Ред. категорию', `
      <div class="form-group">
        <label class="form-label">Название</label>
        <input type="text" class="form-input" id="admin-cat-name" value="${cat.name}">
      </div>
      <div class="form-group">
        <label class="form-label">Иконка (название из Icons)</label>
        <select class="form-select" id="admin-cat-icon">
          ${icons.map(i => `<option value="${i}" ${i === cat.icon ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Описание</label>
        <input type="text" class="form-input" id="admin-cat-desc" value="${cat.description||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Сортировка (меньше = выше)</label>
        <input type="number" class="form-input" id="admin-cat-sort" value="${cat.sort_order}">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="window.App.closeModal()">Отмена</button>
      <button class="btn btn-primary" onclick="window.Admin.saveCategory(${cat.id || 'null'})">Сохранить</button>
    `);
  },

  async saveCategory(id) {
    const data = {
      name: document.getElementById('admin-cat-name').value,
      icon: document.getElementById('admin-cat-icon').value,
      description: document.getElementById('admin-cat-desc').value,
      sort_order: parseInt(document.getElementById('admin-cat-sort').value) || 0
    };
    try {
      await window.App.api(id ? `/admin/categories/${id}` : '/admin/categories', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      window.App.closeModal();
      window.App.showToast('Сохранено', 'success');
      this.renderCategories(document.getElementById('admin-content'));
    } catch(err) {
      window.App.showToast('Ошибка сохранения', 'error');
    }
  },

  async deleteCategory(id) {
    if(!await window.App.confirm('Удалить категорию?')) return;
    try {
      await window.App.api(`/admin/categories/${id}`, { method: 'DELETE' });
      window.App.showToast('Удалено', 'success');
      this.renderCategories(document.getElementById('admin-content'));
    } catch(err) {
      window.App.showToast('Ошибка', 'error');
    }
  },

  async renderOrders(content) {
    const res = await window.App.api('/admin/orders');
    let html = `
      <h3 class="section-title mb-16">Все заказы</h3>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <tr><th>ID</th><th>Юзер</th><th>Сумма</th><th>Статус</th><th>Действия</th></tr>
    `;
    res.forEach(o => {
      html += `
        <tr>
          <td>#${o.id}</td>
          <td>${o.username ? '@'+o.username : o.first_name}</td>
          <td>${o.total} ${o.currency}</td>
          <td>
            <select class="form-select" style="padding:4px; height:auto;" onchange="window.Admin.updateOrderStatus(${o.id}, this.value)">
              <option value="pending" ${o.status==='pending'?'selected':''}>Pending</option>
              <option value="paid" ${o.status==='paid'?'selected':''}>Paid</option>
              <option value="delivered" ${o.status==='delivered'?'selected':''}>Delivered</option>
              <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelled</option>
              <option value="refunded" ${o.status==='refunded'?'selected':''}>Refunded</option>
            </select>
          </td>
          <td><button class="btn btn-sm btn-secondary" onclick="window.Orders.renderDetail(${o.id})">Детали</button></td>
        </tr>
      `;
    });
    html += '</table></div>';
    content.innerHTML = html;
  },

  async updateOrderStatus(id, status) {
    try {
      await window.App.api(`/admin/orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      window.App.showToast('Статус обновлен', 'success');
    } catch(err) {
      window.App.showToast('Ошибка', 'error');
    }
  },

  async renderPromo(content) {
    const res = await window.App.api('/admin/promo');
    let html = `
      <div class="flex-between mb-16">
        <h3 class="section-title m-0" style="margin:0;">Промокоды</h3>
        <button class="btn btn-sm btn-primary" onclick="window.Admin.showPromoModal()">+ Промо</button>
      </div>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <tr><th>Код</th><th>Скидка</th><th>Исп.</th><th>Макс</th><th>Статус</th><th>Действия</th></tr>
    `;
    res.forEach(p => {
      html += `
        <tr>
          <td><div class="badge">${p.code}</div></td>
          <td>${p.discount_percent}%</td>
          <td>${p.used_count}</td>
          <td>${p.max_uses === -1 ? '∞' : p.max_uses}</td>
          <td>${p.is_active ? 'Вкл' : 'Выкл'}</td>
          <td>
            <div class="admin-actions">
              <button class="btn-icon" style="width:28px;height:28px;" onclick='window.Admin.showPromoModal(${JSON.stringify(p).replace(/'/g, "&#39;")})'>${window.Icons.edit(14)}</button>
              <button class="btn-icon" style="width:28px;height:28px;color:var(--danger);" onclick="window.Admin.deletePromo(${p.id})">${window.Icons.trash(14)}</button>
            </div>
          </td>
        </tr>
      `;
    });
    html += '</table></div>';
    content.innerHTML = html;
  },

  showPromoModal(promo = null) {
    const isNew = !promo;
    promo = promo || { code:'', discount_percent:10, max_uses:-1, is_active:1 };
    
    window.App.showModal(isNew ? 'Новый промокод' : 'Ред. промокод', `
      <div class="form-group">
        <label class="form-label">Код</label>
        <input type="text" class="form-input" id="admin-promo-code" value="${promo.code}">
      </div>
      <div class="form-group">
        <label class="form-label">Скидка %</label>
        <input type="number" class="form-input" id="admin-promo-discount" value="${promo.discount_percent}">
      </div>
      <div class="form-group">
        <label class="form-label">Макс. использований (-1 = безлимит)</label>
        <input type="number" class="form-input" id="admin-promo-max" value="${promo.max_uses}">
      </div>
      <label class="form-checkbox">
        <input type="checkbox" id="admin-promo-active" ${promo.is_active ? 'checked' : ''}>
        Активен
      </label>
    `, `
      <button class="btn btn-secondary" onclick="window.App.closeModal()">Отмена</button>
      <button class="btn btn-primary" onclick="window.Admin.savePromo(${promo.id || 'null'})">Сохранить</button>
    `);
  },

  async savePromo(id) {
    const data = {
      code: document.getElementById('admin-promo-code').value.trim(),
      discount_percent: parseFloat(document.getElementById('admin-promo-discount').value),
      max_uses: parseInt(document.getElementById('admin-promo-max').value),
      is_active: document.getElementById('admin-promo-active').checked ? 1 : 0
    };
    try {
      await window.App.api(id ? `/admin/promo/${id}` : '/admin/promo', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      window.App.closeModal();
      window.App.showToast('Сохранено', 'success');
      this.renderPromo(document.getElementById('admin-content'));
    } catch(err) {
      window.App.showToast('Ошибка', 'error');
    }
  },

  async deletePromo(id) {
    if(!await window.App.confirm('Удалить промокод?')) return;
    try {
      await window.App.api(`/admin/promo/${id}`, { method: 'DELETE' });
      window.App.showToast('Удалено', 'success');
      this.renderPromo(document.getElementById('admin-content'));
    } catch(err) {
      window.App.showToast('Ошибка', 'error');
    }
  },

  async renderUsers(content) {
    const res = await window.App.api('/admin/users');
    let html = `
      <h3 class="section-title mb-16">Пользователи</h3>
      <div class="admin-table-wrapper">
        <table class="admin-table">
          <tr><th>ID</th><th>TG ID</th><th>Username</th><th>Имя</th><th>Роль</th></tr>
    `;
    res.forEach(u => {
      html += `
        <tr>
          <td>${u.id}</td>
          <td>${u.telegram_id}</td>
          <td>${u.username ? '@'+u.username : '-'}</td>
          <td>${u.first_name || ''} ${u.last_name || ''}</td>
          <td>${u.is_admin ? '<div class="badge" style="background:var(--accent);color:var(--bg-dark)">Admin</div>' : 'User'}</td>
        </tr>
      `;
    });
    html += '</table></div>';
    content.innerHTML = html;
  }
};
