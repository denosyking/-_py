window.App = {
  user: null,
  categories: [],
  featured: [],
  history: ['catalog'],
  currentView: 'catalog',

  async init() {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.setHeaderColor('#050505');
      window.Telegram.WebApp.setBackgroundColor('#050505');
      
      window.Telegram.WebApp.BackButton.onClick(() => {
        this.goBack();
      });
    }

    try {
      const initData = await this.api('/init');
      this.user = initData.user;
      this.categories = initData.categories;
      this.featured = initData.featured;
      window.Cart.count = initData.cart_count || 0;
      
      document.getElementById('loading-screen').style.opacity = '0';
      setTimeout(() => document.getElementById('loading-screen').style.display = 'none', 300);

      this.renderNavigation();
      window.Store.init();
      window.Cart.updateBadge();
      
      // Init profile view
      this.renderProfile();
      
    } catch (err) {
      console.error('Init error:', err);
      document.getElementById('loading-screen').innerHTML = `
        <div class="empty-state">
          ${window.Icons.x(48)}
          <h3>Ошибка подключения</h3>
          <p class="text-muted" style="color:red; font-size:12px; margin-top:8px">${err.message || String(err)}</p>
        </div>
      `;
    }
    
    // Header icons
    document.getElementById('icon-back').innerHTML = window.Icons.arrowLeft(24);
    document.getElementById('search-toggle').innerHTML = window.Icons.search(24);
    document.getElementById('icon-search-bar').innerHTML = window.Icons.search(18);
    document.getElementById('icon-modal-close').innerHTML = window.Icons.x(24);
    
    document.getElementById('search-input').addEventListener('input', (e) => {
      window.Store.search(e.target.value);
    });
  },

  async api(url, options = {}) {
    const headers = { 
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true' // Bypass localtunnel warning page
    };
    if (window.Telegram?.WebApp?.initData) {
      headers['Authorization'] = 'tma ' + window.Telegram.WebApp.initData;
    }

    
    // Mock for testing without telegram
    if (!window.Telegram?.WebApp?.initData && window.location.hostname === 'localhost') {
      // Handled by backend development mode
    }

    const res = await fetch('/api' + url, {
      ...options,
      headers: { ...headers, ...options.headers }
    });
    
    if (!res.ok) {
      let msg = 'API Error';
      try { const err = await res.json(); msg = err.error || msg; } catch(e){}
      throw new Error(msg);
    }
    return res.json();
  },

  navigate(viewName) {
    if (this.currentView !== viewName) {
      if (!['product-detail', 'order-detail'].includes(viewName)) {
        this.history = [viewName]; // Reset history on root navigation
      } else {
        this.history.push(viewName);
      }
    }
    
    this.currentView = viewName;
    
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show target view
    const viewEl = document.getElementById(`view-${viewName}`);
    if (viewEl) viewEl.classList.add('active');
    
    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    const rootNav = ['catalog', 'cart', 'orders', 'profile', 'admin'].includes(viewName) ? viewName : this.history[0];
    const navItem = document.querySelector(`.bottom-nav-item[onclick="App.navigate('${rootNav}')"]`);
    if (navItem) navItem.classList.add('active');
    
    // Header back button
    const hasBack = this.history.length > 1;
    document.getElementById('header-back').style.display = hasBack ? 'block' : 'none';
    
    if (window.Telegram?.WebApp) {
      if (hasBack) {
        window.Telegram.WebApp.BackButton.show();
      } else {
        window.Telegram.WebApp.BackButton.hide();
      }
    }
    
    // Set title
    const titles = { catalog: 'Digital Store', cart: 'Корзина', orders: 'Заказы', profile: 'Профиль', admin: 'Админ Панель', 'product-detail': 'Товар', 'order-detail': 'Заказ' };
    document.getElementById('header-title').innerText = titles[viewName] || 'Digital Store';

    // Search bar logic
    if (viewName === 'catalog') {
      document.getElementById('search-toggle').style.display = 'flex';
    } else {
      document.getElementById('search-toggle').style.display = 'none';
    }

    // Load data
    if (viewName === 'cart') window.Cart.load().then(() => window.Cart.render());
    if (viewName === 'orders') window.Orders.render();
    if (viewName === 'admin') window.Admin.render();
    if (viewName === 'profile') this.renderProfile();
  },

  goBack() {
    if (this.history.length > 1) {
      this.history.pop();
      const prev = this.history.pop(); // Pop again because navigate will push it back
      this.navigate(prev);
    }
  },

  renderNavigation() {
    const nav = document.getElementById('bottom-nav');
    nav.innerHTML = `
      <a href="javascript:void(0)" class="bottom-nav-item active" onclick="App.navigate('catalog')">
        ${window.Icons.home(22)}
        <span>Каталог</span>
      </a>
      <a href="javascript:void(0)" class="bottom-nav-item" onclick="App.navigate('cart')">
        ${window.Icons.shoppingBag(22)}
        <span>Корзина</span>
      </a>
      <a href="javascript:void(0)" class="bottom-nav-item" onclick="App.navigate('orders')">
        ${window.Icons.package(22)}
        <span>Заказы</span>
      </a>
      <a href="javascript:void(0)" class="bottom-nav-item" onclick="App.navigate('profile')">
        ${window.Icons.user(22)}
        <span>Профиль</span>
      </a>
    `;

    if (this.user && this.user.is_admin) {
      nav.innerHTML += `
        <a href="javascript:void(0)" class="bottom-nav-item" onclick="App.navigate('admin')">
          ${window.Icons.shield(22)}
          <span>Админ</span>
        </a>
      `;
    }
  },

  toggleSearch() {
    const sb = document.getElementById('catalog-search-bar');
    if (sb.style.display === 'none') {
      sb.style.display = 'flex';
      document.getElementById('search-input').focus();
    } else {
      sb.style.display = 'none';
      document.getElementById('search-input').value = '';
      window.Store.search('');
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = window.Icons.info;
    if (type === 'success') icon = window.Icons.check;
    if (type === 'error') icon = window.Icons.x;
    
    toast.innerHTML = `${icon ? icon(20) : ''} <span>${message}</span>`;
    container.appendChild(toast);
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      if (type === 'error') window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
    }

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  showModal(title, contentHtml, footerHtml) {
    return new Promise(resolve => {
      document.getElementById('modal-title').innerText = title;
      document.getElementById('modal-body').innerHTML = contentHtml;
      document.getElementById('modal-footer').innerHTML = footerHtml;
      
      const overlay = document.getElementById('modal-overlay');
      overlay.classList.add('active');
      this._modalResolve = resolve;
    });
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    setTimeout(() => {
      document.getElementById('modal-body').innerHTML = '';
      document.getElementById('modal-footer').innerHTML = '';
      if (this._modalResolve) {
        this._modalResolve(null);
        this._modalResolve = null;
      }
    }, 300);
  },

  confirm(message) {
    return new Promise(resolve => {
      if (window.Telegram?.WebApp?.showConfirm) {
        window.Telegram.WebApp.showConfirm(message, (ok) => resolve(ok));
      } else {
        const ok = window.confirm(message);
        resolve(ok);
      }
    });
  },

  formatPrice(amount, currency = 'USDT') {
    if (currency === 'USDT') return `$${Number(amount).toFixed(2)}`;
    if (currency === 'TON') return `${Number(amount).toFixed(2)} TON`;
    return `${amount} ${currency}`;
  },

  renderProfile() {
    const container = document.getElementById('view-profile');
    if (!this.user) return;
    
    const initial = (this.user.first_name || this.user.username || 'U').charAt(0).toUpperCase();
    const name = this.user.first_name ? `${this.user.first_name} ${this.user.last_name || ''}` : `@${this.user.username}`;
    
    container.innerHTML = `
      <div style="padding:24px 16px;">
        <div class="card flex-col flex-center" style="padding:32px 16px; margin-bottom:24px;">
          <div style="width:80px;height:80px;border-radius:40px;background:var(--accent);color:var(--bg-dark);font-size:32px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
            ${initial}
          </div>
          <h2 style="margin:0 0 4px 0; font-size:20px;">${name}</h2>
          <div class="text-muted">ID: ${this.user.telegram_id}</div>
        </div>
        
        <div class="card p-16 mb-24">
          <div class="flex-between mb-16">
            <span class="text-muted">Роль</span>
            <span>${this.user.is_admin ? 'Администратор' : 'Покупатель'}</span>
          </div>
          <div class="flex-between">
            <span class="text-muted">Регистрация</span>
            <span>${new Date(this.user.created_at || Date.now()).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>
        
        <button class="btn btn-secondary btn-block btn-lg" onclick="window.Telegram?.WebApp?.openTelegramLink('https://t.me/denis_jj')">
          ${window.Icons.messageCircle ? window.Icons.messageCircle(20) : window.Icons.user(20)}
          Связаться с поддержкой
        </button>
      </div>
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
