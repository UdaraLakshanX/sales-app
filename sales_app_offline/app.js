// ============================================================
// app.js - Offline Sales & Credit Manager PWA Engine
// State Management via localStorage: sc_shops, sc_products, sc_sales, sc_payments
// ============================================================

const STORAGE_KEYS = {
    SHOPS: 'sc_shops',
    PRODUCTS: 'sc_products',
    SALES: 'sc_sales',
    PAYMENTS: 'sc_payments'
};

// ------------------------------------------------------------
// 1. Service Worker Registration & Offline Detection
// ------------------------------------------------------------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
            .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
    });
}

function updateOnlineStatus() {
    const badge = document.getElementById('pwa-status-badge');
    if (!badge) return;
    if (navigator.onLine) {
        badge.className = 'hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> Offline Ready';
    } else {
        badge.className = 'hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-400 border border-amber-800';
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span> Offline Mode';
    }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ------------------------------------------------------------
// 2. Local Storage Helpers & Initial Demo Data Seeding
// ------------------------------------------------------------
function getStorage(key, fallback = []) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.error('Storage Read Error:', e);
        return fallback;
    }
}

function setStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Storage Write Error:', e);
        showToast('Storage write failed. Storage might be full.', 'error');
    }
}

function seedInitialDataIfEmpty() {
    if (!localStorage.getItem(STORAGE_KEYS.SHOPS) || JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOPS)).length === 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        const initialShops = [
            { id: 1, shop_name: 'Perera Stores', owner_name: 'Sunil Perera', phone: '0771234567', route: 'Colombo Route 1', total_due: 1500.00, created_at: yesterday },
            { id: 2, shop_name: 'Nimal Super Centre', owner_name: 'Nimal Jayasinghe', phone: '0719876543', route: 'Kandy Road', total_due: 3200.00, created_at: yesterday },
            { id: 3, shop_name: 'City Mart Express', owner_name: 'Priyantha Silva', phone: '0765554433', route: 'Negombo Coast', total_due: 0.00, created_at: todayStr }
        ];

        const initialProducts = [
            { id: 1, product_name: 'Anchor Milk Powder 400g', cost_price: 1050.00, selling_price: 1200.00, stock_qty: 4, created_at: yesterday },
            { id: 2, product_name: 'Munchee Cream Cracker 500g', cost_price: 380.00, selling_price: 450.00, stock_qty: 24, created_at: yesterday },
            { id: 3, product_name: 'Sunlight Soap 120g', cost_price: 130.00, selling_price: 160.00, stock_qty: 40, created_at: yesterday },
            { id: 4, product_name: 'Watawala Tea 200g', cost_price: 420.00, selling_price: 490.00, stock_qty: 3, created_at: yesterday }
        ];

        const initialSales = [
            { id: 1, shop_id: 1, product_id: 1, qty: 2, total_amount: 2400.00, paid_amount: 400.00, due_date: todayStr, sale_date: todayStr + ' 10:30:00' },
            { id: 2, shop_id: 2, product_id: 2, qty: 10, total_amount: 4500.00, paid_amount: 1300.00, due_date: yesterday, sale_date: yesterday + ' 14:15:00' }
        ];

        const initialPayments = [
            { id: 1, shop_id: 1, amount: 500.00, note: 'Cash collected by driver', payment_date: todayStr + ' 11:45:00' }
        ];

        setStorage(STORAGE_KEYS.SHOPS, initialShops);
        setStorage(STORAGE_KEYS.PRODUCTS, initialProducts);
        setStorage(STORAGE_KEYS.SALES, initialSales);
        setStorage(STORAGE_KEYS.PAYMENTS, initialPayments);
        console.log('[PWA] Seeded demo data in localStorage');
    }
}

// ------------------------------------------------------------
// 3. Formatting Utilities
// ------------------------------------------------------------
function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return 'Rs. ' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhatsAppPhone(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
        return '94' + digits.substring(1);
    }
    if (digits.length === 9) {
        return '94' + digits;
    }
    return digits;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}

function isDateToday(dateStr) {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr.startsWith(today);
}

// ------------------------------------------------------------
// 4. Toast Notification System
// ------------------------------------------------------------
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const isError = (type === 'error');
    toast.className = `p-4 rounded-xl shadow-lg border text-sm font-semibold flex items-center space-x-3 transition-all duration-300 transform translate-y-2 pointer-events-auto ${
        isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    }`;

    toast.innerHTML = `
        <i class="fa-solid ${isError ? 'fa-circle-exclamation text-rose-500' : 'fa-circle-check text-emerald-500'} text-lg"></i>
        <div class="flex-1">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'scale-95');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ------------------------------------------------------------
// 5. Tab / View Navigation
// ------------------------------------------------------------
let currentTab = 'dashboard';

function switchTab(tabName) {
    currentTab = tabName;

    // Hide all view sections
    document.querySelectorAll('.tab-view').forEach((sec) => sec.classList.add('hidden'));

    // Show active view
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    // Update Desktop Nav styles
    document.querySelectorAll('.tab-link').forEach((link) => {
        const navTarget = link.getAttribute('data-tab-nav');
        if (navTarget === tabName) {
            link.className = 'tab-link px-3 py-2 rounded-lg text-sm font-semibold transition bg-slate-800 text-indigo-400';
        } else {
            link.className = 'tab-link px-3 py-2 rounded-lg text-sm font-medium transition text-slate-300 hover:bg-slate-800 hover:text-white';
        }
    });

    // Update Mobile Bottom Nav styles
    document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
        const navTarget = btn.getAttribute('data-tab-bottom');
        if (navTarget === tabName) {
            btn.className = 'bottom-nav-btn flex flex-col items-center justify-center text-indigo-400 py-1 px-2 text-xs font-semibold focus:outline-none transition';
        } else {
            btn.className = 'bottom-nav-btn flex flex-col items-center justify-center text-slate-400 hover:text-slate-200 py-1 px-2 text-xs font-medium focus:outline-none transition';
        }
    });

    // Render corresponding view data
    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'shops') renderShops();
    if (tabName === 'products') renderProducts();
    if (tabName === 'new-sale') renderNewSaleView();
    if (tabName === 'payments') renderPaymentsView();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------------------------------------------------------------
// 6. View Renderers
// ------------------------------------------------------------

// A. RENDER DASHBOARD
function renderDashboard() {
    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const sales = getStorage(STORAGE_KEYS.SALES);
    const payments = getStorage(STORAGE_KEYS.PAYMENTS);

    // 1. Today's Sales
    let todaySales = 0;
    let salesCashToday = 0;
    sales.forEach((s) => {
        if (isDateToday(s.sale_date)) {
            todaySales += parseFloat(s.total_amount) || 0;
            salesCashToday += parseFloat(s.paid_amount) || 0;
        }
    });

    // 2. Cash Collected Today
    let paymentsCashToday = 0;
    payments.forEach((p) => {
        if (isDateToday(p.payment_date)) {
            paymentsCashToday += parseFloat(p.amount) || 0;
        }
    });
    const cashCollectedToday = salesCashToday + paymentsCashToday;

    // 3. Total Receivable
    let totalReceivable = 0;
    shops.forEach((sh) => {
        totalReceivable += parseFloat(sh.total_due) || 0;
    });

    // 4. Due Today / Overdue count & reminders list
    const today = new Date().toISOString().split('T')[0];
    const dueShopsMap = {};

    sales.forEach((s) => {
        const shop = shops.find((sh) => sh.id === s.shop_id);
        if (shop && shop.total_due > 0 && s.due_date && s.due_date <= today) {
            if (!dueShopsMap[shop.id] || s.due_date < dueShopsMap[shop.id].earliestDueDate) {
                dueShopsMap[shop.id] = {
                    shop: shop,
                    earliestDueDate: s.due_date
                };
            }
        }
    });

    const dueShopsList = Object.values(dueShopsMap);

    // Set Dashboard Summary Values
    document.getElementById('dash-today-sales').textContent = formatCurrency(todaySales);
    document.getElementById('dash-today-cash').textContent = formatCurrency(cashCollectedToday);
    document.getElementById('dash-total-receivable').textContent = formatCurrency(totalReceivable);
    document.getElementById('dash-due-count').textContent = `${dueShopsList.length} Shops`;

    // Render Payment Reminders
    const remindersContainer = document.getElementById('dash-reminders-list');
    const remindersBadge = document.getElementById('dash-reminders-badge');
    remindersBadge.textContent = `${dueShopsList.length} pending`;

    if (dueShopsList.length === 0) {
        remindersContainer.innerHTML = `
            <div class="p-8 text-center text-slate-400">
                <div class="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i class="fa-solid fa-check text-lg"></i>
                </div>
                <p class="text-sm font-semibold text-slate-700">No Overdue Credit Dues</p>
                <p class="text-xs text-slate-400 mt-0.5">All customer credit accounts are up to date.</p>
            </div>
        `;
    } else {
        remindersContainer.innerHTML = dueShopsList.map((item) => {
            const sh = item.shop;
            const waPhone = formatWhatsAppPhone(sh.phone);
            const isPast = (item.earliestDueDate < today);
            const waMsg = `Ayubowan / Hello ${sh.shop_name},\nThis is a friendly payment reminder from DistroPay.\nYour credit payment was due on ${formatDate(item.earliestDueDate)}.\nCurrent Outstanding Due: ${formatCurrency(sh.total_due)}.\nPlease settle this amount soon. Bohoma Sthuthi / Thank you!`;
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

            return `
                <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div>
                        <div class="flex items-center space-x-2">
                            <button onclick="openShopHistory(${sh.id})" class="text-sm font-bold text-slate-900 hover:text-indigo-600 transition flex items-center group text-left">
                                <span>${sh.shop_name}</span>
                                <i class="fa-solid fa-arrow-up-right-from-square ml-1.5 text-[10px] text-slate-300 group-hover:text-indigo-600 transition"></i>
                            </button>
                            ${sh.route ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">${sh.route}</span>` : ''}
                        </div>
                        <div class="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                            <span><i class="fa-solid fa-clock text-slate-400 mr-1"></i> Due: <strong class="${isPast ? 'text-rose-600 font-bold' : 'text-amber-600 font-semibold'}">${formatDate(item.earliestDueDate)} ${isPast ? '(Overdue)' : '(Due Today)'}</strong></span>
                            <span>&bull;</span>
                            <a href="tel:${sh.phone}" class="hover:text-indigo-600">${sh.phone}</a>
                        </div>
                    </div>
                    <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div class="text-left sm:text-right">
                            <span class="text-[10px] font-semibold uppercase text-slate-400 block">Total Due</span>
                            <span class="text-sm sm:text-base font-extrabold text-rose-600">${formatCurrency(sh.total_due)}</span>
                        </div>
                        <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
                           class="inline-flex items-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition whitespace-nowrap">
                            <i class="fa-brands fa-whatsapp text-sm mr-1.5"></i> Reminder
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render Low Stock Alerts
    const lowStockList = products.filter((p) => parseInt(p.stock_qty) <= 5);
    const lowStockContainer = document.getElementById('dash-lowstock-list');
    const lowStockBadge = document.getElementById('dash-lowstock-badge');
    lowStockBadge.textContent = `${lowStockList.length} items`;

    if (lowStockList.length === 0) {
        lowStockContainer.innerHTML = `
            <div class="p-8 text-center text-slate-400">
                <i class="fa-solid fa-boxes-stacked text-3xl mb-2 text-emerald-400"></i>
                <p class="text-sm font-semibold text-slate-700">Healthy Inventory</p>
                <p class="text-xs text-slate-400 mt-0.5">All products have sufficient stock (> 5 units).</p>
            </div>
        `;
    } else {
        lowStockContainer.innerHTML = lowStockList.map((p) => {
            const stock = parseInt(p.stock_qty);
            return `
                <div class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div>
                        <h4 class="text-xs font-bold text-slate-800">${p.product_name}</h4>
                        <p class="text-[11px] text-slate-400 mt-0.5">Selling: ${formatCurrency(p.selling_price)}</p>
                    </div>
                    <div>
                        ${stock <= 0 
                            ? `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">Out of Stock</span>`
                            : `<span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${stock} Left</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }
}

// B. RENDER SHOPS
function renderShops(filterQuery = '') {
    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const container = document.getElementById('shops-list-container');
    const counterBadge = document.getElementById('shops-count-badge');

    const query = filterQuery.trim().toLowerCase();
    const filtered = shops.filter((s) => {
        if (!query) return true;
        return (
            (s.shop_name && s.shop_name.toLowerCase().includes(query)) ||
            (s.owner_name && s.owner_name.toLowerCase().includes(query)) ||
            (s.route && s.route.toLowerCase().includes(query)) ||
            (s.phone && s.phone.includes(query))
        );
    });

    counterBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <i class="fa-solid fa-store text-3xl text-slate-300 mb-2"></i>
                <p class="text-slate-700 font-bold text-base">No Shops Found</p>
                <p class="text-xs text-slate-400 mt-1">Register a new shop above or clear your search term.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((s) => {
        const due = parseFloat(s.total_due) || 0;
        const isDue = (due > 0);
        const waPhone = formatWhatsAppPhone(s.phone);
        const waMsg = `Ayubowan / Hello ${s.shop_name},\nThis is a friendly payment reminder from DistroPay distribution.\nYour outstanding credit balance is ${formatCurrency(due)}.\nKindly arrange this settlement at your earliest convenience.\nBohoma Sthuthi / Thank you!`;
        const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200/90 hover:shadow-md transition p-5 flex flex-col justify-between">
                <div>
                    <!-- Header -->
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <h3 class="text-base font-bold text-slate-900 leading-snug">
                                <button onclick="openShopHistory(${s.id})" class="text-left hover:text-indigo-600 transition inline-flex items-center group">
                                    <span>${s.shop_name}</span>
                                    <i class="fa-solid fa-arrow-up-right-from-square ml-1.5 text-[11px] text-slate-300 group-hover:text-indigo-600 transition"></i>
                                </button>
                            </h3>
                            <p class="text-xs text-slate-500 mt-0.5 flex items-center">
                                <i class="fa-solid fa-user-tie mr-1 text-slate-400"></i> ${s.owner_name || 'Not specified'}
                            </p>
                        </div>
                        ${s.route ? `
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                <i class="fa-solid fa-route mr-1 text-indigo-500 text-[10px]"></i> ${s.route}
                            </span>
                        ` : ''}
                    </div>

                    <!-- Contact -->
                    <div class="mt-3.5 space-y-1 text-xs text-slate-600">
                        <a href="tel:${s.phone}" class="hover:text-indigo-600 font-medium flex items-center">
                            <i class="fa-solid fa-phone w-4 text-slate-400 mr-2"></i> ${s.phone}
                        </a>
                    </div>

                    <!-- Due Badge -->
                    <div class="mt-4 p-3 rounded-lg border ${isDue ? 'bg-rose-50/70 border-rose-200 text-rose-900' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'} flex items-center justify-between">
                        <div>
                            <span class="text-[11px] font-semibold uppercase tracking-wider ${isDue ? 'text-rose-600' : 'text-emerald-600'}">Total Due</span>
                            <div class="text-lg font-extrabold ${isDue ? 'text-rose-700' : 'text-emerald-700'}">${formatCurrency(due)}</div>
                        </div>
                        <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${isDue ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                            ${isDue ? 'Credit Due' : 'Settled'}
                        </span>
                    </div>
                </div>

                <!-- Actions -->
                <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button onclick="openShopHistory(${s.id})" class="inline-flex items-center justify-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition" title="View Shop History">
                        <i class="fa-solid fa-file-invoice mr-1.5 text-xs"></i> History
                    </button>

                    <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
                       class="flex-1 inline-flex items-center justify-center px-3 py-2 ${isDue ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} rounded-lg text-xs font-medium shadow-sm transition">
                        <i class="fa-brands fa-whatsapp text-sm mr-1.5 ${isDue ? '' : 'text-emerald-600'}"></i> ${isDue ? 'Reminder' : 'WhatsApp'}
                    </a>

                    <button onclick="deleteShop(${s.id})" class="w-9 h-9 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs flex items-center justify-center transition" title="Delete Shop">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// C. RENDER PRODUCTS
function renderProducts(filterQuery = '') {
    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const container = document.getElementById('products-list-container');
    const counterBadge = document.getElementById('products-count-badge');

    const query = filterQuery.trim().toLowerCase();
    const filtered = products.filter((p) => {
        if (!query) return true;
        return p.product_name && p.product_name.toLowerCase().includes(query);
    });

    counterBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <i class="fa-solid fa-boxes-stacked text-3xl text-slate-300 mb-2"></i>
                <p class="text-slate-700 font-bold text-base">No Products Found</p>
                <p class="text-xs text-slate-400 mt-1">Add items to inventory using the form above.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map((p) => {
        const cost = parseFloat(p.cost_price) || 0;
        const selling = parseFloat(p.selling_price) || 0;
        const profit = selling - cost;
        const stock = parseInt(p.stock_qty) || 0;
        const isLow = (stock <= 5 && stock > 0);
        const isOut = (stock <= 0);

        return `
            <div class="bg-white rounded-xl shadow-sm border border-slate-200/90 hover:shadow-md transition p-5 flex flex-col justify-between">
                <div>
                    <!-- Header -->
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <h3 class="text-base font-bold text-slate-900 leading-snug">${p.product_name}</h3>
                            <p class="text-xs text-slate-400 mt-0.5">Item #${p.id}</p>
                        </div>
                        ${isOut 
                            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">Out of Stock</span>`
                            : isLow 
                                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Low Stock</span>`
                                : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">In Stock</span>`
                        }
                    </div>

                    <!-- Price & Profit Grid -->
                    <div class="mt-4 grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        <div>
                            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Cost</span>
                            <p class="text-sm font-bold text-slate-700 mt-0.5">${formatCurrency(cost)}</p>
                        </div>
                        <div class="border-x border-slate-200">
                            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Selling</span>
                            <p class="text-sm font-bold text-indigo-700 mt-0.5">${formatCurrency(selling)}</p>
                        </div>
                        <div>
                            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Profit</span>
                            <p class="text-sm font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-0.5">${profit >= 0 ? '+' : ''}${formatCurrency(profit)}</p>
                        </div>
                    </div>

                    <!-- Stock Counter & Quick Inline Update -->
                    <div class="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold text-slate-600 flex items-center">
                                <i class="fa-solid fa-cubes text-slate-400 mr-1.5"></i> Available Stock:
                            </span>
                            <span class="text-base font-extrabold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'}">
                                ${stock} units
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <input type="number" min="0" id="quick-stock-${p.id}" value="${stock}"
                                   class="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800">
                            <button onclick="updateStockInline(${p.id})"
                                    class="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-sm transition">
                                <i class="fa-solid fa-arrows-rotate mr-1 text-[10px]"></i> Update
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Footer Action -->
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400">Added: ${formatDate(p.created_at)}</span>
                    <button onclick="deleteProduct(${p.id})" class="inline-flex items-center text-xs font-medium text-rose-600 hover:text-rose-800 py-1 px-2 rounded-lg hover:bg-rose-50 transition">
                        <i class="fa-solid fa-trash-can mr-1.5"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// D. RENDER NEW SALE VIEW
function renderNewSaleView() {
    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const sales = getStorage(STORAGE_KEYS.SALES);

    const shopSelect = document.getElementById('sale-shop-select');
    const productSelect = document.getElementById('sale-product-select');
    const dueDateInput = document.getElementById('sale-due-date-input');

    // Default due date to 7 days from today
    const inSevenDays = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    if (dueDateInput && !dueDateInput.value) {
        dueDateInput.value = inSevenDays;
    }

    // Populate Shops
    shopSelect.innerHTML = '<option value="">-- Choose Retail Shop --</option>' +
        shops.map((s) => `
            <option value="${s.id}">
                ${s.shop_name} ${s.route ? `(${s.route})` : ''} ${s.total_due > 0 ? `[Due: ${formatCurrency(s.total_due)}]` : ''}
            </option>
        `).join('');

    // Populate In-Stock Products
    const inStockProds = products.filter((p) => parseInt(p.stock_qty) > 0);
    productSelect.innerHTML = '<option value="" data-price="0" data-stock="0">-- Choose Product --</option>' +
        inStockProds.map((p) => `
            <option value="${p.id}" data-price="${p.selling_price}" data-stock="${p.stock_qty}">
                ${p.product_name} (${formatCurrency(p.selling_price)} | Stock: ${p.stock_qty})
            </option>
        `).join('');

    // Calculate once
    calculateNewSale();

    // Render Recent 10 Sales
    renderRecentSalesTable(sales, shops, products);
}

function calculateNewSale() {
    const productSelect = document.getElementById('sale-product-select');
    const qtyInput = document.getElementById('sale-qty-input');
    const paidInput = document.getElementById('sale-paid-input');
    const warningEl = document.getElementById('sale-stock-warning');
    const submitBtn = document.getElementById('sale-submit-btn');

    if (!productSelect || !qtyInput || !paidInput) return;

    const opt = productSelect.options[productSelect.selectedIndex];
    const price = parseFloat(opt ? opt.getAttribute('data-price') : 0) || 0;
    const stock = parseInt(opt ? opt.getAttribute('data-stock') : 0) || 0;
    const qty = parseInt(qtyInput.value) || 0;
    const paid = parseFloat(paidInput.value) || 0;

    document.getElementById('calc-sale-unit-price').textContent = formatCurrency(price);
    document.getElementById('calc-sale-stock').textContent = `${stock} units`;

    if (productSelect.value !== '' && qty > stock) {
        warningEl.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        warningEl.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    const total = price * qty;
    let due = total - paid;
    if (due < 0) due = 0;

    document.getElementById('calc-sale-total').textContent = formatCurrency(total);
    document.getElementById('calc-sale-due').textContent = formatCurrency(due);
}

function renderRecentSalesTable(sales, shops, products) {
    const container = document.getElementById('recent-sales-table-container');
    const sorted = [...sales].reverse().slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400">No sales recorded yet.</div>`;
        return;
    }

    container.innerHTML = `
        <table class="w-full text-left border-collapse text-xs">
            <thead>
                <tr class="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th class="py-3 px-4">#ID</th>
                    <th class="py-3 px-4">Date</th>
                    <th class="py-3 px-4">Shop</th>
                    <th class="py-3 px-4">Product & Qty</th>
                    <th class="py-3 px-4 text-right">Total</th>
                    <th class="py-3 px-4 text-right">Paid</th>
                    <th class="py-3 px-4 text-right">Due Balance</th>
                    <th class="py-3 px-4 text-center">Due Date</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
                ${sorted.map((s) => {
                    const shop = shops.find((sh) => sh.id === s.shop_id) || { shop_name: 'Unknown' };
                    const prod = products.find((pr) => pr.id === s.product_id) || { product_name: 'Unknown' };
                    const due = parseFloat(s.total_amount) - parseFloat(s.paid_amount);

                    return `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="py-3 px-4 font-bold text-slate-900">#${s.id}</td>
                            <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${formatDate(s.sale_date)}</td>
                            <td class="py-3 px-4 font-semibold text-slate-800">${shop.shop_name}</td>
                            <td class="py-3 px-4">${prod.product_name} <span class="font-bold text-slate-500">&times;${s.qty}</span></td>
                            <td class="py-3 px-4 text-right font-bold text-slate-900">${formatCurrency(s.total_amount)}</td>
                            <td class="py-3 px-4 text-right font-semibold text-emerald-600">${formatCurrency(s.paid_amount)}</td>
                            <td class="py-3 px-4 text-right font-bold ${due > 0 ? 'text-rose-600' : 'text-slate-400'}">${formatCurrency(due)}</td>
                            <td class="py-3 px-4 text-center whitespace-nowrap">
                                ${due > 0 && s.due_date 
                                    ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">${formatDate(s.due_date)}</span>`
                                    : `<span class="text-slate-400 text-[10px]">Settled</span>`
                                }
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// E. RENDER PAYMENTS VIEW
function renderPaymentsView() {
    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const payments = getStorage(STORAGE_KEYS.PAYMENTS);

    const dueShops = shops.filter((s) => parseFloat(s.total_due) > 0);
    const shopSelect = document.getElementById('payment-shop-select');

    shopSelect.innerHTML = '<option value="" data-due="0">-- Choose Shop to Settle --</option>' +
        dueShops.map((s) => `
            <option value="${s.id}" data-due="${s.total_due}">
                ${s.shop_name} ${s.route ? `(${s.route})` : ''} - Due: ${formatCurrency(s.total_due)}
            </option>
        `).join('');

    calculatePayment();
    renderRecentPaymentsTable(payments, shops);
}

function calculatePayment() {
    const shopSelect = document.getElementById('payment-shop-select');
    const amountInput = document.getElementById('payment-amount-input');
    const warningEl = document.getElementById('payment-amount-warning');
    const submitBtn = document.getElementById('payment-submit-btn');

    if (!shopSelect || !amountInput) return;

    const opt = shopSelect.options[shopSelect.selectedIndex];
    const currentDue = parseFloat(opt ? opt.getAttribute('data-due') : 0) || 0;
    const payingAmount = parseFloat(amountInput.value) || 0;

    document.getElementById('calc-pay-current-due').textContent = formatCurrency(currentDue);
    document.getElementById('calc-pay-amount').textContent = formatCurrency(payingAmount);

    if (payingAmount > currentDue && currentDue > 0) {
        warningEl.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        document.getElementById('calc-pay-remaining').textContent = 'Invalid (Exceeds Due)';
        document.getElementById('calc-pay-remaining').className = 'text-xl font-extrabold text-rose-600 mt-0.5';
    } else {
        warningEl.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        let remaining = currentDue - payingAmount;
        if (remaining < 0) remaining = 0;
        document.getElementById('calc-pay-remaining').textContent = formatCurrency(remaining);
        document.getElementById('calc-pay-remaining').className = 'text-xl font-extrabold text-slate-800 mt-0.5';
    }
}

function renderRecentPaymentsTable(payments, shops) {
    const container = document.getElementById('recent-payments-table-container');
    const sorted = [...payments].reverse().slice(0, 15);

    if (sorted.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400">No payments recorded yet.</div>`;
        return;
    }

    container.innerHTML = `
        <table class="w-full text-left border-collapse text-xs">
            <thead>
                <tr class="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th class="py-3 px-4">#Receipt</th>
                    <th class="py-3 px-4">Date</th>
                    <th class="py-3 px-4">Shop</th>
                    <th class="py-3 px-4">Note / Reference</th>
                    <th class="py-3 px-4 text-right">Amount Paid</th>
                    <th class="py-3 px-4 text-center">Receipt</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
                ${sorted.map((p) => {
                    const shop = shops.find((sh) => sh.id === p.shop_id) || { shop_name: 'Unknown', phone: '' };
                    const waPhone = formatWhatsAppPhone(shop.phone);
                    const waMsg = `Ayubowan ${shop.shop_name},\nPayment receipt #${p.id} of ${formatCurrency(p.amount)} received on ${formatDate(p.payment_date)}. Thank you!\n- DistroPay Management`;
                    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

                    return `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="py-3 px-4 font-bold text-slate-900">#${p.id}</td>
                            <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${formatDateTime(p.payment_date)}</td>
                            <td class="py-3 px-4 font-semibold text-slate-800">${shop.shop_name}</td>
                            <td class="py-3 px-4 text-slate-500 italic">${p.note || 'No notes'}</td>
                            <td class="py-3 px-4 text-right font-extrabold text-emerald-600 text-sm">${formatCurrency(p.amount)}</td>
                            <td class="py-3 px-4 text-center">
                                <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
                                   class="inline-flex items-center px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-[11px] transition">
                                    <i class="fa-brands fa-whatsapp mr-1 text-emerald-600"></i> WhatsApp
                                </a>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ------------------------------------------------------------
// 7. Modals: Shop History & Statement
// ------------------------------------------------------------
function openShopHistory(shopId) {
    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const sales = getStorage(STORAGE_KEYS.SALES);
    const payments = getStorage(STORAGE_KEYS.PAYMENTS);

    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;

    document.getElementById('modal-shop-title').textContent = `${shop.shop_name} - Ledger`;
    document.getElementById('modal-shop-name').textContent = shop.shop_name;
    document.getElementById('modal-shop-route').textContent = shop.route || 'General';
    document.getElementById('modal-shop-phone').textContent = `Owner: ${shop.owner_name || 'N/A'} | Phone: ${shop.phone}`;
    document.getElementById('modal-shop-due').textContent = formatCurrency(shop.total_due);

    // WhatsApp Statement Link
    const waPhone = formatWhatsAppPhone(shop.phone);
    const waMsg = `Ayubowan / Hello ${shop.shop_name},\nThis is an account statement from DistroPay.\nCurrent Outstanding Balance: ${formatCurrency(shop.total_due)}.\nPlease let us know when you can settle this amount. Bohoma Sthuthi / Thank you!`;
    const waBtn = document.getElementById('modal-shop-wa-btn');
    waBtn.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

    // Quick Action Buttons inside modal
    document.getElementById('modal-shop-sale-btn').onclick = () => {
        closeShopHistoryModal();
        switchTab('new-sale');
        setTimeout(() => {
            const select = document.getElementById('sale-shop-select');
            if (select) {
                select.value = shop.id;
                calculateNewSale();
            }
        }, 50);
    };

    document.getElementById('modal-shop-pay-btn').onclick = () => {
        closeShopHistoryModal();
        switchTab('payments');
        setTimeout(() => {
            const select = document.getElementById('payment-shop-select');
            if (select) {
                select.value = shop.id;
                const amtInput = document.getElementById('payment-amount-input');
                if (amtInput && shop.total_due > 0) amtInput.value = shop.total_due.toFixed(2);
                calculatePayment();
            }
        }, 50);
    };

    // Render this shop's sales
    const shopSales = sales.filter((s) => s.shop_id === shopId).reverse();
    const salesContainer = document.getElementById('modal-sales-container');
    if (shopSales.length === 0) {
        salesContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No sales recorded for this shop.</div>`;
    } else {
        salesContainer.innerHTML = `
            <table class="w-full text-left border-collapse text-xs">
                <thead>
                    <tr class="bg-slate-100 text-slate-600 font-semibold uppercase">
                        <th class="p-2.5">Date</th>
                        <th class="p-2.5">Item (Qty)</th>
                        <th class="p-2.5 text-right">Total</th>
                        <th class="p-2.5 text-right">Paid</th>
                        <th class="p-2.5 text-right">Due</th>
                        <th class="p-2.5 text-center">Due Date</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                    ${shopSales.map((s) => {
                        const prod = products.find((pr) => pr.id === s.product_id) || { product_name: 'Unknown' };
                        const due = parseFloat(s.total_amount) - parseFloat(s.paid_amount);
                        return `
                            <tr>
                                <td class="p-2.5 whitespace-nowrap text-slate-500">${formatDate(s.sale_date)}</td>
                                <td class="p-2.5">${prod.product_name} <span class="font-bold text-slate-500">&times;${s.qty}</span></td>
                                <td class="p-2.5 text-right font-bold">${formatCurrency(s.total_amount)}</td>
                                <td class="p-2.5 text-right text-emerald-600 font-semibold">${formatCurrency(s.paid_amount)}</td>
                                <td class="p-2.5 text-right font-bold ${due > 0 ? 'text-rose-600' : 'text-slate-400'}">${formatCurrency(due)}</td>
                                <td class="p-2.5 text-center whitespace-nowrap">${due > 0 && s.due_date ? formatDate(s.due_date) : 'Settled'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    // Render this shop's payments
    const shopPayments = payments.filter((p) => p.shop_id === shopId).reverse();
    const paymentsContainer = document.getElementById('modal-payments-container');
    if (shopPayments.length === 0) {
        paymentsContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No payments received from this shop yet.</div>`;
    } else {
        paymentsContainer.innerHTML = `
            <table class="w-full text-left border-collapse text-xs">
                <thead>
                    <tr class="bg-slate-100 text-slate-600 font-semibold uppercase">
                        <th class="p-2.5">Receipt #</th>
                        <th class="p-2.5">Date</th>
                        <th class="p-2.5">Note</th>
                        <th class="p-2.5 text-right">Amount Paid</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                    ${shopPayments.map((p) => `
                        <tr>
                            <td class="p-2.5 font-bold text-slate-900">#${p.id}</td>
                            <td class="p-2.5 text-slate-500 whitespace-nowrap">${formatDate(p.payment_date)}</td>
                            <td class="p-2.5 text-slate-500 italic">${p.note || 'None'}</td>
                            <td class="p-2.5 text-right font-bold text-emerald-600">${formatCurrency(p.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    document.getElementById('modal-shop-history').classList.remove('hidden');
}

function closeShopHistoryModal() {
    document.getElementById('modal-shop-history').classList.add('hidden');
}

// ------------------------------------------------------------
// 8. Modals: Backup & Restore
// ------------------------------------------------------------
function openBackupModal() {
    document.getElementById('modal-backup').classList.remove('hidden');
}

function closeBackupModal() {
    document.getElementById('modal-backup').classList.add('hidden');
}

function exportBackupData() {
    const backup = {
        app: 'SalesCreditManagerPWA',
        version: 1,
        exportedAt: new Date().toISOString(),
        shops: getStorage(STORAGE_KEYS.SHOPS),
        products: getStorage(STORAGE_KEYS.PRODUCTS),
        sales: getStorage(STORAGE_KEYS.SALES),
        payments: getStorage(STORAGE_KEYS.PAYMENTS)
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    const todayStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sales_credit_backup_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Backup JSON downloaded successfully!');
}

function importBackupData() {
    const fileInput = document.getElementById('import-file-input');
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a JSON file to restore.', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const json = JSON.parse(e.target.result);
            if (!json.shops || !json.products || !json.sales || !json.payments) {
                showToast('Invalid backup file format.', 'error');
                return;
            }

            if (!confirm('Are you sure you want to restore this backup? This will replace your current data.')) {
                return;
            }

            setStorage(STORAGE_KEYS.SHOPS, json.shops);
            setStorage(STORAGE_KEYS.PRODUCTS, json.products);
            setStorage(STORAGE_KEYS.SALES, json.sales);
            setStorage(STORAGE_KEYS.PAYMENTS, json.payments);

            showToast('Backup restored successfully!');
            closeBackupModal();
            switchTab(currentTab);
        } catch (err) {
            console.error('Import error:', err);
            showToast('Failed to parse backup JSON file.', 'error');
        }
    };

    reader.readAsText(file);
}

function loadSampleDemoData() {
    if (!confirm('Load sample distribution demo data? (Existing data will be replaced)')) return;
    localStorage.removeItem(STORAGE_KEYS.SHOPS);
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
    seedInitialDataIfEmpty();
    showToast('Demo data loaded successfully!');
    closeBackupModal();
    switchTab('dashboard');
}

function clearAllData() {
    if (!confirm('DANGER: Are you sure you want to delete ALL shops, products, sales, and payments?\nThis cannot be undone!')) return;
    setStorage(STORAGE_KEYS.SHOPS, []);
    setStorage(STORAGE_KEYS.PRODUCTS, []);
    setStorage(STORAGE_KEYS.SALES, []);
    setStorage(STORAGE_KEYS.PAYMENTS, []);
    showToast('All local data cleared.');
    closeBackupModal();
    switchTab('dashboard');
}

// ------------------------------------------------------------
// 9. CRUD Operations
// ------------------------------------------------------------

// ADD SHOP
function handleAddShop(e) {
    e.preventDefault();
    const nameInput = document.getElementById('shop-name-input');
    const ownerInput = document.getElementById('shop-owner-input');
    const phoneInput = document.getElementById('shop-phone-input');
    const routeInput = document.getElementById('shop-route-input');

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!name || !phone) {
        showToast('Shop Name and Phone are required.', 'error');
        return;
    }

    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const newId = shops.length > 0 ? Math.max(...shops.map((s) => s.id)) + 1 : 1;

    shops.unshift({
        id: newId,
        shop_name: name,
        owner_name: ownerInput.value.trim(),
        phone: phone,
        route: routeInput.value.trim(),
        total_due: 0.00,
        created_at: new Date().toISOString()
    });

    setStorage(STORAGE_KEYS.SHOPS, shops);
    showToast(`Shop '${name}' added successfully!`);
    e.target.reset();
    renderShops();
}

function deleteShop(shopId) {
    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;

    if (!confirm(`Are you sure you want to delete '${shop.shop_name}'?\nAll sales and payments for this shop will also be removed.`)) {
        return;
    }

    const updatedShops = shops.filter((s) => s.id !== shopId);
    const sales = getStorage(STORAGE_KEYS.SALES).filter((s) => s.shop_id !== shopId);
    const payments = getStorage(STORAGE_KEYS.PAYMENTS).filter((p) => p.shop_id !== shopId);

    setStorage(STORAGE_KEYS.SHOPS, updatedShops);
    setStorage(STORAGE_KEYS.SALES, sales);
    setStorage(STORAGE_KEYS.PAYMENTS, payments);

    showToast(`Shop '${shop.shop_name}' deleted.`);
    renderShops();
}

// ADD PRODUCT
function handleAddProduct(e) {
    e.preventDefault();
    const nameInput = document.getElementById('prod-name-input');
    const costInput = document.getElementById('prod-cost-input');
    const sellInput = document.getElementById('prod-selling-input');
    const stockInput = document.getElementById('prod-stock-input');

    const name = nameInput.value.trim();
    const cost = parseFloat(costInput.value) || 0;
    const selling = parseFloat(sellInput.value) || 0;
    const stock = parseInt(stockInput.value) || 0;

    if (!name) {
        showToast('Product Name is required.', 'error');
        return;
    }

    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const newId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;

    products.unshift({
        id: newId,
        product_name: name,
        cost_price: cost,
        selling_price: selling,
        stock_qty: stock,
        created_at: new Date().toISOString()
    });

    setStorage(STORAGE_KEYS.PRODUCTS, products);
    showToast(`Product '${name}' added!`);
    e.target.reset();
    renderProducts();
}

function updateStockInline(prodId) {
    const input = document.getElementById(`quick-stock-${prodId}`);
    if (!input) return;
    const newStock = parseInt(input.value);
    if (isNaN(newStock) || newStock < 0) {
        showToast('Please enter a valid stock quantity.', 'error');
        return;
    }

    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    prod.stock_qty = newStock;
    setStorage(STORAGE_KEYS.PRODUCTS, products);
    showToast(`Stock updated for '${prod.product_name}'.`);
    renderProducts();
}

function deleteProduct(prodId) {
    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    const sales = getStorage(STORAGE_KEYS.SALES);
    const hasSales = sales.some((s) => s.product_id === prodId);
    if (hasSales) {
        showToast('Cannot delete this product because it has recorded sales. Set stock to 0 instead.', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete '${prod.product_name}'?`)) return;

    const updated = products.filter((p) => p.id !== prodId);
    setStorage(STORAGE_KEYS.PRODUCTS, updated);
    showToast(`Product '${prod.product_name}' deleted.`);
    renderProducts();
}

// RECORD SALE
function handleNewSale(e) {
    e.preventDefault();
    const shopId = parseInt(document.getElementById('sale-shop-select').value);
    const prodId = parseInt(document.getElementById('sale-product-select').value);
    const qty = parseInt(document.getElementById('sale-qty-input').value) || 0;
    const paid = parseFloat(document.getElementById('sale-paid-input').value) || 0;
    const dueDate = document.getElementById('sale-due-date-input').value;

    if (!shopId || !prodId || qty <= 0) {
        showToast('Please select a shop, product, and valid quantity.', 'error');
        return;
    }

    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const products = getStorage(STORAGE_KEYS.PRODUCTS);
    const sales = getStorage(STORAGE_KEYS.SALES);

    const shop = shops.find((s) => s.id === shopId);
    const prod = products.find((p) => p.id === prodId);

    if (!shop || !prod) {
        showToast('Selected shop or product does not exist.', 'error');
        return;
    }

    if (qty > prod.stock_qty) {
        showToast(`Not enough stock. Only ${prod.stock_qty} available.`, 'error');
        return;
    }

    const unitPrice = parseFloat(prod.selling_price) || 0;
    const totalAmount = unitPrice * qty;
    const actualPaid = Math.min(paid, totalAmount);
    const creditAmount = totalAmount - actualPaid;

    // 1. Deduct Stock
    prod.stock_qty = prod.stock_qty - qty;

    // 2. Add Credit to Shop
    if (creditAmount > 0) {
        shop.total_due = (parseFloat(shop.total_due) || 0) + creditAmount;
    }

    // 3. Create Sale Record
    const saleId = sales.length > 0 ? Math.max(...sales.map((s) => s.id)) + 1 : 1;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    sales.push({
        id: saleId,
        shop_id: shopId,
        product_id: prodId,
        qty: qty,
        total_amount: totalAmount,
        paid_amount: actualPaid,
        due_date: dueDate || null,
        sale_date: nowStr
    });

    setStorage(STORAGE_KEYS.SHOPS, shops);
    setStorage(STORAGE_KEYS.PRODUCTS, products);
    setStorage(STORAGE_KEYS.SALES, sales);

    showToast(`Sale #${saleId} of ${formatCurrency(totalAmount)} recorded!`);
    e.target.reset();
    renderNewSaleView();
}

// RECORD PAYMENT
function handleNewPayment(e) {
    e.preventDefault();
    const shopId = parseInt(document.getElementById('payment-shop-select').value);
    const amount = parseFloat(document.getElementById('payment-amount-input').value) || 0;
    const note = document.getElementById('payment-note-input').value.trim();

    if (!shopId || amount <= 0) {
        showToast('Please select a shop and enter a valid payment amount.', 'error');
        return;
    }

    const shops = getStorage(STORAGE_KEYS.SHOPS);
    const payments = getStorage(STORAGE_KEYS.PAYMENTS);

    const shop = shops.find((s) => s.id === shopId);
    if (!shop) {
        showToast('Shop not found.', 'error');
        return;
    }

    if (amount > shop.total_due) {
        showToast(`Payment cannot exceed total due balance of ${formatCurrency(shop.total_due)}.`, 'error');
        return;
    }

    // Deduct due
    shop.total_due = Math.max(0, (parseFloat(shop.total_due) || 0) - amount);

    // Create payment record
    const paymentId = payments.length > 0 ? Math.max(...payments.map((p) => p.id)) + 1 : 1;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    payments.push({
        id: paymentId,
        shop_id: shopId,
        amount: amount,
        note: note,
        payment_date: nowStr
    });

    setStorage(STORAGE_KEYS.SHOPS, shops);
    setStorage(STORAGE_KEYS.PAYMENTS, payments);

    showToast(`Payment of ${formatCurrency(amount)} recorded for ${shop.shop_name}!`);
    e.target.reset();
    renderPaymentsView();
}

// ------------------------------------------------------------
// 10. Initialization & Event Listeners
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Seed demo data on first visit
    seedInitialDataIfEmpty();
    updateOnlineStatus();

    // 2. Initialize default tab
    switchTab('dashboard');

    // 3. Search inputs
    const shopSearch = document.getElementById('search-shops-input');
    if (shopSearch) {
        shopSearch.addEventListener('input', (e) => renderShops(e.target.value));
    }

    const prodSearch = document.getElementById('search-products-input');
    if (prodSearch) {
        prodSearch.addEventListener('input', (e) => renderProducts(e.target.value));
    }

    // 4. Form Submissions
    const shopForm = document.getElementById('form-add-shop');
    if (shopForm) shopForm.addEventListener('submit', handleAddShop);

    const prodForm = document.getElementById('form-add-product');
    if (prodForm) prodForm.addEventListener('submit', handleAddProduct);

    const saleForm = document.getElementById('form-new-sale');
    if (saleForm) saleForm.addEventListener('submit', handleNewSale);

    const payForm = document.getElementById('form-new-payment');
    if (payForm) payForm.addEventListener('submit', handleNewPayment);

    // 5. Dynamic Calculations for Sale
    const saleProdSelect = document.getElementById('sale-product-select');
    const saleQtyInput = document.getElementById('sale-qty-input');
    const salePaidInput = document.getElementById('sale-paid-input');
    if (saleProdSelect && saleQtyInput && salePaidInput) {
        saleProdSelect.addEventListener('change', calculateNewSale);
        saleQtyInput.addEventListener('input', calculateNewSale);
        salePaidInput.addEventListener('input', calculateNewSale);
    }

    // 6. Dynamic Calculations for Payment
    const payShopSelect = document.getElementById('payment-shop-select');
    const payAmtInput = document.getElementById('payment-amount-input');
    if (payShopSelect && payAmtInput) {
        payShopSelect.addEventListener('change', () => {
            const opt = payShopSelect.options[payShopSelect.selectedIndex];
            const due = parseFloat(opt ? opt.getAttribute('data-due') : 0) || 0;
            if (due > 0 && (!payAmtInput.value || parseFloat(payAmtInput.value) <= 0)) {
                payAmtInput.value = due.toFixed(2);
            }
            calculatePayment();
        });
        payAmtInput.addEventListener('input', calculatePayment);
    }

    // 7. Toggle Collapsible Form Cards
    const toggleShopBtn = document.getElementById('toggle-shop-form-btn');
    const shopCard = document.getElementById('add-shop-card');
    if (toggleShopBtn && shopCard) {
        let isVis = true;
        toggleShopBtn.addEventListener('click', () => {
            isVis = !isVis;
            shopCard.classList.toggle('hidden', !isVis);
            document.getElementById('toggle-shop-text').textContent = isVis ? 'Hide Form' : 'Add New Shop';
            document.getElementById('toggle-shop-icon').className = isVis ? 'fa-solid fa-minus mr-2 text-xs' : 'fa-solid fa-plus mr-2 text-xs';
        });
    }

    const toggleProdBtn = document.getElementById('toggle-product-form-btn');
    const prodCard = document.getElementById('add-product-card');
    if (toggleProdBtn && prodCard) {
        let isVis = true;
        toggleProdBtn.addEventListener('click', () => {
            isVis = !isVis;
            prodCard.classList.toggle('hidden', !isVis);
            document.getElementById('toggle-product-text').textContent = isVis ? 'Hide Form' : 'Add New Product';
            document.getElementById('toggle-product-icon').className = isVis ? 'fa-solid fa-minus mr-2 text-xs' : 'fa-solid fa-plus mr-2 text-xs';
        });
    }
});
