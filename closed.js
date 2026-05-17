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

        // Agrupar por slug para mantener cada slot de tiempo separado
        const groupedBySlug = {};
        positions.forEach(pos => {
            const slug = pos.slug || '—';
            if (!groupedBySlug[slug]) {
                groupedBySlug[slug] = [];
            }
            groupedBySlug[slug].push(pos);
        });

        const getTimestamp = pos => Number(pos.closeTimestamp ?? pos.timestamp ?? 0);

        // Función para parsear fecha y hora del título
        const parseTitleDateTime = (title) => {
            const dateTimeMatch = title.match(/([A-Za-z]+)\s+(\d+),\s*(\d+):(\d+)(AM|PM)/);
            console.log(`Parsing title: "${title}" -> match:`, dateTimeMatch);
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
            console.log(`Parsed: ${monthStr} ${day}, ${hourStr}:${minuteStr}${ampm} -> ${date.toISOString()}`);
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

        const sortedMarketEntries = Object.entries(groupedBySlug)
            .map(([slug, slugPositions]) => {
                const title = slugPositions[0]?.title || '';
                const marketName = title.split(' - ')[0] || 'Unknown Market';
                const latestTimestamp = Math.max(...slugPositions.map(getTimestamp));
                
                // Extraer fecha del título para ordenar
                const titleDateTime = parseTitleDateTime(title);
                
                return { slug, slugPositions, marketName, latestTimestamp, titleDateTime };
            })
            .sort((a, b) => {
                // Primero ordenar por nombre de mercado alfabéticamente
                const marketCompare = a.marketName.localeCompare(b.marketName, 'en', { numeric: true, sensitivity: 'base' });
                if (marketCompare !== 0) return marketCompare;
                // Luego por fecha/hora del título descendente
                return b.titleDateTime - a.titleDateTime;
            });

        let html = '';
        let isFirst = true;

        sortedMarketEntries.forEach(({ slug, slugPositions, marketName }) => {
            console.log(`Sorting ${slugPositions.length} positions for slug: ${slug} (market: ${marketName})`);

            slugPositions.sort((a, b) => {
                const titleA = a.title || '';
                const titleB = b.title || '';

                const dateTimeA = parseTitleDateTime(titleA);
                const dateTimeB = parseTitleDateTime(titleB);

                console.log(`Comparing: "${titleA}" -> ${dateTimeA.toISOString()} vs "${titleB}" -> ${dateTimeB.toISOString()}`);

                // Ordenar descendente: más reciente primero
                return dateTimeB - dateTimeA;
            });
            console.log(`Sorted titles: ${slugPositions.map(p => p.title).join(', ')}`);

            if (!isFirst) {
                html += '<tr class="group-separator"><td colspan="7"></td></tr>';
            }
            isFirst = false;

            const titleGroups = groupedByTitleInSlug(slugPositions);
            titleGroups.forEach(([groupTitle, positions]) => {
                const groupPnl = this.app && typeof this.app.getGroupedPnl === 'function'
                    ? this.app.getGroupedPnl(positions)
                    : positions.reduce((sum, pos) => sum + (pos.realizedPnl || 0), 0);
                const groupPnlSign = groupPnl >= 0 ? '+' : '-';
                const groupPnlClass = groupPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                html += `<tr class="group-title"><td colspan="7" class="title-cell">${groupTitle} <small class="market-total ${groupPnlClass}">(${groupPnlSign}${this.formatPNL(groupPnl).replace(/<span.*?>(.*)<\/span>/, '$1')})</small></td></tr>`;

                positions.forEach(pos => {
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
                <td><a href="https://polymarket.com/event/${slug}" target="_blank" rel="noopener noreferrer"><code class="slug">${slug}</code></a></td>
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
