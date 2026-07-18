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

        // Agrupar por EVENTO (cada slot de tiempo sigue separado gracias a que
        // la clave incluye la fecha de cierre). Así las 3 patas de un partido
        // 1x2 caen en el mismo bloque en vez de quedar dispersas por la tabla.
        const eventKey = (pos) => (this.app && typeof this.app.getEventKey === 'function')
            ? this.app.getEventKey(pos)
            : (pos.slug || '—');
        const groupedBySlug = {};
        positions.forEach(pos => {
            const key = eventKey(pos);
            if (!groupedBySlug[key]) {
                groupedBySlug[key] = [];
            }
            groupedBySlug[key].push(pos);
        });

        // Función para parsear fecha y hora del título (fallback si no hay timestamp)
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

            // Convertir a 24 horas
            let hour24 = hour;
            if (ampm === 'AM') {
                if (hour === 12) hour24 = 0;
            } else { // PM
                if (hour !== 12) hour24 = hour + 12;
            }

            const year = new Date().getFullYear(); // Asumir año actual
            const date = new Date(year, month, day, hour24, minute);
            return date;
        };

        const groupedByTitleInSlug = (slugPositions) => {
            return Object.entries(slugPositions.reduce((groups, pos) => {
                const title = pos.title || '—';
                if (!groups[title]) groups[title] = [];
                groups[title].push(pos);
                return groups;
            }, {}));
        };

        // Para ordenar cada mercado usamos el timestamp REAL de cierre (closeTimestamp),
        // que siempre existe, en lugar de parsear el título (que puede fallar y enterrar
        // los trades más recientes). Así coincide con la pestaña Consolidado.
        const getMarketTime = (pos) => {
            const ts = Number(pos.closeTimestamp ?? pos.timestamp ?? 0);
            if (ts > 0) return ts * 1000;
            const titleTime = parseTitleDateTime(pos.title || '').getTime();
            return titleTime > 0 ? titleTime : 0;
        };

        const sortedMarketEntries = Object.entries(groupedBySlug)
            .map(([slug, slugPositions]) => {
                const title = slugPositions[0]?.title || '';
                const marketName = title.split(' - ')[0] || 'Unknown Market';
                const latestTimestamp = Math.max(...slugPositions.map(getMarketTime));
                return { slug, slugPositions, marketName, latestTimestamp };
            })
            // Ordenar por fecha más reciente primero (newest first), como Consolidado
            .sort((a, b) => b.latestTimestamp - a.latestTimestamp);

        let html = '';
        let isFirst = true;

        sortedMarketEntries.forEach(({ slug, slugPositions, marketName }) => {
            const isEvent = this.app && typeof this.app.isMultiLegEvent === 'function'
                && this.app.isMultiLegEvent(slugPositions);
            if (isEvent) {
                // Orden 1x2 dentro del partido (local, visitante, empate).
                slugPositions.sort((a, b) => this.app.getLegOrder(a) - this.app.getLegOrder(b));
            } else {
                // Más reciente primero, usando el timestamp real de cierre
                slugPositions.sort((a, b) => getMarketTime(b) - getMarketTime(a));
            }

            if (!isFirst) {
                html += '<tr class="group-separator"><td colspan="7"></td></tr>';
            }
            isFirst = false;

            // Cabecera del partido cuando el bloque tiene varias patas (1x2),
            // con el PnL agregado del evento entero.
            if (this.app && typeof this.app.isMultiLegEvent === 'function'
                && this.app.isMultiLegEvent(slugPositions)) {
                const evPnl = slugPositions.reduce((s, p) => s + (p.realizedPnl || 0), 0);
                const evClass = evPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                const evName = this.app.getEventTitle(slugPositions);
                html += `<tr class="group-title event-title"><td colspan="7" class="title-cell">⚽ ${evName}
                    <small class="market-total ${evClass}">(${evPnl >= 0 ? '+' : '-'}$${this.formatNumber(Math.abs(evPnl))})</small>
                    <small class="market-total">· ${slugPositions.length} patas</small></td></tr>`;
            }

            const titleGroups = groupedByTitleInSlug(slugPositions);
            titleGroups.forEach(([groupTitle, positions]) => {
                const groupPnl = this.app && typeof this.app.getGroupedPnl === 'function'
                    ? this.app.getGroupedPnl(positions)
                    : positions.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);
                const groupPnlSign = groupPnl >= 0 ? '+' : '-';
                const groupPnlClass = groupPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                html += `<tr class="group-title"><td colspan="7" class="title-cell">${groupTitle} <small class="market-total ${groupPnlClass}">(${groupPnlSign}$${this.formatNumber(Math.abs(groupPnl))})</small></td></tr>`;

                positions.forEach(pos => {
                    const timestamp = pos.closeTimestamp || pos.timestamp;
                    const totalBought = pos.totalBought || pos.size || 0;
                    const avgPrice = pos.avgPrice || 0;
                    const investment = this.calculateInvestment(totalBought, avgPrice);

                    const realizedPnl = pos.realizedPnl || 0;
                    const outcomeText = pos.outcome || '—';

                    // Color del badge: verde si esta posición ganó dinero, rojo si perdió
                    const dotClass = realizedPnl >= 0 ? 'positive' : 'negative';

                    html += `
            <tr>
                <td>${this.formatDate(timestamp)}</td>
                <td><a href="https://polymarket.com/event/${pos.eventSlug || pos.slug || slug}" target="_blank" rel="noopener noreferrer"><code class="slug">${pos.slug || slug}</code></a></td>
                <td><span class="side-badge ${dotClass}">${outcomeText}</span></td>
                <td class="text-right"><strong>$${this.formatNumber(investment)}</strong></td>
                <td class="text-right">${this.formatPriceInCents(avgPrice)}</td>
                <td class="text-right">${this.formatNumber(totalBought)}</td>
                <td class="text-right">${this.formatPNL(pos.realizedPnl || 0)}</td>
            </tr>`;
                });
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