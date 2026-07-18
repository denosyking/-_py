window.Store = {
  currentCategory: null,
  searchQuery: '',
  currentPage: 1,
  isLoading: false,
  hasMore: true,

  init() {
    this.renderCatalog();
    this.setupScrollListener();
  },

  renderCatalog() {
    const container = document.getElementById('view-catalog');
    const categoriesContainer = document.getElementById('categories-container');
    const productsContainer = document.getElementById('products-container');
    
    // Categories
    categoriesContainer.innerHTML = '';
    
    // "All" chip
    const allChip = document.createElement('div');
    allChip.className = `category-chip ${!this.currentCategory ? 'active' : ''}`;
    allChip.innerHTML = `${window.Icons.package(16)} Все`;
    allChip.onclick = () => this.selectCategory(null);
    categoriesContainer.appendChild(allChip);
    
    // Other chips
    (window.App.categories || []).forEach(cat => {
      const chip = document.createElement('div');
      chip.className = `category-chip ${this.currentCategory === cat.id ? 'active' : ''}`;
      chip.innerHTML = `${window.Icons[cat.icon] ? window.Icons[cat.icon](16) : window.Icons.package(16)} ${cat.name}`;
      chip.onclick = () => this.selectCategory(cat.id);
      categoriesContainer.appendChild(chip);
    });

    productsContainer.innerHTML = '';
    this.currentPage = 1;
    this.hasMore = true;
    this.loadProducts(true);
  },

  async loadProducts(clear = false) {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;
    
    try {
      let url = `/products?page=${this.currentPage}&limit=12`;
      if (this.currentCategory) url += `&category_id=${this.currentCategory}`;
      if (this.searchQuery) url += `&search=${encodeURIComponent(this.searchQuery)}`;
      
      const res = await window.App.api(url);
      const container = document.getElementById('products-container');
      
      if (clear) container.innerHTML = '';
      
      if (res.products.length === 0 && clear) {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">
          ${window.Icons.search(48)}
          <h3>Ничего не найдено</h3>
          <p class="text-muted">Попробуйте изменить поисковой запрос</p>
        </div>`;
      } else {
        res.products.forEach(p => {
          container.insertAdjacentHTML('beforeend', this.renderProductCard(p));
        });
      }
      
      if (res.page >= res.pages) {
        this.hasMore = false;
      } else {
        this.currentPage++;
      }
    } catch (err) {
      console.error(err);
      window.App.showToast('Ошибка загрузки товаров', 'error');
    } finally {
      this.isLoading = false;
    }
  },

  getProductIcon(product) {
    const name = (product.name || '').toLowerCase();
    const cat = (product.category_name || '').toLowerCase();
    
    // Map keywords to icons and gradients
    const rules = [
      { keys: ['netflix','кино','фильм','movie','cinema','hulu','disney','spotify','music','музык'], icon: 'zap', grad: 'linear-gradient(135deg,#e50914,#b20710)' },
      { keys: ['vpn','proxy','прокс','защит','антивир','shield','nord','secure'], icon: 'shield', grad: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
      { keys: ['game','игр','steam','xbox','playstation','ps4','ps5','minecraft','roblox'], icon: 'zap', grad: 'linear-gradient(135deg,#667eea,#764ba2)' },
      { keys: ['курс','course','обучен','learn','книг','book','програм','dev','код','python','js'], icon: 'book', grad: 'linear-gradient(135deg,#f093fb,#f5576c)' },
      { keys: ['аккаунт','account','подписк','premium','plus','pro','vip','prime'], icon: 'crown', grad: 'linear-gradient(135deg,#ffd700,#ff8c00)' },
      { keys: ['ключ','key','лицензи','license','активац','serial','код'], icon: 'key', grad: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
      { keys: ['telegram','tg','бот','bot'], icon: 'externalLink', grad: 'linear-gradient(135deg,#2aabee,#229ed9)' },
      { keys: ['дизайн','design','figma','adobe','photoshop','graphic'], icon: 'image', grad: 'linear-gradient(135deg,#fa709a,#fee140)' },
      { keys: ['деньги','money','крипт','crypto','биткоин','bitcoin','usdt','ton'], icon: 'creditCard', grad: 'linear-gradient(135deg,#11998e,#38ef7d)' },
      { keys: ['антидет','браузер','browser','парс','автом'], icon: 'code', grad: 'linear-gradient(135deg,#30cfd0,#330867)' },
    ];
    
    for (const rule of rules) {
      if (rule.keys.some(k => name.includes(k) || cat.includes(k))) {
        return { icon: rule.icon, grad: rule.grad };
      }
    }
    // Default
    return { icon: 'package', grad: 'linear-gradient(135deg,#373B44,#4286f4)' };
  },

  renderProductCard(product) {
    const priceFormatted = window.App.formatPrice(product.price, product.currency);
    const oldPriceFormatted = product.price > 5 ? window.App.formatPrice(product.price * 1.3, product.currency) : ''; // Simulated old price for aesthetics
    
    const iconInfo = this.getProductIcon(product);
    const iconName = iconInfo.icon;
    
    const badgeText = product.sales_count > 10 ? 'ХИТ' : '';
    const badgeHtml = badgeText ? `<div class="product-badge">${badgeText}</div>` : '';
    
    // Delivery text logic
    const deliveryText = product.stock > 0 
      ? `в наличии: ${product.stock}` 
      : (product.stock === -1 ? '∞ моментальная выдача' : 'нет в наличии');

    return `
      <div class="product-card" onclick="window.Store.renderProductDetail(${product.id})">
        <div class="product-card-header">
          <div class="product-icon-box">
            ${window.Icons[iconName] ? window.Icons[iconName](22) : window.Icons.package(22)}
          </div>
          ${badgeHtml}
        </div>
        
        <div class="product-info-compact">
          <div class="product-title line-clamp-2">${product.name}</div>
          <div class="product-subtitle line-clamp-2">${product.short_description || product.category_name || 'Автоматическая выдача'}</div>
        </div>
        
        <div class="product-price-row-compact">
          <div class="product-price">${priceFormatted}</div>
          ${oldPriceFormatted ? `<div class="price-old">${oldPriceFormatted}</div>` : ''}
        </div>
        
        <div class="product-footer">
          ${deliveryText}
        </div>
      </div>
    `;
  },

  async renderProductDetail(id) {
    window.App.navigate('product-detail');
    const container = document.getElementById('view-product-detail');
    container.innerHTML = `
      <div style="padding:40px;text-align:center;">
        <div class="spinner" style="margin:0 auto 16px;"></div>
        <div class="text-muted">Загрузка товара...</div>
      </div>
    `;
    
    try {
      const res = await window.App.api(`/products/${id}`);
      const p = res.product;
      const reviews = res.reviews || [];
      const priceFormatted = window.App.formatPrice(p.price, p.currency);
      
      const iconInfo = this.getProductIcon(p);
      const iconName = iconInfo.icon;
      
      const imageHtml = p.image_url 
        ? `<img src="${p.image_url}">` 
        : `<div style="width:100%;height:100%;background:rgba(255,255,255,0.02);display:flex;align-items:center;justify-content:center;color:#fff;">
             ${window.Icons[iconName] ? window.Icons[iconName](80) : window.Icons.package(80)}
           </div>`;

      let ratingHtml = '';
      if (res.review_count > 0) {
        ratingHtml = `<div class="flex" style="gap:8px; align-items:center; margin-top:8px;">
          <div class="rating-stars">
            ${[1,2,3,4,5].map(i => `<div class="rating-star ${i <= Math.round(res.avg_rating) ? 'filled' : ''}">${i <= Math.round(res.avg_rating) ? window.Icons.starFilled(16) : window.Icons.star(16)}</div>`).join('')}
          </div>
          <div class="text-sm text-muted">${res.avg_rating.toFixed(1)} (${res.review_count} отзывов)</div>
        </div>`;
      }

      let reviewsHtml = '';
      if (reviews.length > 0) {
        reviewsHtml = `
          <div class="mt-24">
            <h3 class="section-title">Отзывы</h3>
            <div class="flex-col gap-12">
              ${reviews.map(r => `
                <div class="card p-16" style="padding:12px;">
                  <div class="flex-between mb-8">
                    <div class="font-weight-600">${r.first_name || r.username || 'Покупатель'}</div>
                    <div class="rating-stars">
                      ${[1,2,3,4,5].map(i => `<div class="rating-star ${i <= r.rating ? 'filled' : ''}">${i <= r.rating ? window.Icons.starFilled(12) : window.Icons.star(12)}</div>`).join('')}
                    </div>
                  </div>
                  <div class="text-sm text-secondary">${r.comment || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        <div class="product-detail-hero">
          <button class="btn-icon" style="position:absolute;top:16px;left:16px;z-index:10;background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);" onclick="window.App.goBack()">
            ${window.Icons.arrowLeft(24)}
          </button>
          ${imageHtml}
        </div>
        <div class="product-detail-content">
          <div class="product-category">${p.category_name || 'Товар'}</div>
          <h2 style="font-size:24px; font-weight:800; margin-top:4px; line-height:1.2;">${p.name}</h2>
          ${ratingHtml}
          
          <div class="product-detail-description">
            ${(p.description || p.short_description || 'Нет описания.').replace(/\n/g, '<br>')}
          </div>
          
          ${reviewsHtml}
        </div>
        
        <div class="product-detail-buy">
          <div style="flex-grow:1;">
            <div class="text-xs text-muted text-uppercase">Итого</div>
            <div class="price" style="font-size:20px;">${priceFormatted}</div>
          </div>
          <button class="btn btn-primary" style="flex-grow:2;" onclick="window.Cart.addItem(${p.id}, true)">
            ${window.Icons.cart(20)} В корзину
          </button>
        </div>
      `;
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="empty-state">
          ${window.Icons.x(48)}
          <h3>Ошибка</h3>
          <p class="text-muted">Не удалось загрузить товар</p>
          <button class="btn btn-secondary mt-16" onclick="window.App.goBack()">Назад</button>
        </div>
      `;
    }
  },

  selectCategory(id) {
    this.currentCategory = id;
    this.renderCatalog();
  },

  search(query) {
    this.searchQuery = query;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.hasMore = true;
      this.loadProducts(true);
    }, 300);
  },

  setupScrollListener() {
    document.getElementById('view-catalog').addEventListener('scroll', (e) => {
      const el = e.target;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
        this.loadProducts();
      }
    });
  }
};
