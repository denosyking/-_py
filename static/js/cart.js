window.Cart = {
  items: [],
  total: 0,
  count: 0,
  promoCode: null,
  discountPercent: 0,

  async load() {
    try {
      const res = await window.App.api('/cart');
      this.items = res.items;
      this.total = res.total;
      this.count = res.count;
      this.updateBadge();
    } catch (err) {
      console.error('Error loading cart', err);
    }
  },

  async render() {
    const container = document.getElementById('view-cart');
    
    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${window.Icons.shoppingBag(64)}
          <h3>Корзина пуста</h3>
          <p class="text-muted">Добавьте товары из каталога</p>
          <button class="btn btn-primary mt-16" onclick="window.App.navigate('catalog')">В каталог</button>
        </div>
      `;
      return;
    }

    let itemsHtml = this.items.map(item => {
      const p = item.product;
      const priceFormatted = window.App.formatPrice(p.price, p.currency);
      const iconInfo = window.Store.getProductIcon(p);
      const iconName = iconInfo.icon;
      const imageHtml = p.image_url 
        ? `<img src="${p.image_url}" class="cart-item-image">` 
        : `<div class="cart-item-image" style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);color:#fff;">${window.Icons[iconName] ? window.Icons[iconName](28) : window.Icons.package(28)}</div>`;

      return `
        <div class="cart-item">
          ${imageHtml}
          <div class="cart-item-info">
            <div>
              <div class="cart-item-title truncate">${p.name}</div>
              <div class="cart-item-price">${priceFormatted}</div>
            </div>
            <div class="flex-between mt-8">
              <div class="quantity-control">
                <button class="quantity-btn" onclick="window.Cart.updateQuantity(${p.id}, ${item.quantity - 1})">${window.Icons.minus(14)}</button>
                <div class="quantity-val">${item.quantity}</div>
                <button class="quantity-btn" onclick="window.Cart.updateQuantity(${p.id}, ${item.quantity + 1})">${window.Icons.plus(14)}</button>
              </div>
              <button class="btn-icon" style="width:32px;height:32px;color:var(--danger);" onclick="window.Cart.removeItem(${p.id})">
                ${window.Icons.trash(16)}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    let discountHtml = '';
    let finalTotal = this.total;
    if (this.discountPercent > 0) {
      const discountAmount = (this.total * this.discountPercent / 100);
      finalTotal = this.total - discountAmount;
      discountHtml = `
        <div class="summary-row" style="color:var(--success)">
          <span>Скидка (${this.discountPercent}%)</span>
          <span>-${window.App.formatPrice(discountAmount, 'USDT')}</span>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="cart-list">
        <div class="flex-between mb-16">
          <h2 class="section-title" style="margin:0;">Корзина</h2>
          <button class="btn btn-sm btn-secondary" onclick="window.Cart.clearCart()">Очистить</button>
        </div>
        ${itemsHtml}
      </div>
      <div class="cart-summary">
        <div class="promo-input">
          <input type="text" id="promo-code-input" class="form-input" placeholder="Промокод" value="${this.promoCode || ''}">
          <button class="btn btn-secondary" onclick="window.Cart.applyPromo()">Применить</button>
        </div>
        <div class="summary-row">
          <span>Товары (${this.count})</span>
          <span>${window.App.formatPrice(this.total, 'USDT')}</span>
        </div>
        ${discountHtml}
        <div class="summary-row total">
          <span>К оплате</span>
          <span>${window.App.formatPrice(finalTotal, 'USDT')}</span>
        </div>
        <button class="btn btn-primary btn-block btn-lg" onclick="window.Cart.checkout()">Оформить заказ</button>
      </div>
    `;
  },

  async addItem(productId, checkoutRedirect = false) {
    try {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
      
      const res = await window.App.api('/cart/add', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId })
      });
      
      if (res.success) {
        await this.load();
        if (checkoutRedirect) {
          window.App.navigate('cart');
        } else {
          window.App.showToast('Добавлено в корзину', 'success');
        }
      }
    } catch (err) {
      console.error(err);
      window.App.showToast('Ошибка при добавлении', 'error');
    }
  },

  async removeItem(productId) {
    try {
      await window.App.api('/cart/remove', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId })
      });
      await this.load();
      if (document.getElementById('view-cart').classList.contains('active')) {
        this.render();
      }
    } catch (err) {
      console.error(err);
    }
  },

  async updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      return this.removeItem(productId);
    }
    try {
      await window.App.api('/cart/update', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity })
      });
      await this.load();
      this.render();
    } catch (err) {
      console.error(err);
    }
  },

  async clearCart() {
    const ok = await window.App.confirm('Очистить корзину?');
    if (!ok) return;
    try {
      await window.App.api('/cart/clear', { method: 'POST' });
      this.promoCode = null;
      this.discountPercent = 0;
      await this.load();
      this.render();
    } catch (err) {
      console.error(err);
    }
  },

  async applyPromo() {
    const code = document.getElementById('promo-code-input').value.trim();
    if (!code) return;
    try {
      const res = await window.App.api('/promo/check', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      if (res.valid) {
        this.promoCode = code;
        this.discountPercent = res.discount_percent;
        window.App.showToast('Промокод применен!', 'success');
        this.render();
      } else {
        window.App.showToast(res.message || 'Недействительный промокод', 'error');
        this.promoCode = null;
        this.discountPercent = 0;
        this.render();
      }
    } catch (err) {
      console.error(err);
      window.App.showToast('Ошибка проверки промокода', 'error');
    }
  },

  async checkout() {
    if (this.items.length === 0) return;
    
    try {
      window.App.showToast('Создаем счет...', 'info');
      const res = await window.App.api('/payment/create', {
        method: 'POST',
        body: JSON.stringify({ promo_code: this.promoCode })
      });
      
      if (res.invoice_url) {
        if (window.Telegram?.WebApp) {
          if (res.invoice_url.includes('t.me')) {
            window.Telegram.WebApp.openTelegramLink(res.invoice_url);
          } else {
            window.Telegram.WebApp.openLink(res.invoice_url);
          }
        } else {
          window.open(res.invoice_url, '_blank');
        }
        window.App.showToast('Заказ создан! Оплатите счет в CryptoBot', 'success');
        this.promoCode = null;
        this.discountPercent = 0;
        await this.load();
        window.App.navigate('orders');
      }
    } catch (err) {
      console.error(err);
      window.App.showToast('Ошибка при создании заказа', 'error');
    }
  },

  updateBadge() {
    const navItem = document.querySelector(`.bottom-nav-item[onclick="App.navigate('cart')"]`);
    if (!navItem) return;
    
    let badge = navItem.querySelector('.nav-badge');
    if (this.count > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'nav-badge';
        navItem.appendChild(badge);
      }
      badge.innerText = this.count > 99 ? '99+' : this.count;
    } else if (badge) {
      badge.remove();
    }
  }
};
