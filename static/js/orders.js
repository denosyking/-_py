window.Orders = {
  async render() {
    const container = document.getElementById('view-orders');
    container.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div class="spinner" style="margin:0 auto 16px;"></div>
      </div>
    `;

    try {
      const res = await window.App.api('/orders');
      const orders = res.orders || [];

      if (orders.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            ${window.Icons.package(64)}
            <h3>У вас пока нет заказов</h3>
            <p class="text-muted">Сделайте свой первый заказ в каталоге</p>
            <button class="btn btn-primary mt-16" onclick="window.App.navigate('catalog')">К покупкам</button>
          </div>
        `;
        return;
      }

      const ordersHtml = orders.map(order => {
        const date = new Date(order.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
        const price = window.App.formatPrice(order.total, order.currency);
        
        return `
          <div class="card order-card" onclick="window.Orders.renderDetail(${order.id})">
            <div class="order-header">
              <div>
                <div class="order-id">Заказ #${order.id}</div>
                <div class="order-date">${date}</div>
              </div>
              <div class="order-status status-${order.status}">${this.getStatusText(order.status)}</div>
            </div>
            <div class="order-footer">
              <div class="text-sm text-muted">${order.items_count || 0} товаров</div>
              <div class="price">${price}</div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="orders-list">
          <h2 class="section-title">Мои заказы</h2>
          ${ordersHtml}
        </div>
      `;
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="empty-state">
          ${window.Icons.x(48)}
          <h3>Ошибка загрузки</h3>
          <p class="text-muted">Не удалось загрузить заказы</p>
        </div>
      `;
    }
  },

  async renderDetail(orderId) {
    window.App.navigate('order-detail');
    const container = document.getElementById('view-order-detail');
    container.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div class="spinner" style="margin:0 auto 16px;"></div>
      </div>
    `;

    try {
      const res = await window.App.api(`/orders/${orderId}`);
      const o = res.order;
      const items = res.items || [];
      const date = new Date(o.created_at).toLocaleString('ru-RU');
      const isPaid = o.status === 'paid' || o.status === 'delivered';

      let itemsHtml = items.map(item => {
        const getButton = isPaid 
          ? `<button class="btn btn-sm btn-secondary mt-8" onclick="window.Orders.showProductContent(${item.id})">${window.Icons.download(14)} Получить товар</button>`
          : '';

        return `
          <div class="card" style="margin-bottom:12px; padding:12px;">
            <div class="flex-between">
              <div class="font-weight-600">${item.product_name}</div>
              <div class="price">${window.App.formatPrice(item.price * item.quantity, o.currency)}</div>
            </div>
            <div class="text-sm text-muted mt-4">Количество: ${item.quantity}</div>
            ${getButton}
          </div>
        `;
      }).join('');

      let discountHtml = '';
      if (o.discount_percent > 0) {
        discountHtml = `
          <div class="flex-between mb-8 text-sm">
            <span>Промокод (${o.promo_code})</span>
            <span style="color:var(--success)">-${o.discount_percent}%</span>
          </div>
        `;
      }

      container.innerHTML = `
        <div style="padding:16px;">
          <div class="flex-between mb-24">
            <button class="btn-icon" onclick="window.App.goBack()">${window.Icons.arrowLeft(24)}</button>
            <h2 style="margin:0;">Заказ #${o.id}</h2>
            <div style="width:40px;"></div>
          </div>
          
          <div class="card mb-24">
            <div class="flex-between mb-16">
              <span class="text-muted">Статус</span>
              <span class="order-status status-${o.status}">${this.getStatusText(o.status)}</span>
            </div>
            <div class="flex-between mb-16">
              <span class="text-muted">Дата</span>
              <span>${date}</span>
            </div>
            ${o.paid_at ? `
            <div class="flex-between mb-16">
              <span class="text-muted">Оплачен</span>
              <span>${new Date(o.paid_at).toLocaleString('ru-RU')}</span>
            </div>
            ` : ''}
            <div class="divider mb-16"></div>
            ${discountHtml}
            <div class="flex-between" style="font-size:18px; font-weight:700;">
              <span>Итого</span>
              <span>${window.App.formatPrice(o.total, o.currency)}</span>
            </div>
          </div>
          
          <h3 class="section-title text-sm text-muted text-uppercase mb-12">Товары</h3>
          ${itemsHtml}
          
          ${o.status === 'pending' ? `
            <div class="mt-24">
              <button class="btn btn-primary btn-block btn-lg" onclick="window.App.showToast('Используйте ссылку из бота для оплаты', 'info')">Перейти к оплате</button>
            </div>
          ` : ''}
        </div>
      `;
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="empty-state">
          ${window.Icons.x(48)}
          <h3>Ошибка</h3>
          <p class="text-muted">Не удалось загрузить детали заказа</p>
          <button class="btn btn-secondary mt-16" onclick="window.App.goBack()">Назад</button>
        </div>
      `;
    }
  },

  async showProductContent(itemId) {
    try {
      window.App.showToast('Загрузка контента...', 'info');
      const orderId = parseInt(document.querySelector('h2').innerText.replace('Заказ #', ''));
      const res = await window.App.api(`/orders/${orderId}`);
      const item = res.items.find(i => i.id === itemId);
      
      if (item && item.file_content) {
        window.App.showModal('Ваш товар', `
          <p class="text-muted mb-16">Данные от ${item.product_name}:</p>
          <div class="form-group">
            <textarea class="form-textarea" readonly style="font-family:monospace; font-size:12px; height:150px;">${item.file_content}</textarea>
          </div>
        `, `
          <button class="btn btn-primary" onclick="navigator.clipboard.writeText(\`${item.file_content.replace(/`/g, '\\`')}\`); window.App.showToast('Скопировано!', 'success'); window.App.closeModal();">Скопировать</button>
        `);
      } else {
        window.App.showToast('Контент не найден', 'error');
      }
    } catch (err) {
      console.error(err);
      window.App.showToast('Ошибка получения контента', 'error');
    }
  },

  getStatusText(status) {
    const m = {
      pending: 'Ожидает оплаты',
      paid: 'Оплачен',
      delivered: 'Доставлен',
      cancelled: 'Отменён',
      refunded: 'Возвращён'
    };
    return m[status] || status;
  }
};
