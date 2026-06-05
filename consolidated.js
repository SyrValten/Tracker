// consolidated.js - Lógica específica para la pestaña Consolidado (Posiciones Abiertas + Cerradas)
class ConsolidatedTab {
    constructor(app) {
        this.app = app;
        this.tbody = document.getElementById('consolidatedBody');
        this.rawData = {
            openPositions: null,
            closedPositions: null
        };
    }

    setRawData(openPositions, closedPositions) {
        this.rawData.openPositions = openPositions;
        this.rawData.closedPositions = closedPositions;
    }

    formatDate(seconds) {
        if (!seconds) return '—';
        const date = new Date(seconds * 1000);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatNumber(value) {
        if (!value && value !== 0) return '0.00';
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatPriceInCents(price) {
        if (!price && price !== 0) return '0¢';
        if (price < 0.01) return '<1¢';
        return `${Math.round(price * 100)}¢`;
    }

    formatCurrency(value) {
        if (!value && value !== 0) return '$0.00';
        return `$${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    formatPNL(value) {
        if (!value && value !== 0) return '$0.00';
        const sign = value >= 0 ? '+' : '-';
        const formatted = `${sign}$${Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
        const className = value >= 0 ? 'pnl-positive' : 'pnl-negative';
        return `<span class="${className}">${formatted}</span>`;
    }

    calculateInvestment(totalBought, avgPrice) {
        if (!totalBought || !avgPrice) return 0;
        return totalBought * avgPrice;
    }

    getUnrealizedPnl(openPos) {
        const initialValue = openPos.initialValue || 0;
        const currentValue = openPos.currentValue || 0;
        return currentValue - initialValue;
    }

    getOpenInvestment(openPos) {
        return openPos.initialValue || 0;
    }

    parseTitleDateTime(title) {
        if (!title) return 0;
        
        const match = title.match(/([A-Za-z]+)\s+(\d+),\s*(\d+):(\d+)(AM|PM)/i);
        if (!match) return 0;
        
        const monthStr = match[1];
        const day = parseInt(match[2], 10);
        const hour = parseInt(match[3], 10);
        const minute = parseInt(match[4], 10);
        const ampm = match[5].toUpperCase();
        
        const months = {
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        let month = months[monthStr.toLowerCase()];
        if (month === undefined) return 0;
        
        let hour24 = hour;
        if (ampm === 'AM') {
            if (hour === 12) hour24 = 0;
        } else {
            if (hour !== 12) hour24 = hour + 12;
        }
        
        const year = new Date().getFullYear();
        const date = new Date(year, month, day, hour24, minute);
        
        if (date > new Date()) {
            date.setFullYear(year - 1);
        }
        
        return date.getTime();
    }

    getItemTimestamp(item) {
        if (item.type === 'closed' && item.closeTimestamp) {
            return item.closeTimestamp * 1000;
        }
        if (item.title) {
            const titleTime = this.parseTitleDateTime(item.title);
            if (titleTime > 0) return titleTime;
        }
        return 0;
    }

    render(openPositions, closedPositions) {
        if ((!openPositions || openPositions.length === 0) && (!closedPositions || closedPositions.length === 0)) {
            this.tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay posiciones abiertas ni cerradas para esta wallet</td></tr>';
            return;
        }

        const marketMap = new Map();

        if (closedPositions && closedPositions.length > 0) {
            closedPositions.forEach(pos => {
                const slug = pos.slug || '—';
                if (!marketMap.has(slug)) {
                    marketMap.set(slug, {
                        slug: slug,
                        title: pos.title || slug,
                        items: []
                    });
                }
                
                const totalBought = pos.totalBought || pos.size || 0;
                const avgPrice = pos.avgPrice || 0;
                const investment = this.calculateInvestment(totalBought, avgPrice);
                const realizedPnl = pos.realizedPnl || 0;
                
                marketMap.get(slug).items.push({
                    closeTimestamp: pos.closeTimestamp,
                    timestamp: pos.timestamp,
                    outcome: pos.outcome || '—',
                    investment: investment,
                    avgPrice: avgPrice,
                    shares: totalBought,
                    pnl: realizedPnl,
                    type: 'closed',
                    title: pos.title,
                    slug: slug
                });
            });
        }

        if (openPositions && openPositions.length > 0) {
            openPositions.forEach(pos => {
                const slug = pos.slug || '—';
                if (!marketMap.has(slug)) {
                    marketMap.set(slug, {
                        slug: slug,
                        title: pos.title || slug,
                        items: []
                    });
                }
                
                const investment = this.getOpenInvestment(pos);
                const unrealizedPnl = this.getUnrealizedPnl(pos);
                
                marketMap.get(slug).items.push({
                    outcome: pos.outcome || '—',
                    investment: investment,
                    avgPrice: pos.avgPrice || 0,
                    shares: pos.size || 0,
                    pnl: unrealizedPnl,
                    type: 'open',
                    title: pos.title,
                    slug: slug,
                    curPrice: pos.curPrice || pos.currentValue || 0,
                    closeTimestamp: null,
                    timestamp: null
                });
            });
        }

        const sortedMarkets = Array.from(marketMap.values()).sort((a, b) => {
            const maxTimestampA = Math.max(...a.items.map(item => this.getItemTimestamp(item)));
            const maxTimestampB = Math.max(...b.items.map(item => this.getItemTimestamp(item)));
            return maxTimestampB - maxTimestampA;
        });

        let html = '';
        let isFirst = true;

        const normalizeTitle = (title) => {
            if (!title && title !== 0) return '—';
            return title.toString().trim().replace(/\s+/g, ' ');
        };

        const groupByTitle = (items) => {
            return items.reduce((groups, item) => {
                const key = normalizeTitle(item.title || '—');
                if (!groups[key]) groups[key] = { title: item.title || '—', items: [] };
                groups[key].items.push(item);
                return groups;
            }, {});
        };

        const getTradeShares = (item) => Number(item.shares ?? item.totalBought ?? item.size ?? 0);
        const getTradeInvestment = (item) => Math.abs(getTradeShares(item)) * Number(item.avgPrice || 0);
        const getTradeSide = (item) => {
            const text = (item.outcome || '').toString().toLowerCase();
            if (text.includes('up')) return 'up';
            if (text.includes('down')) return 'down';
            return '';
        };
        const getGroupPnl = (items) => {
            if (items.length === 2) {
                const sharesA = getTradeShares(items[0]);
                const sharesB = getTradeShares(items[1]);
                const absSharesA = Math.abs(sharesA);
                const absSharesB = Math.abs(sharesB);
                const sideA = getTradeSide(items[0]);
                const sideB = getTradeSide(items[1]);
                if (absSharesA > 0 && Math.abs(absSharesA - absSharesB) < 0.001 && sideA && sideB && sideA !== sideB) {
                    const totalInvestment = getTradeInvestment(items[0]) + getTradeInvestment(items[1]);
                    return absSharesA - totalInvestment;
                }
            }
            return items.reduce((sum, item) => sum + (item.pnl || 0), 0);
        };

        sortedMarkets.forEach(market => {
            const sortedItems = market.items.sort((a, b) => {
                const timestampA = this.getItemTimestamp(a);
                const timestampB = this.getItemTimestamp(b);
                return timestampB - timestampA;
            });

            const titleGroups = groupByTitle(sortedItems);
            const totalPnl = Object.values(titleGroups).reduce((sum, group) => {
                return sum + getGroupPnl(group.items);
            }, 0);
            const totalPnlSign = totalPnl >= 0 ? '+' : '-';
            const totalPnlFormatted = `${totalPnlSign}$${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const totalPnlClass = totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative';

            if (!isFirst) {
                html += '<tr class="group-separator"><td colspan="7"></td></tr>';
            }
            isFirst = false;

            html += `<tr class="group-title"><td colspan="7" class="title-cell">${market.title} <small class="market-total ${totalPnlClass}">(${totalPnlFormatted})</small></td></tr>`;

            Object.entries(titleGroups).forEach(([groupKey, group]) => {
                const displayGroupTitle = group.title || groupKey;
                const groupPnl = getGroupPnl(group.items);
                const groupPnlSign = groupPnl >= 0 ? '+' : '-';
                const groupPnlClass = groupPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                // Avoid repeating the market title as a group header when they're identical
                if (displayGroupTitle !== market.title) {
                    html += `<tr class="group-title"><td colspan="7" class="title-cell">${displayGroupTitle} <small class="market-total ${groupPnlClass}">(${groupPnlSign}${this.formatPNL(groupPnl).replace(/<span.*?>(.*)<\/span>/, '$1')})</small></td></tr>`;
                }

                group.items.forEach(item => {
                    const outcomeLower = (item.outcome || '').toString().toLowerCase();
                    let outcomeClass = '';
                    if (outcomeLower.includes('up')) outcomeClass = 'positive';
                    else if (outcomeLower.includes('down')) outcomeClass = 'negative';
                    else outcomeClass = item.pnl >= 0 ? 'positive' : 'negative';

                    let dateDisplay = '';
                    if (item.type === 'closed' && item.closeTimestamp) {
                        dateDisplay = this.formatDate(item.closeTimestamp);
                    } else {
                        const titleTime = this.parseTitleDateTime(item.title);
                        if (titleTime > 0) {
                            const date = new Date(titleTime);
                            dateDisplay = date.toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        } else {
                            dateDisplay = '<span class="open-badge">🟢 Abierta</span>';
                        }
                    }

                    let avgPriceDisplay = '';
                    if (item.type === 'open') {
                        avgPriceDisplay = `${this.formatPriceInCents(item.avgPrice)}<br><small style="color: #666;">(${this.formatPriceInCents(item.curPrice)})</small>`;
                    } else {
                        avgPriceDisplay = this.formatPriceInCents(item.avgPrice);
                    }

                    const pnlSign = item.pnl >= 0 ? '+' : '-';
                    const pnlFormatted = `${pnlSign}$${Math.abs(item.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    const pnlColor = item.pnl >= 0 ? '#16a34a' : '#dc2626';

                    html += `
                        <tr class="${item.type}-row">
                            <td>${dateDisplay}</td>
                            <td><code class="slug">${market.slug}</code></td>
                            <td><span class="side-badge ${outcomeClass}">${item.outcome}</span></td>
                            <td class="text-right"><strong>${this.formatCurrency(item.investment)}</strong></td>
                            <td class="text-right">${avgPriceDisplay}</td>
                            <td class="text-right">${this.formatNumber(item.shares)}</td>
                            <td class="text-right"><span style="color: ${pnlColor}; font-weight: 600;">${pnlFormatted}</span></td>
                        </tr>
                    `;
                });
            });
        });

        this.tbody.innerHTML = html;
    }
}