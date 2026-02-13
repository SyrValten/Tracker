// closed.js - Lógica específica para Posiciones Cerradas
class ClosedPositionsTab {
    constructor(app) {
        this.app = app;
        this.tbody = document.getElementById('closedBody');
        this.rawContent = document.getElementById('rawClosedContent');
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

    // Formatear precio en cents (0.30 → 30¢)
    formatPriceInCents(price) {
        if (!price && price !== 0) return '0¢';
        if (price < 0.01) return '<1¢';
        return `${Math.round(price * 100)}¢`;
    }

    // Formatear precio normal para cálculos y Inv.
    formatPrice(price) {
        if (!price && price !== 0) return '0.00';
        return price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatPNL(value) {
        if (!value && value !== 0) return '$0.00';
        const formatted = `$${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
        const className = value >= 0 ? 'pnl-positive' : 'pnl-negative';
        return `<span class="${className}">${formatted}</span>`;
    }

    // Calcular inversión: totalBought × avgPrice (con el valor real, no el formateado)
    calculateInvestment(totalBought, avgPrice) {
        if (!totalBought || !avgPrice) return 0;
        return totalBought * avgPrice;
    }

    render(positions) {
        if (!positions || positions.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay posiciones cerradas para esta wallet</td></tr>';
            return;
        }

        const sortedPositions = [...positions].sort((a, b) => {
            const timeA = a.closeTimestamp || a.timestamp || 0;
            const timeB = b.closeTimestamp || b.timestamp || 0;
            return timeB - timeA;
        });

        // Agrupar por slug y calcular realizedPnl total
        const groupedBySlug = {};
        sortedPositions.forEach(pos => {
            const slug = pos.slug || '—';
            if (!groupedBySlug[slug]) {
                groupedBySlug[slug] = [];
            }
            groupedBySlug[slug].push(pos);
        });

        let html = '';
        let isFirst = true;

        Object.entries(groupedBySlug).forEach(([slug, slugPositions]) => {
            if (!isFirst) {
                html += '<tr class="group-separator"><td colspan="7"></td></tr>';
            }
            isFirst = false;

            // Calcular realizedPnl total del slug
            const totalRealizedPnl = slugPositions.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);
            const title = slugPositions[0].title || '—';
            const realizedPnlDisplay = this.formatPNL(totalRealizedPnl);

            // Fila de título con realizedPnl total
            html += `<tr class="group-title"><td colspan="7" class="title-cell">${title} <small class="market-total ${totalRealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">(${totalRealizedPnl >= 0 ? '+' : ''}${this.formatPNL(totalRealizedPnl).replace(/<span.*?>(.*)<\/span>/, '$1')})</small></td></tr>`;

            slugPositions.forEach(pos => {
                const timestamp = pos.closeTimestamp || pos.timestamp;
                const totalBought = pos.totalBought || pos.size || 0;
                const avgPrice = pos.avgPrice || 0;
                const investment = this.calculateInvestment(totalBought, avgPrice);

                // Añadir recuadro de color y emoji al lado del outcome según el realizedPnl de la posición
                const realizedPnl = pos.realizedPnl || 0;
                const outcomeText = pos.outcome || '—';
                const outcomeLower = outcomeText.toString().toLowerCase();
                let dotClass = 'positive';
                if (outcomeLower.includes('up')) dotClass = 'positive';
                else if (outcomeLower.includes('down')) dotClass = 'negative';
                else dotClass = realizedPnl >= 0 ? 'positive' : 'negative';
                html += `
            <tr>
                <td>${this.formatDate(timestamp)}</td>
                <td><code class="slug">${slug}</code></td>
                <td><span class="side-badge ${dotClass}">${outcomeText}</span></td>
                <td class="text-right"><strong>$${this.formatNumber(investment)}</strong></td>
                <td class="text-right">${this.formatPriceInCents(avgPrice)}</td>
                <td class="text-right">${this.formatNumber(totalBought)}</td>
                <td class="text-right">${this.formatPNL(pos.realizedPnl || 0)}</td>
            </tr>`;
            });
        });

        this.tbody.innerHTML = html;
    }

    renderRaw() {
        if (!this.rawData) {
            this.rawContent.innerHTML = '<pre class="raw-empty">No hay datos de posiciones cerradas. Busca una wallet primero.</pre>';
            return;
        }

        const formattedData = {
            endpoint: '/closed-positions',
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