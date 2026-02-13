// activity.js - Lógica específica para la pestaña de Actividad
class ActivityTab {
    constructor(app) {
        this.app = app;
        this.tbody = document.getElementById('activityBody');
        this.rawContent = document.getElementById('rawActivityContent');
        this.rawData = null;
    }

    setRawData(data) {
        this.rawData = data;
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

    formatUSDC(value) {
        if (!value && value !== 0) return '$0.00';
        return `$${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    // PRICE EN CENTS (0.61 → 61¢)
    formatPriceInCents(price) {
        if (!price && price !== 0) return '0¢';
        if (price < 0.01) return '<1¢';
        return `${Math.round(price * 100)}¢`;
    }

    render(activities) {
        if (!activities || activities.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay actividad reciente para esta wallet</td></tr>';
            return;
        }

        this.tbody.innerHTML = activities.map(act => {
            const usdcSize = act.usdcSize || (act.size * act.price) || 0;
            
            let side = '—';
            let sideClass = '';
            
            if (act.side) {
                side = act.side;
            } else if (act.type) {
                side = act.type;
            }
            
            if (side === 'BUY') sideClass = 'buy';
            else if (side === 'SELL') sideClass = 'sell';
            else if (side === 'REEDEM' || side === 'REDEEM') sideClass = 'reedem';
            
            const outcome = act.outcome || act.token || '—';
            const slug = act.slug || '—';
            
            // Formatear USDC según el side
            let usdcDisplay = '';
            let usdcClass = '';
            if (side === 'BUY') {
                usdcDisplay = '-' + this.formatUSDC(usdcSize);
                usdcClass = 'pnl-negative';
            } else if (side === 'REEDEM' || side === 'REDEEM') {
                usdcDisplay = this.formatUSDC(usdcSize);
                usdcClass = usdcSize >= 0 ? 'pnl-positive' : 'pnl-negative';
            } else {
                usdcDisplay = this.formatUSDC(usdcSize);
            }
            
            // Decide outcome badge color based on USDC PnL class so it matches the USDC column
            // Prefer outcome text mapping (Up/Down) for color; fallback to USDC class
            const outcomeTextRaw = outcome || '';
            const outcomeLower = outcomeTextRaw.toString().toLowerCase();
            let outcomeBadgeClass = '';
            if (outcomeLower.includes('up')) outcomeBadgeClass = 'positive';
            else if (outcomeLower.includes('down')) outcomeBadgeClass = 'negative';
            else outcomeBadgeClass = usdcClass === 'pnl-positive' ? 'positive' : (usdcClass === 'pnl-negative' ? 'negative' : '');

            return `
            <tr>
                <td>${this.formatDate(act.timestamp)}</td>
                <td><div>${act.title || '—'}</div><small style="color: #666;"><code>${slug}</code></small></td>
                <td><span class="side-badge ${sideClass}">${side}</span></td>
                <td><span class="side-badge ${outcomeBadgeClass}">${outcome}</span></td>
                <td class="text-right">${this.formatPriceInCents(act.price)}</td>
                <td class="text-right">${this.formatNumber(act.size)}</td>
                <td class="text-right" style="font-size: 1em; font-weight: 600;"><span style="color: ${usdcClass === 'pnl-positive' ? '#16a34a' : usdcClass === 'pnl-negative' ? '#dc2626' : 'inherit'};">${usdcDisplay}</span></td>
            </tr>
        `}).join('');
    }

    renderRaw() {
        if (!this.rawData) {
            this.rawContent.innerHTML = '<pre class="raw-empty">No hay datos de actividad. Busca una wallet primero.</pre>';
            return;
        }

        const formattedData = {
            endpoint: '/activity',
            wallet: this.app.currentWallet,
            timestamp: new Date().toISOString(),
            count: Array.isArray(this.rawData) ? this.rawData.length : 0,
            data: this.rawData
        };

        const jsonString = JSON.stringify(formattedData, null, 2);
        this.rawContent.innerHTML = `<pre class="raw-json">${this.syntaxHighlight(jsonString)}</pre>`;
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
}