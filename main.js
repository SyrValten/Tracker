// main.js - Controlador principal CORREGIDO
class App {
    constructor() {
        console.log('App constructor - iniciando...');
        this.api = new PolymarketAPI();
        this.currentWallet = null;
        this.currentLbPeriod = 'ALL';  // ALL por defecto
        this.chartMode = 'points';
        this.modalChartMode = 'line';
        this.leaderboardData = {}; // { DAY, WEEK, MONTH, ALL }
        this.tradedCount = null;
        this.favorites = [];
        this.favoritesStorageKey = 'polymarketFavorites';
        this.favoritesEditMode = false;
        this.dragStartWallet = null;
        this.dragOverWallet = null;
        this.activityData = null;
        this.closedPositionsData = null;
        
        this.activityTab = null;
        this.closedTab = null;
        
        try {
            this.activityTab = new ActivityTab(this);
            console.log('ActivityTab creada');
        } catch (error) {
            console.error('Error en ActivityTab:', error);
        }
        
        try {
            this.closedTab = new ClosedPositionsTab(this);
            console.log('ClosedPositionsTab creada');
        } catch (error) {
            console.error('Error en ClosedPositionsTab:', error);
        }
        
        this.initElements();
        console.log('initElements completado');
        this.loadFavoritesFromStorage();
        console.log('Favorites cargados');
        
        this.initEventListeners();
        console.log('initEventListeners completado');
        this.initUrl();
    }

    initElements() {
        this.walletInput = document.getElementById('walletInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.favoritesList = document.getElementById('favoritesList');
        this.favoriteEditBtn = document.getElementById('favoriteEditBtn');
        this.favoriteCurrentBtn = document.getElementById('favoriteCurrentBtn');
        this.copyWalletBtn = document.getElementById('copyWalletBtn');
        this.presetBtns = document.querySelectorAll('.preset-btn');
        this.positionsBody = document.getElementById('positionsBody');
        
        // Elementos de la tarjeta de perfil
        this.profileImage = document.getElementById('profileImage');
        this.profileName = document.getElementById('profileName');
        this.profileWallet = document.getElementById('profileWallet');
        this.profileRank = document.getElementById('profileRank');
        this.profileTrades = document.getElementById('profileTrades');
        this.profilePnl = document.getElementById('profilePnl');
        this.profileVol = document.getElementById('profileVol');
        
        // Elementos de la tarjeta de análisis
        this.analysisTotalValue = document.getElementById('analysisTotalValue');
        this.toggleChartModeBtn = document.getElementById('toggleChartMode');
        this.closedChart = null;
        this.modalDayChart = null;
        this.closedChartCtx = null;
        this.closedPositionsData = null;
        this.calendarDate = new Date();
        this.activeTabId = 'positions';
        
        this.lbTabButtons = document.querySelectorAll('.lb-tab-button');
        this.loading = document.getElementById('loading');
        this.errorMessage = document.getElementById('errorMessage');
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.rawPositionsContent = document.getElementById('rawPositionsContent');
        this.rawPositionsData = null;
        this.calendarTitle = document.getElementById('calendarTitle');
        this.calendarPrevBtn = document.getElementById('calendarPrevBtn');
        this.calendarNextBtn = document.getElementById('calendarNextBtn');
        this.calendarBody = document.getElementById('calendarBody');
        this.calendarWeekSummary = document.getElementById('calendarWeekSummary');
        
        // Modal elements
        this.calendarDayModal = document.getElementById('calendarDayModal');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.modalDayTitle = document.getElementById('modalDayTitle');
        this.modalDayPnl = document.getElementById('modalDayPnl');
        this.modalChartModeBtn = document.getElementById('modalChartModeBtn');
        this.modalTradesBody = document.getElementById('modalTradesBody');
    }

    initEventListeners() {
        this.searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.searchWallet();
        });

        this.walletInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchWallet();
            }
        });

        this.walletInput.addEventListener('focus', () => {
            if (this.walletInput.value) {
                this.walletInput.select();
            }
        });

        if (this.favoritesList) {
            this.favoritesList.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                const favoriteItem = e.target.closest('.favorite-item');
                const editingInput = e.target.closest('.favorite-name-input');

                if (button) {
                    const action = button.dataset.action;
                    const wallet = button.dataset.wallet;
                    if (action === 'remove' && wallet) {
                        this.removeFavoriteWallet(wallet);
                    }
                } else if (editingInput) {
                    return;
                } else if (favoriteItem && !this.favoritesEditMode) {
                    const wallet = favoriteItem.dataset.wallet;
                    if (wallet) {
                        this.loadWalletData(wallet);
                    }
                }
            });

            this.favoritesList.addEventListener('input', (e) => {
                const input = e.target.closest('.favorite-name-input');
                if (!input) return;
                const wallet = input.dataset.wallet;
                const label = input.value;
                this.updateFavoriteLabel(wallet, label);
            });

            this.favoritesList.addEventListener('dragstart', (e) => {
                if (!this.favoritesEditMode) return;
                const item = e.target.closest('.favorite-item');
                if (!item) return;
                this.dragStartWallet = item.dataset.wallet;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            this.favoritesList.addEventListener('dragover', (e) => {
                if (!this.favoritesEditMode) return;
                e.preventDefault();
                const item = e.target.closest('.favorite-item');
                if (!item || item.dataset.wallet === this.dragStartWallet) return;
                item.classList.add('drag-over');
                this.dragOverWallet = item.dataset.wallet;
            });

            this.favoritesList.addEventListener('dragleave', (e) => {
                const item = e.target.closest('.favorite-item');
                if (!item) return;
                item.classList.remove('drag-over');
            });

            this.favoritesList.addEventListener('drop', (e) => {
                e.preventDefault();
                const item = e.target.closest('.favorite-item');
                if (!item) return;
                const targetWallet = item.dataset.wallet;
                item.classList.remove('drag-over');
                if (this.dragStartWallet && targetWallet && this.dragStartWallet !== targetWallet) {
                    this.reorderFavoriteWallets(this.dragStartWallet, targetWallet);
                }
            });

            this.favoritesList.addEventListener('dragend', (e) => {
                const item = e.target.closest('.favorite-item');
                if (item) item.classList.remove('dragging');
                this.dragStartWallet = null;
                this.dragOverWallet = null;
                this.favoritesList.querySelectorAll('.favorite-item').forEach(el => el.classList.remove('drag-over'));
            });
        }

        if (this.favoriteEditBtn) {
            this.favoriteEditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFavoritesEditMode();
            });
        }

        if (this.favoriteCurrentBtn) {
            this.favoriteCurrentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleCurrentFavorite();
            });
        }

        if (this.copyWalletBtn) {
            this.copyWalletBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.copyWalletToClipboard();
            });
        }

        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const wallet = btn.dataset.wallet;
                this.walletInput.value = wallet;
                this.presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadWalletData(wallet);
            });
        });

        this.tabButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const tabId = button.dataset.tab;
                await this.switchTab(tabId);
            });
        });

        this.lbTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const period = btn.dataset.period;
                this.switchLeaderboardPeriod(period);
            });
        });

        if (this.calendarPrevBtn) {
            this.calendarPrevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.changeCalendarMonth(-1);
            });
        }

        if (this.calendarNextBtn) {
            this.calendarNextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.changeCalendarMonth(1);
            });
        }

        if (this.toggleChartModeBtn) {
            this.toggleChartModeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleChartMode();
            });
        }

        if (this.modalChartModeBtn) {
            this.modalChartModeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleModalChartMode();
            });
        }

        if (this.closeModalBtn) {
            this.closeModalBtn.addEventListener('click', (e) => {
                this.closeCalendarDayModal();
            });
        }

        // Close modal when clicking outside
        if (this.calendarDayModal) {
            this.calendarDayModal.addEventListener('click', (e) => {
                if (e.target === this.calendarDayModal) {
                    this.closeCalendarDayModal();
                }
            });
        }
    }

    loadFavoritesFromStorage() {
        try {
            const raw = localStorage.getItem(this.favoritesStorageKey);
            const safe = raw ? JSON.parse(raw) : [];
            if (Array.isArray(safe)) {
                this.favorites = safe.map(item => {
                    if (item && typeof item === 'object' && typeof item.wallet === 'string') {
                        return { wallet: item.wallet, label: item.label || this.getDefaultFavoriteLabel(item.wallet) };
                    }
                    if (typeof item === 'string') {
                        return { wallet: item, label: this.getDefaultFavoriteLabel(item) };
                    }
                    return null;
                }).filter(Boolean);
            } else {
                this.favorites = [];
            }
        } catch (error) {
            console.error('Error leyendo favoritos:', error);
            this.favorites = [];
        }
        this.renderFavorites();
        this.updateFavoritesEditButton();
    }

    saveFavoritesToStorage() {
        localStorage.setItem(this.favoritesStorageKey, JSON.stringify(this.favorites));
    }

    getWalletFromUrl() {
        const params = new URLSearchParams(window.location.search);
        let wallet = params.get('wallet') || params.get('');
        const raw = window.location.search || '';

        if (!wallet && raw.startsWith('?')) {
            const candidate = raw.slice(1);
            if (candidate.startsWith('0x')) {
                wallet = candidate;
            } else if (candidate.startsWith('=0x')) {
                wallet = candidate.slice(1);
            }
        }

        return wallet ? wallet.trim() : null;
    }

    updateUrl(wallet) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('wallet', wallet);
            window.history.replaceState(null, '', url.pathname + url.search);
        } catch (error) {
            console.warn('No se pudo actualizar la URL:', error);
        }
    }

    initUrl() {
        const wallet = this.getWalletFromUrl();
        if (wallet && this.validateWalletAddress(wallet)) {
            this.walletInput.value = wallet;
            this.loadWalletData(wallet);
            return;
        }

        // Si no hay wallet en la URL, cargar el primer favorito automáticamente (sin mostrar en input)
        if (this.favorites && this.favorites.length > 0) {
            const firstFavorite = this.favorites[0].wallet;
            this.loadWalletData(firstFavorite);
        }
        // Dejar el input vacío en cualquier caso
        this.walletInput.value = '';
    }

    renderFavorites() {
        if (!this.favoritesList) return;
        this.favoritesList.innerHTML = '';

        if (!this.favorites || this.favorites.length === 0) {
            this.favoritesList.innerHTML = '<div class="favorite-empty">Añade una wallet para empezar</div>';
            return;
        }

        const isEditMode = this.favoritesEditMode;

        this.favorites.forEach((favorite) => {
            const item = document.createElement('div');
            item.className = 'favorite-item';
            item.dataset.wallet = favorite.wallet;
            item.draggable = !!isEditMode;

            if (isEditMode) {
                item.innerHTML = `
                    <div class="favorite-card-header edit-mode">
                        <input type="text" class="favorite-name-input" data-wallet="${favorite.wallet}" value="${favorite.label}" maxlength="30" />
                        <div class="favorite-drag-handle" title="Arrastra para reordenar">☰</div>
                    </div>
                    <div class="favorite-address">${this.shortenWallet(favorite.wallet)}</div>
                    <div class="favorite-actions">
                        <button class="favorite-action-icon" data-action="remove" data-wallet="${favorite.wallet}" title="Eliminar favorito">🗑️</button>
                    </div>
                `;
            } else {
                item.innerHTML = `
                    <div class="favorite-card-header">
                        <div>
                            <div class="favorite-name">${favorite.label}</div>
                            <div class="favorite-address">${this.shortenWallet(favorite.wallet)}</div>
                        </div>
                    </div>
                `;
            }

            this.favoritesList.appendChild(item);
        });
    }

    validateWalletAddress(wallet) {
        return typeof wallet === 'string' && wallet.startsWith('0x') && wallet.length >= 42;
    }

    getDefaultFavoriteLabel(wallet) {
        const count = this.favorites.length + 1;
        return `Wallet ${count}`;
    }

    shortenWallet(wallet) {
        if (!wallet || wallet.length < 10) return wallet;
        return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
    }

    isFavoriteWallet(wallet) {
        return this.favorites.some(item => item.wallet === wallet);
    }

    addFavoriteWallet(wallet, label) {
        const normalized = wallet.trim();
        if (!this.validateWalletAddress(normalized)) {
            this.showError('Dirección inválida. Debe comenzar con 0x y tener al menos 42 caracteres.');
            return;
        }

        if (this.isFavoriteWallet(normalized)) {
            this.showError('Esta wallet ya está en favoritos.');
            return;
        }

        this.hideError();
        this.favorites.push({
            wallet: normalized,
            label: label?.trim() || this.getDefaultFavoriteLabel(normalized)
        });
        this.saveFavoritesToStorage();
        this.renderFavorites();
        this.updateCurrentFavoriteButton();
    }

    removeFavoriteWallet(wallet) {
        this.favorites = this.favorites.filter(item => item.wallet !== wallet);
        this.saveFavoritesToStorage();
        this.renderFavorites();
        this.updateCurrentFavoriteButton();
    }

    updateFavoriteLabel(wallet, label) {
        const favorite = this.favorites.find(item => item.wallet === wallet);
        if (!favorite) return;
        favorite.label = label.trim() || this.getDefaultFavoriteLabel(wallet);
        this.saveFavoritesToStorage();
    }

    toggleFavoritesEditMode() {
        this.favoritesEditMode = !this.favoritesEditMode;
        this.updateFavoritesEditButton();
        this.renderFavorites();
    }

    updateFavoritesEditButton() {
        if (!this.favoriteEditBtn) return;
        if (this.favoritesEditMode) {
            this.favoriteEditBtn.textContent = 'Listo';
            this.favoriteEditBtn.classList.add('active');
            this.favoriteEditBtn.title = 'Salir del modo edición';
        } else {
            this.favoriteEditBtn.textContent = 'Editar';
            this.favoriteEditBtn.classList.remove('active');
            this.favoriteEditBtn.title = 'Editar favoritos';
        }
    }

    reorderFavoriteWallets(dragWallet, targetWallet) {
        const fromIndex = this.favorites.findIndex(item => item.wallet === dragWallet);
        const toIndex = this.favorites.findIndex(item => item.wallet === targetWallet);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const [moved] = this.favorites.splice(fromIndex, 1);
        this.favorites.splice(toIndex, 0, moved);
        this.saveFavoritesToStorage();
        this.renderFavorites();
    }

    toggleCurrentFavorite() {
        const current = this.currentWallet?.trim();
        if (!current || !this.validateWalletAddress(current)) {
            this.showError('No hay wallet válida cargada para añadir a favoritos.');
            return;
        }

        if (this.isFavoriteWallet(current)) {
            this.removeFavoriteWallet(current);
        } else {
            this.addFavoriteWallet(current);
        }
    }

    updateCurrentFavoriteButton() {
        if (!this.favoriteCurrentBtn) return;
        if (this.currentWallet && this.isFavoriteWallet(this.currentWallet)) {
            this.favoriteCurrentBtn.classList.add('active');
            this.favoriteCurrentBtn.textContent = '★';
            this.favoriteCurrentBtn.title = 'Eliminar wallet de favoritos';
        } else {
            this.favoriteCurrentBtn.classList.remove('active');
            this.favoriteCurrentBtn.textContent = '☆';
            this.favoriteCurrentBtn.title = 'Agregar wallet a favoritos';
        }
    }

    copyWalletToClipboard() {
        if (!this.currentWallet) return;
        navigator.clipboard.writeText(this.currentWallet).then(() => {
            const originalText = this.copyWalletBtn.textContent;
            this.copyWalletBtn.textContent = '✓';
            setTimeout(() => {
                this.copyWalletBtn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Error al copiar:', err);
        });
    }

    switchLeaderboardPeriod(period) {
        this.currentLbPeriod = period;
        this.lbTabButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.lb-tab-button[data-period="${period}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        } else {
            console.error('Button not found for period:', period);
        }
        this.renderLeaderboardByPeriod(period);
        if (this.closedPositionsData) {
            this.renderAnalysis(this.closedPositionsData);
        }
    }

    toggleChartMode() {
        this.chartMode = this.chartMode === 'points' ? 'line' : 'points';
        this.updateChartModeButton();
        if (this.closedPositionsData) {
            this.renderAnalysis(this.closedPositionsData);
        }
    }

    updateChartModeButton() {
        if (!this.toggleChartModeBtn) return;
        if (this.chartMode === 'points') {
            this.toggleChartModeBtn.textContent = 'Vista línea';
            this.toggleChartModeBtn.title = 'Cambiar a gráfico con puntos';
        } else {
            this.toggleChartModeBtn.textContent = 'Vista puntos';
            this.toggleChartModeBtn.title = 'Cambiar a gráfico de línea limpia';
        }
    }

    toggleModalChartMode() {
        this.modalChartMode = this.modalChartMode === 'line' ? 'points' : 'line';
        this.updateModalChartModeButton();
        if (this.modalDayChart) {
            this.renderModalDayChart(this.lastModalTrades || []);
        }
    }

    updateModalChartModeButton() {
        if (!this.modalChartModeBtn) return;
        if (this.modalChartMode === 'line') {
            this.modalChartModeBtn.textContent = 'Vista puntos';
            this.modalChartModeBtn.title = 'Cambiar a gráfico de puntos';
        } else {
            this.modalChartModeBtn.textContent = 'Vista línea';
            this.modalChartModeBtn.title = 'Cambiar a gráfico de línea';
        }
    }

    filterClosedPositionsByPeriod(closedPositions, period) {
        if (!Array.isArray(closedPositions) || period === 'ALL') {
            return closedPositions;
        }

        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;
        const monthMs = 30 * dayMs;
        let cutoff = 0;

        if (period === 'DAY') {
            cutoff = now - dayMs;
        } else if (period === 'WEEK') {
            cutoff = now - weekMs;
        } else if (period === 'MONTH') {
            cutoff = now - monthMs;
        }

        return closedPositions.filter(pos => {
            const timestamp = (pos.closeTimestamp || pos.timestamp || 0) * 1000;
            return timestamp >= cutoff;
        });
    }

    async switchTab(tabId) {
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (activeTab) activeTab.classList.add('active');
        
        this.tabContents.forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add('active');
        
        this.activeTabId = tabId;

        if (!this.currentWallet) return;

        if (tabId === 'calendar') {
            await this.loadClosedPositionsData();
            this.renderCalendarTab();
        } else if (tabId === 'closed') {
            await this.loadClosedPositionsData();
        } else if (tabId === 'activity') {
            await this.loadActivityData();
        } else if (tabId === 'raw-activity') {
            await this.loadActivityData();
            this.activityTab?.renderRaw();
        } else if (tabId === 'raw-closed') {
            await this.loadClosedPositionsData();
            this.closedTab?.renderRaw();
        } else if (tabId === 'raw-positions') {
            this.renderRawPositions();
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
    }

    hideError() {
        this.errorMessage.classList.remove('show');
    }

    showLoading() {
        this.loading.classList.add('show');
    }

    hideLoading() {
        this.loading.classList.remove('show');
    }

    formatCurrency(value) {
        if (!value && value !== 0) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    async searchWallet() {
        const wallet = this.walletInput.value.trim();
        
        if (!wallet) {
            this.showError('Por favor ingresa una dirección de wallet');
            return;
        }

        if (!wallet.startsWith('0x') || wallet.length < 42) {
            this.showError('La dirección debe comenzar con 0x y tener al menos 42 caracteres');
            return;
        }

        this.presetBtns.forEach(btn => btn.classList.remove('active'));
        this.updateUrl(wallet);
        await this.loadWalletData(wallet);
        this.walletInput.value = '';
    }

    async loadWalletData(wallet) {
        this.hideError();
        this.showLoading();
        
        try {
            this.currentWallet = wallet;
            this.updateUrl(wallet);
            this.closedPositionsData = null;
            this.activityData = null;
            
            const [positions, lbDay, lbWeek, lbMonth, lbAll, traded] = await Promise.allSettled([
                this.api.getPositions(wallet),
                this.api.getLeaderboard(wallet, 'DAY'),
                this.api.getLeaderboard(wallet, 'WEEK'),
                this.api.getLeaderboard(wallet, 'MONTH'),
                this.api.getLeaderboard(wallet, 'ALL'),
                this.api.getTraded(wallet)
            ]);

            if (positions.status === 'fulfilled' && Array.isArray(positions.value)) {
                this.rawPositionsData = positions.value;
                this.renderPositions(positions.value);
            } else {
                this.rawPositionsData = null;
                this.renderPositions([]);
            }

            this.renderAnalysis([]);

            if (this.activeTabId === 'closed' || this.activeTabId === 'raw-closed' || this.activeTabId === 'calendar') {
                await this.loadClosedPositionsData();
            }

            if (this.activeTabId === 'activity' || this.activeTabId === 'raw-activity') {
                await this.loadActivityData();
            }

            // Procesar datos del leaderboard para cada período
            this.leaderboardData = {
                DAY: lbDay.status === 'fulfilled' ? lbDay.value : null,
                WEEK: lbWeek.status === 'fulfilled' ? lbWeek.value : null,
                MONTH: lbMonth.status === 'fulfilled' ? lbMonth.value : null,
                ALL: lbAll.status === 'fulfilled' ? lbAll.value : null
            };
            
            this.tradedCount = traded.status === 'fulfilled' ? traded.value : null;
            
            this.renderProfileCard();
            this.renderLeaderboardByPeriod('ALL');

        } catch (error) {
            this.showError(`Error al conectar con Polymarket API: ${error.message}`);
            console.error('Error:', error);
        } finally {
            this.hideLoading();
        }
    }

    async loadClosedPositionsData(forceReload = false) {
        if (!this.currentWallet) return;
        if (!forceReload && Array.isArray(this.closedPositionsData)) return;
        if (!this.closedTab) return;

        try {
            const closedPositions = await this.api.getClosedPositions(this.currentWallet, 50, 0);
            if (Array.isArray(closedPositions)) {
                this.closedPositionsData = closedPositions;
                this.closedTab.setRawData(closedPositions);
                this.renderAnalysis(closedPositions);
                if (this.activeTabId === 'closed') this.closedTab.render(closedPositions);
                if (this.activeTabId === 'raw-closed') this.closedTab.renderRaw();
                if (this.activeTabId === 'calendar') this.renderCalendarTab();
            } else {
                this.closedPositionsData = [];
                this.closedTab.setRawData(null);
                this.renderAnalysis([]);
                if (this.activeTabId === 'closed') this.closedTab.render([]);
                if (this.activeTabId === 'raw-closed') this.closedTab.renderRaw();
                if (this.activeTabId === 'calendar') this.renderCalendarTab();
            }
        } catch (error) {
            console.error('Error loading closed positions:', error);
            this.closedPositionsData = [];
            this.closedTab.setRawData(null);
            this.renderAnalysis([]);
            if (this.activeTabId === 'closed') this.closedTab.render([]);
            if (this.activeTabId === 'raw-closed') this.closedTab.renderRaw();
            if (this.activeTabId === 'calendar') this.renderCalendarTab();
        }
    }

    async loadActivityData(forceReload = false) {
        if (!this.currentWallet) return;
        if (!forceReload && Array.isArray(this.activityData)) return;
        if (!this.activityTab) return;

        try {
            const activity = await this.api.getActivity(this.currentWallet, 50, 0);
            if (Array.isArray(activity)) {
                this.activityData = activity;
                this.activityTab.setRawData(activity);
                if (this.activeTabId === 'activity') this.activityTab.render(activity);
                if (this.activeTabId === 'raw-activity') this.activityTab.renderRaw();
            } else {
                this.activityData = [];
                this.activityTab.setRawData(null);
                if (this.activeTabId === 'activity') this.activityTab.render([]);
                if (this.activeTabId === 'raw-activity') this.activityTab.renderRaw();
            }
        } catch (error) {
            console.error('Error loading activity data:', error);
            this.activityData = [];
            this.activityTab.setRawData(null);
            if (this.activeTabId === 'activity') this.activityTab.render([]);
            if (this.activeTabId === 'raw-activity') this.activityTab.renderRaw();
        }
    }

    renderPositions(positions) {
        if (!positions || positions.length === 0) {
            this.positionsBody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay posiciones abiertas para esta wallet</td></tr>';
            return;
        }

        // Agrupar posiciones por slug y calcular el cashPnl total por mercado
        const groupedBySlug = {};
        positions.forEach(pos => {
            const slug = pos.slug || '—';
            if (!groupedBySlug[slug]) {
                groupedBySlug[slug] = {
                    positions: [],
                    totalCashPnl: 0,
                    title: pos.title || slug
                };
            }
            groupedBySlug[slug].positions.push(pos);
            groupedBySlug[slug].totalCashPnl += (pos.cashPnl || 0);
        });

        let html = '';
        let isFirst = true;

        Object.entries(groupedBySlug).forEach(([slug, data]) => {
            const slugPositions = data.positions;
            const marketTotalCashPnl = data.totalCashPnl || 0;
            if (!isFirst) {
                html += '<tr class="group-separator"><td colspan="7"></td></tr>';
            }
            isFirst = false;

            slugPositions.forEach((pos, index) => {
                const size = pos.size || 0;
                const avgPrice = pos.avgPrice || 0;
                const initialValue = pos.initialValue || 0;
                const currentValue = pos.currentValue || 0;
                const cashPnl = pos.cashPnl || 0;
                const percentPnl = pos.percentPnl || 0;
                const title = pos.title || data.title || '—';
                const outcome = pos.outcome || '—';

                let ifWin = 0;
                if (slugPositions.length > 1) {
                    const otherPos = slugPositions.find((p, i) => i !== index);
                    if (otherPos) {
                        ifWin = size - initialValue - (otherPos.initialValue || 0);
                    }
                } else {
                    ifWin = size - initialValue;
                }

                const pnlClass = cashPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                const pnlSign = cashPnl >= 0 ? '+' : '';
                const percentSign = percentPnl >= 0 ? '+' : '';
                const ifWinClass = ifWin >= 0 ? 'pnl-positive' : 'pnl-negative';

                if (index === 0) {
                    const marketPnlClass = marketTotalCashPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                    const marketPnlSign = marketTotalCashPnl >= 0 ? '+' : '';
                    html += '<tr class="group-title"><td colspan="7" class="title-cell">' + title + ' <small class="market-total ' + marketPnlClass + '">(' + marketPnlSign + this.formatCurrency(Math.abs(marketTotalCashPnl)) + ')</small></td></tr>';
                }

                const curPrice = pos.curPrice || pos.currentValue || 0;
                let outcomeBadgeClass = 'positive';
                const outcomeText = outcome || '';
                const outcomeLower = outcomeText.toString().toLowerCase();
                if (outcomeLower.includes('up')) outcomeBadgeClass = 'positive';
                else if (outcomeLower.includes('down')) outcomeBadgeClass = 'negative';
                else outcomeBadgeClass = (pnlClass === 'pnl-positive' ? 'positive' : 'negative');
                html += '<tr><td><code class="slug">' + slug + '</code></td><td><span class="side-badge ' + outcomeBadgeClass + '">' + outcomeText + '</span></td><td class="text-right">' + size.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</td><td class="text-right"><div>' + this.formatCurrency(avgPrice) + '</div><small>(' + this.formatCurrency(curPrice) + ')</small></td><td class="text-right">' + this.formatCurrency(initialValue) + '</td><td class="text-right"><div><strong class="' + pnlClass + '">' + pnlSign + this.formatCurrency(Math.abs(cashPnl)) + '</strong></div><small class="' + pnlClass + '">' + percentSign + percentPnl.toFixed(2) + '%</small></td><td class="text-right"><strong class="' + ifWinClass + '">' + ifWin.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</strong></td></tr>';
            });
        });

        this.positionsBody.innerHTML = html;
    }

    renderLeaderboardByPeriod(period) {
        const data = this.leaderboardData[period];
        
        if (data && Array.isArray(data) && data.length > 0) {
            const userData = data[0];
            
            if (this.profileRank && userData.rank !== undefined) {
                this.profileRank.textContent = userData.rank;
            }
            
            if (this.profilePnl && userData.pnl !== undefined) {
                this.profilePnl.textContent = this.formatCurrency(userData.pnl);
            }
            
            if (this.profileVol && userData.vol !== undefined) {
                this.profileVol.textContent = this.formatCurrency(userData.vol);
            }
        } else {
            if (this.profileRank) this.profileRank.textContent = '—';
            if (this.profilePnl) this.profilePnl.textContent = '—';
            if (this.profileVol) this.profileVol.textContent = '—';
        }
    }

    renderProfileCard() {
        const allTimeData = this.leaderboardData['ALL'];
        
        if (allTimeData && Array.isArray(allTimeData) && allTimeData.length > 0) {
            const userData = allTimeData[0];
            
            if (this.profileName && userData.userName) {
                this.profileName.textContent = userData.userName;
            }

            if (this.profileWallet && this.currentWallet) {
                this.profileWallet.textContent = this.currentWallet;
                if (this.copyWalletBtn) {
                    this.copyWalletBtn.style.display = 'inline-block';
                }
                this.updateCurrentFavoriteButton();
            }

            if (this.profileImage) {
                if (userData.profileImage && userData.profileImage.trim() !== '') {
                    this.profileImage.src = userData.profileImage;
                } else {
                    this.profileImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"%3E%3Crect fill="%233b82f6" width="120" height="120"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="48" font-family="Arial"%3E?%3C/text%3E%3C/svg%3E';
                }
            }

            if (this.profileRank && userData.rank !== undefined) {
                this.profileRank.textContent = userData.rank;
            }

            if (this.profilePnl && userData.pnl !== undefined) {
                this.profilePnl.textContent = this.formatCurrency(userData.pnl);
            }

            if (this.profileVol && userData.vol !== undefined) {
                this.profileVol.textContent = this.formatCurrency(userData.vol);
            }
        }

        if (this.profileTrades && this.tradedCount) {
            let tradedValue = '—';
            if (this.tradedCount.traded !== undefined) {
                tradedValue = this.tradedCount.traded;
            } else if (typeof this.tradedCount === 'number') {
                tradedValue = this.tradedCount;
            }
            this.profileTrades.textContent = tradedValue;
        }

        this.updateCurrentFavoriteButton();
    }

    renderRawPositions() {
        if (!this.rawPositionsData) {
            this.rawPositionsContent.innerHTML = '<pre class="raw-empty">No hay datos de posiciones. Busca una wallet primero.</pre>';
            return;
        }

        const formattedData = {
            endpoint: '/positions',
            wallet: this.currentWallet,
            timestamp: new Date().toISOString(),
            count: Array.isArray(this.rawPositionsData) ? this.rawPositionsData.length : 0,
            data: this.rawPositionsData
        };

        const jsonString = JSON.stringify(formattedData, null, 2);
        this.rawPositionsContent.innerHTML = `<pre class="raw-json">${this.syntaxHighlight(jsonString)}</pre>`;
    }

    syntaxHighlight(json) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    renderAnalysis(closedPositions) {
        if (!closedPositions || closedPositions.length === 0) {
            if (this.analysisTotalValue) {
                this.analysisTotalValue.textContent = '—';
            }
            if (this.closedChart) {
                this.closedChart.destroy();
                this.closedChart = null;
            }
            return;
        }

        let grandTotal = 0;
        closedPositions.forEach(pos => {
            grandTotal += pos.realizedPnl || 0;
        });

        if (this.analysisTotalValue) {
            const totalColor = grandTotal >= 0 ? '#16a34a' : '#dc2626';
            const totalSign = grandTotal >= 0 ? '+' : '';
            this.analysisTotalValue.innerHTML = `<span style="color: ${totalColor};">${totalSign}${this.formatCurrency(grandTotal)}</span>`;
        }

        const filteredPositions = this.filterClosedPositionsByPeriod(closedPositions, this.currentLbPeriod);
        this.renderClosedChart(filteredPositions);
    }

    changeCalendarMonth(direction) {
        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        this.calendarDate = new Date(year, month + direction, 1);
        if (this.activeTabId === 'calendar') {
            this.renderCalendarTab();
        }
    }

    renderCalendarTab() {
        if (!this.calendarBody || !this.calendarTitle || !this.calendarWeekSummary) return;

        const today = new Date();
        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        const monthName = this.calendarDate.toLocaleDateString('es-ES', { month: 'long' });
        this.calendarTitle.textContent = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

        if (!this.closedPositionsData || this.closedPositionsData.length === 0) {
            this.calendarBody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay datos de posiciones cerradas para esta wallet.</td></tr>';
            this.calendarWeekSummary.innerHTML = '';
            return;
        }

        const parseTitleDateTime = (title) => {
            const dateTimeMatch = title.match(/([A-Za-z]+)\s+(\d+),\s*(\d+):(\d+)(AM|PM)/);
            if (!dateTimeMatch) return new Date(0);

            const monthStr = dateTimeMatch[1];
            const dayStr = dateTimeMatch[2];
            const hourStr = dateTimeMatch[3];
            const minuteStr = dateTimeMatch[4];
            const ampm = dateTimeMatch[5];

            const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
            const parsedMonth = months[monthStr.toLowerCase()];
            if (parsedMonth === undefined) return new Date(0);

            const day = parseInt(dayStr, 10);
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);
            let hour24 = hour;
            if (ampm === 'AM') {
                if (hour === 12) hour24 = 0;
            } else if (hour !== 12) {
                hour24 = hour + 12;
            }

            const yearFromTitle = new Date().getFullYear();
            return new Date(yearFromTitle, parsedMonth, day, hour24, minute);
        };

        const getCalendarDate = (pos) => {
            const titleDate = parseTitleDateTime(pos.title || '');
            if (!isNaN(titleDate.getTime())) {
                return titleDate;
            }
            const ts = Number(pos.closeTimestamp ?? pos.timestamp ?? 0) * 1000;
            const date = new Date(ts);
            return isNaN(date.getTime()) ? new Date(0) : date;
        };

        const profitByDay = new Map();
        const tradesByDay = new Map();
        this.closedPositionsData.forEach(pos => {
            const date = getCalendarDate(pos);
            if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month) return;
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const current = profitByDay.get(key) || 0;
            profitByDay.set(key, current + (pos.realizedPnl || 0));
            
            if (!tradesByDay.has(key)) {
                tradesByDay.set(key, []);
            }
            tradesByDay.get(key).push(pos);
        });

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7;

        const weekSums = [];
        let day = 1;
        let html = '';

        for (let week = 0; week < 6 && day <= lastDayOfMonth; week++) {
            html += '<tr>';
            for (let weekday = 0; weekday < 7; weekday++) {
                if (week === 0 && weekday < firstWeekday) {
                    html += '<td class="calendar-empty"></td>';
                } else if (day > lastDayOfMonth) {
                    html += '<td class="calendar-empty"></td>';
                } else {
                    const key = `${year}-${month}-${day}`;
                    const profit = profitByDay.get(key) || 0;
                    const profitClass = profit > 0 ? 'positive' : profit < 0 ? 'negative' : 'neutral';
                    html += `<td class="calendar-day ${profitClass}">`;
                    html += `<div class="calendar-day-number">${day}</div>`;
                    if (profit !== 0) {
                        html += `<div class="calendar-day-profit ${profitClass}">${profit > 0 ? '+' : ''}${this.formatCurrency(profit)}</div>`;
                    }
                    html += '</td>';
                    weekSums[week] = (weekSums[week] || 0) + profit;
                    day++;
                }
            }
            html += '</tr>';
        }

        this.calendarBody.innerHTML = html;

        // Add click listeners to calendar days
        const calendarDays = this.calendarBody.querySelectorAll('.calendar-day');
        calendarDays.forEach((cell, index) => {
            const dayNumber = parseInt(cell.querySelector('.calendar-day-number').textContent);
            const key = `${year}-${month}-${dayNumber}`;
            const trades = tradesByDay.get(key) || [];
            
            if (trades.length > 0) {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', () => {
                    this.showCalendarDayModal(dayNumber, month, year, trades);
                });
            }
        });

        const monthTotal = weekSums.reduce((sum, profit) => sum + (profit || 0), 0);
        const monthTotalClass = monthTotal > 0 ? 'pnl-positive' : monthTotal < 0 ? 'pnl-negative' : 'neutral';
        const weekHtml = `<div class="week-summary-row month-total"><span>Total mes</span><span class="${monthTotalClass}">${monthTotal > 0 ? '+' : ''}${this.formatCurrency(monthTotal)}</span></div>` +
            weekSums.map((profit, index) => {
                const profitClass = profit > 0 ? 'pnl-positive' : profit < 0 ? 'pnl-negative' : 'neutral';
                return `<div class="week-summary-row"><span>Semana ${index + 1}</span><span class="${profitClass}">${profit > 0 ? '+' : ''}${this.formatCurrency(profit)}</span></div>`;
            }).join('');

        this.calendarWeekSummary.innerHTML = weekHtml || '<div class="week-summary-row"><span>Sin datos</span></div>';
    }

    // main.js - Reemplazar SOLO el método renderClosedChart con este

    renderClosedChart(closedPositions) {
        const canvasElement = document.getElementById('closedChart');
        if (!canvasElement) return;
        const ctx = canvasElement.getContext('2d');

        if (this.closedChart) {
            this.closedChart.destroy();
            this.closedChart = null;
        }

        if (!closedPositions || closedPositions.length === 0) {
            return;
        }

        // Función para parsear fecha del título (extraer timestamp real)
        const parseTitleDateTime = (title) => {
            const dateTimeMatch = title.match(/([A-Za-z]+)\s+(\d+),\s*(\d+):(\d+)(AM|PM)/);
            if (!dateTimeMatch) return new Date(0);

            const monthStr = dateTimeMatch[1];
            const dayStr = dateTimeMatch[2];
            const hourStr = dateTimeMatch[3];
            const minuteStr = dateTimeMatch[4];
            const ampm = dateTimeMatch[5];

            const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
            const month = months[monthStr.toLowerCase()];
            if (month === undefined) return new Date(0);

            const day = parseInt(dayStr, 10);
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);

            let hour24 = hour;
            if (ampm === 'AM') {
                if (hour === 12) hour24 = 0;
            } else {
                if (hour !== 12) hour24 = hour + 12;
            }

            const year = new Date().getFullYear();
            return new Date(year, month, day, hour24, minute);
        };

        // Obtener timestamp real de la posición (priorizar closeTimestamp)
        const getRealTimestamp = (pos) => {
            const closeTs = pos.closeTimestamp || pos.timestamp;
            if (closeTs) return closeTs * 1000;
            // Si no tiene timestamp, usar el parseado del título
            return parseTitleDateTime(pos.title || '').getTime();
        };

        const sortedPositionsForChart = closedPositions.slice().sort((a, b) => {
            const dateA = parseTitleDateTime(a.title || '');
            const dateB = parseTitleDateTime(b.title || '');
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB; // Ascendente por title
            const titleA = (a.title || '').toString();
            const titleB = (b.title || '').toString();
            return titleA.localeCompare(titleB, 'en', { numeric: true, sensitivity: 'base' });
        });

        let cumulativeTotalPnl = 0;
        const timelineData = [];
        const labels = [];
        const pointColors = [];
        const marketDataPoints = [];

        sortedPositionsForChart.forEach(pos => {
            const parsedDate = parseTitleDateTime(pos.title || '');
            const dateStr = isNaN(parsedDate.getTime())
                ? '—'
                : parsedDate.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

            const realizedPnl = pos.realizedPnl || 0;
            cumulativeTotalPnl += realizedPnl;

            timelineData.push(cumulativeTotalPnl);
            labels.push(`${dateStr}\n${pos.slug || '—'}`);
            pointColors.push(realizedPnl >= 0 ? '#16a34a' : '#dc2626');
            marketDataPoints.push({
                slug: pos.slug || '—',
                title: pos.title || '—',
                realizedPnl,
                cumulativePnl: cumulativeTotalPnl,
                date: dateStr,
                outcome: pos.outcome || '—',
                timestamp: parsedDate.getTime()
            });
        });

        if (timelineData.length === 0) {
            if (this.analysisTotalValue) {
                this.analysisTotalValue.innerHTML = '<span style="color: #64748b;">Sin datos temporales</span>';
            }
            return;
        }

        this.closedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PnL Acumulado Total',
                    data: timelineData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.2,
                    fill: true,
                    pointRadius: this.chartMode === 'points' ? 6 : 0,
                    pointHoverRadius: this.chartMode === 'points' ? 8 : 0,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: 'transparent',
                    pointBorderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const pos = marketDataPoints[context.dataIndex];
                                const pnlSign = pos.realizedPnl >= 0 ? '+' : '-';
                                const pnlValue = Math.abs(pos.realizedPnl).toFixed(2);
                                const cumulativeSign = pos.cumulativePnl >= 0 ? '+' : '-';
                                const cumulativeValue = Math.abs(pos.cumulativePnl).toFixed(2);
                                return [
                                    `🏷️ ${pos.title}`,
                                    `💰 PnL Operación: ${pnlSign}$${pnlValue}`,
                                    `📊 PnL Acumulado: ${cumulativeSign}$${cumulativeValue}`
                                ];
                            },
                            title: function(context) {
                                const pos = marketDataPoints[context[0].dataIndex];
                                return `${pos.date} · ${pos.slug}`;
                            }
                        },
                        displayColors: false,
                        backgroundColor: '#0f172a',
                        titleColor: '#f1f5f9',
                        bodyColor: '#e2e8f0',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        ticks: { display: false },
                        grid: { display: true, color: 'rgba(226, 232, 240, 0.3)' }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(226, 232, 240, 0.5)' },
                        ticks: {
                            callback: function(value) {
                                const sign = value >= 0 ? '+' : '-';
                                return sign + '$' + Math.abs(value).toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    }

    // Modal functions for calendar day details
    showCalendarDayModal(day, month, year, trades) {
        if (!trades || trades.length === 0) return;

        const dateStr = new Date(year, month, day).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        this.modalDayTitle.textContent = `Trades del ${dateStr}`;
        this.updateModalChartModeButton();

        // Función para parsear fecha del título (extraer timestamp real)
        const parseTitleDateTime = (title) => {
            const dateTimeMatch = title.match(/([A-Za-z]+)\s+(\d+),\s*(\d+):(\d+)(AM|PM)/);
            if (!dateTimeMatch) return new Date(0);

            const monthStr = dateTimeMatch[1];
            const dayStr = dateTimeMatch[2];
            const hourStr = dateTimeMatch[3];
            const minuteStr = dateTimeMatch[4];
            const ampm = dateTimeMatch[5];

            const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
            const parsedMonth = months[monthStr.toLowerCase()];
            if (parsedMonth === undefined) return new Date(0);

            const day = parseInt(dayStr, 10);
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);
            let hour24 = hour;
            if (ampm === 'AM') {
                if (hour === 12) hour24 = 0;
            } else if (hour !== 12) {
                hour24 = hour + 12;
            }

            const yearFromTitle = new Date().getFullYear();
            return new Date(yearFromTitle, parsedMonth, day, hour24, minute);
        };

        const getCalendarDate = (pos) => {
            const titleDate = parseTitleDateTime(pos.title || '');
            if (!isNaN(titleDate.getTime())) {
                return titleDate;
            }
            const ts = Number(pos.closeTimestamp ?? pos.timestamp ?? 0) * 1000;
            const date = new Date(ts);
            return isNaN(date.getTime()) ? new Date(0) : date;
        };

        // Ordenar trades por fecha descendente (más reciente primero)
        const sortedTrades = trades.slice().sort((a, b) => {
            const dateA = getCalendarDate(a);
            const dateB = getCalendarDate(b);
            return dateB - dateA; // Descendente
        });

        if (this.modalDayPnl) {
            const totalDayPnl = sortedTrades.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);
            this.modalDayPnl.innerHTML = `PNL del día: ${this.closedTab.formatPNL(totalDayPnl)}`;
        }

        let html = '';
        sortedTrades.forEach(pos => {
            const timestamp = pos.closeTimestamp || pos.timestamp;
            const totalBought = pos.totalBought || pos.size || 0;
            const avgPrice = pos.avgPrice || 0;
            const investment = totalBought * avgPrice;
            const realizedPnl = pos.realizedPnl || 0;
            const outcomeText = pos.outcome || '—';
            const slug = pos.slug || '—';
            const title = pos.title || '—';

            // Determinar color del outcome
            const outcomeLower = outcomeText.toString().toLowerCase();
            let dotClass = 'positive';
            if (outcomeLower.includes('up')) dotClass = 'positive';
            else if (outcomeLower.includes('down')) dotClass = 'negative';
            else dotClass = realizedPnl >= 0 ? 'positive' : 'negative';

            html += `
                <tr>
                    <td><div class="trade-title">${title}</div><div class="trade-slug"><a href="https://polymarket.com/event/${slug}" target="_blank" rel="noopener noreferrer">${slug}</a></div></td>
                    <td><span class="side-badge ${dotClass}">${outcomeText}</span></td>
                    <td class="text-right"><strong>$${this.closedTab.formatNumber(investment)}</strong></td>
                    <td class="text-right">${this.closedTab.formatPriceInCents(avgPrice)}</td>
                    <td class="text-right">${this.closedTab.formatNumber(totalBought)}</td>
                    <td class="text-right">${this.closedTab.formatPNL(realizedPnl)}</td>
                </tr>`;
        });

        this.modalTradesBody.innerHTML = html;

        // Render chart for this day's trades
        this.renderModalDayChart(sortedTrades);

        this.calendarDayModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    renderModalDayChart(trades) {
        const canvasElement = document.getElementById('modalDayChart');
        if (!canvasElement) return;

        // Destroy existing chart if any
        if (this.modalDayChart) {
            this.modalDayChart.destroy();
            this.modalDayChart = null;
        }

        if (!trades || trades.length === 0) return;

        const ctx = canvasElement.getContext('2d');

        // Función para parsear fecha del título
        const parseTitleDateTime = (title) => {
            const dateTimeMatch = title.match(/([A-Za-z]+)\s+(\d+),\s*(\d+):(\d+)(AM|PM)/);
            if (!dateTimeMatch) return new Date(0);

            const monthStr = dateTimeMatch[1];
            const dayStr = dateTimeMatch[2];
            const hourStr = dateTimeMatch[3];
            const minuteStr = dateTimeMatch[4];
            const ampm = dateTimeMatch[5];

            const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
            const parsedMonth = months[monthStr.toLowerCase()];
            if (parsedMonth === undefined) return new Date(0);

            const day = parseInt(dayStr, 10);
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);
            let hour24 = hour;
            if (ampm === 'AM') {
                if (hour === 12) hour24 = 0;
            } else if (hour !== 12) {
                hour24 = hour + 12;
            }

            const yearFromTitle = new Date().getFullYear();
            return new Date(yearFromTitle, parsedMonth, day, hour24, minute);
        };

        const getTimestamp = pos => {
            const titleDate = parseTitleDateTime(pos.title || '');
            if (!isNaN(titleDate.getTime())) {
                return titleDate.getTime();
            }
            return Number(pos.closeTimestamp ?? pos.timestamp ?? 0) * 1000;
        };

        // Ordenar los trades de más antiguo a más reciente para que el más actual quede a la derecha
        const sortedForChart = trades.slice().sort((a, b) => getTimestamp(a) - getTimestamp(b));

        const timelineData = [];
        const labels = [];
        let accumulatedPnl = 0;

        sortedForChart.forEach((pos, index) => {
            const realizedPnl = pos.realizedPnl || 0;
            accumulatedPnl += realizedPnl;

            const titleDate = parseTitleDateTime(pos.title || '');
            const dateStr = !isNaN(titleDate.getTime()) 
                ? titleDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : this.closedTab.formatDate(pos.closeTimestamp || pos.timestamp);

            const totalBought = pos.totalBought || pos.size || 0;
            const avgPrice = pos.avgPrice || 0;
            const investment = totalBought * avgPrice;
            const outcomeText = pos.outcome || '—';
            const title = pos.title || '—';

            labels.push(`Trade ${index + 1}`);
            timelineData.push({
                y: accumulatedPnl,
                date: dateStr,
                slug: pos.slug || '—',
                pnl: realizedPnl,
                title: title,
                outcome: outcomeText,
                investment: investment,
                avgPrice: avgPrice,
                shares: totalBought
            });
        });

        this.lastModalTrades = trades.slice();
        this.modalDayChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'PNL Acumulado',
                    data: timelineData.map(point => point.y),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: false,
                    tension: 0.4,
                    showLine: true,
                    pointRadius: this.modalChartMode === 'points' ? 6 : 0,
                    pointHoverRadius: 8,
                    pointBackgroundColor: timelineData.map(point => point.pnl >= 0 ? '#10b981' : '#ef4444'),
                    pointBorderColor: timelineData.map(point => point.pnl >= 0 ? '#059669' : '#dc2626'),
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const dataPoint = timelineData[context[0].dataIndex];
                                return dataPoint.title;
                            },
                            label: function(context) {
                                const dataPoint = timelineData[context[0].dataIndex];
                                const accumulatedSign = context.parsed.y >= 0 ? '+' : '';
                                const tradeSign = dataPoint.pnl >= 0 ? '+' : '';
                                return [
                                    `Outcome: ${dataPoint.outcome}`,
                                    `Inversión: $${dataPoint.investment.toFixed(2)}`,
                                    `Avg Price: ${(dataPoint.avgPrice * 100).toFixed(1)}¢`,
                                    `Shares: ${dataPoint.shares.toFixed(2)}`,
                                    `PNL Trade: ${tradeSign}$${dataPoint.pnl.toFixed(2)}`,
                                    `PNL Acumulado: ${accumulatedSign}$${context.parsed.y.toFixed(2)}`
                                ];
                            }
                        },
                        displayColors: false,
                        backgroundColor: '#1e293b',
                        titleColor: '#f1f5f9',
                        bodyColor: '#e2e8f0',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        padding: 12,
                        titleFont: { weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        type: 'category',
                        ticks: { display: false },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(226, 232, 240, 0.5)' },
                        ticks: {
                            callback: function(value) {
                                const sign = value >= 0 ? '+' : '-';
                                return sign + '$' + Math.abs(value).toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    }

    closeCalendarDayModal() {
        this.calendarDayModal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
        
        // Destroy chart when closing modal
        if (this.modalDayChart) {
            this.modalDayChart.destroy();
            this.modalDayChart = null;
        }
    }
}

// Inicializar SOLO UNA VEZ
if (!window.app) {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            console.log('DOMContentLoaded - Iniciando App...');
            window.app = new App();
            console.log('App inicializada exitosamente');
        } catch (error) {
            console.error('Error al inicializar App:', error);
        }
    });
}
