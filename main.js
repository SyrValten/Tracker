// main.js - Controlador principal CORREGIDO
class App {
    constructor() {
        console.log('App constructor - iniciando...');
        this.api = new PolymarketAPI();
        this.currentWallet = null;
        this.currentLbPeriod = 'ALL';  // ALL por defecto
        this.leaderboardData = {}; // { DAY, WEEK, MONTH, ALL }
        this.tradedCount = null;
        
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
        
        this.initEventListeners();
        console.log('initEventListeners completado');
    }

    initElements() {
        this.walletInput = document.getElementById('walletInput');
        this.searchBtn = document.getElementById('searchBtn');
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
        this.closedChart = null;
        this.closedChartCtx = null;
        this.closedPositionsData = null;
        
        this.lbTabButtons = document.querySelectorAll('.lb-tab-button');
        this.loading = document.getElementById('loading');
        this.errorMessage = document.getElementById('errorMessage');
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.rawPositionsContent = document.getElementById('rawPositionsContent');
        this.rawPositionsData = null;
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
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = button.dataset.tab;
                this.switchTab(tabId);
            });
        });

        this.lbTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const period = btn.dataset.period;
                this.switchLeaderboardPeriod(period);
            });
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
    }

    switchTab(tabId) {
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (activeTab) activeTab.classList.add('active');
        
        this.tabContents.forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add('active');
        
        if (this.currentWallet) {
            if (tabId === 'raw-activity') this.activityTab.renderRaw();
            else if (tabId === 'raw-closed') this.closedTab.renderRaw();
            else if (tabId === 'raw-positions') this.renderRawPositions();
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
        await this.loadWalletData(wallet);
    }

    async loadWalletData(wallet) {
        this.hideError();
        this.showLoading();
        
        try {
            this.currentWallet = wallet;
            
            const [positions, closedPositions, activity, lbDay, lbWeek, lbMonth, lbAll, traded] = await Promise.allSettled([
                this.api.getPositions(wallet),
                this.api.getClosedPositions(wallet),
                this.api.getActivity(wallet),
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

            if (closedPositions.status === 'fulfilled' && Array.isArray(closedPositions.value)) {
                this.closedPositionsData = closedPositions.value;
                this.closedTab.setRawData(closedPositions.value);
                this.closedTab.render(closedPositions.value);
                this.renderAnalysis(closedPositions.value);
            } else {
                this.closedPositionsData = null;
                this.closedTab.setRawData(null);
                this.closedTab.render([]);
                this.renderAnalysis([]);
            }

            if (activity.status === 'fulfilled' && Array.isArray(activity.value)) {
                this.activityTab.setRawData(activity.value);
                this.activityTab.render(activity.value);
            } else {
                this.activityTab.setRawData(null);
                this.activityTab.render([]);
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
                    // Mostrar título de mercado y total cashPnl del mercado
                    const marketPnlClass = marketTotalCashPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                    const marketPnlSign = marketTotalCashPnl >= 0 ? '+' : '';
                    html += '<tr class="group-title"><td colspan="7" class="title-cell">' + title + ' <small class="market-total ' + marketPnlClass + '">(' + marketPnlSign + this.formatCurrency(Math.abs(marketTotalCashPnl)) + ')</small></td></tr>';
                }

                const curPrice = pos.curPrice || pos.currentValue || 0;
                // Mostrar un pequeño recuadro de color según el cashPnl de la posición, similar a la pestaña Activity
                // Mostrar un pequeño recuadro coloreado igual que .side-badge (sin texto)
                // Decide badge color based on the outcome text (Up/Down). If unclear, fall back to pnlClass.
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
            
            // Actualizar rango
            if (this.profileRank && userData.rank !== undefined) {
                this.profileRank.textContent = userData.rank;
            }
            
            // Actualizar PNL
            if (this.profilePnl && userData.pnl !== undefined) {
                this.profilePnl.textContent = this.formatCurrency(userData.pnl);
            }
            
            // Actualizar volumen
            if (this.profileVol && userData.vol !== undefined) {
                this.profileVol.textContent = this.formatCurrency(userData.vol);
            }
        } else {
            // Si no hay datos para este período, mostrar guiones
            if (this.profileRank) this.profileRank.textContent = '—';
            if (this.profilePnl) this.profilePnl.textContent = '—';
            if (this.profileVol) this.profileVol.textContent = '—';
        }
    }

    renderProfileCard() {
        // Obtener datos del leaderboard All Time
        const allTimeData = this.leaderboardData['ALL'];
        
        if (allTimeData && Array.isArray(allTimeData) && allTimeData.length > 0) {
            const userData = allTimeData[0];
            
            // Mostrar nombre de usuario
            if (this.profileName && userData.userName) {
                this.profileName.textContent = userData.userName;
            }

            // Mostrar wallet
            if (this.profileWallet && this.currentWallet) {
                this.profileWallet.textContent = this.currentWallet;
            }

            // Mostrar imagen - usar profileImage del API o placeholder
            if (this.profileImage) {
                if (userData.profileImage && userData.profileImage.trim() !== '') {
                    this.profileImage.src = userData.profileImage;
                } else {
                    // Usar placeholder si no hay imagen
                    this.profileImage.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"%3E%3Crect fill="%233b82f6" width="120" height="120"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="white" font-size="48" font-family="Arial"%3E?%3C/text%3E%3C/svg%3E';
                }
            }

            // Mostrar rango
            if (this.profileRank && userData.rank !== undefined) {
                this.profileRank.textContent = userData.rank;
            }

            // Mostrar PNL
            if (this.profilePnl && userData.pnl !== undefined) {
                this.profilePnl.textContent = this.formatCurrency(userData.pnl);
            }

            // Mostrar volumen
            if (this.profileVol && userData.vol !== undefined) {
                this.profileVol.textContent = this.formatCurrency(userData.vol);
            }
        }

        // Mostrar número de trades
        if (this.profileTrades && this.tradedCount) {
            let tradedValue = '—';
            if (this.tradedCount.traded !== undefined) {
                tradedValue = this.tradedCount.traded;
            } else if (typeof this.tradedCount === 'number') {
                tradedValue = this.tradedCount;
            }
            this.profileTrades.textContent = tradedValue;
        }
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

	// Reemplaza COMPLETAMENTE estos dos métodos en main.js

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

		// Agrupar por slug y calcular totales
		const slugTotals = {};
		const slugHistory = {};
		let grandTotal = 0;

		closedPositions.forEach(pos => {
			const slug = pos.slug || '—';
			const realizedPnl = pos.realizedPnl || 0;
			const timestamp = pos.closeTimestamp || pos.timestamp || 0;

			if (!slugTotals[slug]) {
				slugTotals[slug] = 0;
				slugHistory[slug] = [];
			}
			slugTotals[slug] += realizedPnl;
			slugHistory[slug].push({ timestamp, realizedPnl });
			grandTotal += realizedPnl;
		});

		// Mostrar el total en el encabezado
		if (this.analysisTotalValue) {
			const totalColor = grandTotal >= 0 ? '#16a34a' : '#dc2626';
			const totalSign = grandTotal >= 0 ? '+' : '';
			this.analysisTotalValue.innerHTML = `<span style="color: ${totalColor};">${totalSign}${this.formatCurrency(grandTotal)}</span>`;
		}

		// Preparar datos para el gráfico de evolución temporal
		this.renderClosedChart(closedPositions);
	}

	renderClosedChart(closedPositions) {
		const canvasElement = document.getElementById('closedChart');
		if (!canvasElement) return;

		const ctx = canvasElement.getContext('2d');
		
		if (this.closedChart) {
			this.closedChart.destroy();
		}

		// 1. Agrupar por slug y calcular el PnL TOTAL de cada mercado
		const markets = {};
		closedPositions.forEach(pos => {
			const slug = pos.slug || '—';
			if (!markets[slug]) {
				markets[slug] = {
					slug: slug,
					title: pos.title || slug,
					totalPnl: 0,
					closeTimestamp: 0,
					positions: []
				};
			}
			markets[slug].totalPnl += (pos.realizedPnl || 0);
			markets[slug].positions.push(pos);
			
			// Usar el timestamp más reciente como fecha de cierre del mercado
			const timestamp = pos.closeTimestamp || pos.timestamp || 0;
			if (timestamp > markets[slug].closeTimestamp) {
				markets[slug].closeTimestamp = timestamp;
			}
		});

		// 2. Convertir a array y ordenar por fecha de cierre
		const marketList = Object.values(markets)
			.filter(m => m.closeTimestamp > 0)
			.sort((a, b) => a.closeTimestamp - b.closeTimestamp);

		// 3. Calcular PnL acumulado TOTAL (todos los mercados)
		let cumulativeTotalPnl = 0;
		const timelineData = [];
		const labels = [];
		const pointColors = [];
		const marketDataPoints = [];

		marketList.forEach(market => {
			cumulativeTotalPnl += market.totalPnl;
			
			// Formatear fecha
			const date = new Date(market.closeTimestamp * 1000);
			const dateStr = date.toLocaleDateString('es-ES', {
				day: '2-digit',
				month: '2-digit',
				year: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
			
			timelineData.push(cumulativeTotalPnl);
			labels.push(`${dateStr}\n${market.slug}`);
			
			// Color basado en el PnL TOTAL del mercado
			pointColors.push(market.totalPnl >= 0 ? '#16a34a' : '#dc2626');
			
			// Guardar datos para el tooltip
			marketDataPoints.push({
				slug: market.slug,
				title: market.title,
				totalPnl: market.totalPnl,
				cumulativePnl: cumulativeTotalPnl,
				date: dateStr,
				positionCount: market.positions.length
			});
		});

		// Si no hay datos, salir
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
					pointRadius: 6,
					pointHoverRadius: 8,
					pointBackgroundColor: pointColors,
					pointBorderColor: 'white',
					pointBorderWidth: 2
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const market = marketDataPoints[context.dataIndex];
								
								// Formatear PnL del mercado
								const marketSign = market.totalPnl >= 0 ? '+' : '-';
								const marketValue = Math.abs(market.totalPnl).toFixed(2);
								
								// Formatear PnL acumulado
								const cumulativeSign = market.cumulativePnl >= 0 ? '+' : '-';
								const cumulativeValue = Math.abs(market.cumulativePnl).toFixed(2);
								
								return [
									`🏷️ ${market.title}`,
									`💰 PnL Mercado: ${marketSign}$${marketValue}`,
									`📊 PnL Acumulado: ${cumulativeSign}$${cumulativeValue}`,
									`🔄 Operaciones: ${market.positionCount}`
								];
							},
							title: function(context) {
								const market = marketDataPoints[context[0].dataIndex];
								return `${market.date} · ${market.slug}`;
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
						grid: {
							display: true,
							color: 'rgba(226, 232, 240, 0.3)'
						}
					},
					y: {
						beginAtZero: true,
						grid: {
							color: 'rgba(226, 232, 240, 0.5)'
						},
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