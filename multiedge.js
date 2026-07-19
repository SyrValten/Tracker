// multiedge.js - Pestaña "Estrategia Multi Edge"
//
// Agrupa por VENTANA TEMPORAL en vez de por mercado: todas las operaciones que
// comparten el mismo slot se ven juntas aunque sean de activos distintos.
// Ejemplo: sol-updown-5m-1784474700 y btc-updown-5m-1784474700 son el mismo
// momento (July 19, 11:25AM-11:30AM ET) sobre Solana y Bitcoin; por separado no
// se ve la jugada, juntos se ve el resultado neto de la ventana.
//
// La clave es el sufijo epoch del slug, que es lo único común entre activos.
class MultiEdgeTab {
    constructor(app) {
        this.app = app;
        this.tbody = document.getElementById('multiedgeBody');
        this.summary = document.getElementById('multiedgeSummary');
    }

    // Epoch del slot a partir del slug ("sol-updown-5m-1784474700" -> 1784474700).
    getSlotEpoch(pos) {
        const parts = String(pos.slug || '').split('-');
        const last = Number(parts[parts.length - 1]);
        return (Number.isFinite(last) && last > 1e9) ? last : null;
    }

    // Etiqueta de la ventana: el título trae "<Activo> - <ventana>", así que la
    // parte tras el último " - " es lo que comparten todos los activos.
    getWindowLabel(pos) {
        const title = String(pos.title || '');
        const idx = title.lastIndexOf(' - ');
        if (idx > -1) return title.slice(idx + 3).trim();
        return title || '—';
    }

    // Nombre del activo: lo que va ANTES de la ventana.
    getAssetLabel(pos) {
        const title = String(pos.title || '');
        const idx = title.lastIndexOf(' - ');
        if (idx > -1) return title.slice(0, idx).trim();
        return title || (pos.slug || '—');
    }

    formatUSD(v) {
        const n = Number(v) || 0;
        return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    formatDate(sec) {
        if (!sec) return '—';
        const d = new Date(sec * 1000);
        return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    formatCents(p) {
        const n = Number(p);
        if (!isFinite(n)) return '—';
        if (n > 0 && n < 0.01) return '<1¢';
        return `${Math.round(n * 100)}¢`;
    }

    build(openPositions, closedPositions) {
        const items = [
            ...(openPositions || []).map(p => ({ pos: p, abierta: true })),
            ...(closedPositions || []).map(p => ({ pos: p, abierta: false }))
        ];

        const groups = new Map();
        items.forEach(({ pos, abierta }) => {
            const epoch = this.getSlotEpoch(pos);
            // Sin epoch no hay ventana compartida: se agrupa por su propio
            // evento para que igualmente aparezca, en su bloque.
            const key = epoch !== null ? `slot:${epoch}` : `ev:${this.app.getEventKey(pos)}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    epoch,
                    esVentana: epoch !== null,
                    label: epoch !== null ? this.getWindowLabel(pos) : (pos.title || pos.slug || '—'),
                    ts: epoch !== null ? epoch : this.app.getPositionTimestampSec(pos),
                    posiciones: [],
                    filas: [],
                    pnl: 0,
                    invertido: 0
                });
            }
            const g = groups.get(key);
            g.posiciones.push(pos);
            const real = this.app.getTrueFinancials(pos);
            const pnl = this.app.getItemPnlExact(pos);
            const inv = real ? real.investment
                : Math.abs(Number(pos.totalBought ?? pos.size ?? 0)) * Number(pos.avgPrice || 0);

            g.filas.push({
                pos, abierta, pnl, inv,
                activo: this.getAssetLabel(pos),
                shares: Number(pos.totalBought ?? pos.size ?? 0),
                avgPrice: Number(pos.avgPrice || 0),
                outcome: pos.outcome || '—',
                ts: this.app.getPositionTimestampSec(pos)
            });
            g.pnl += pnl;
            g.invertido += inv;
        });

        // Ventanas más recientes arriba; dentro, por activo para comparar rápido.
        const lista = [...groups.values()].sort((a, b) => b.ts - a.ts);
        lista.forEach(g => {
            g.filas.sort((a, b) => a.activo.localeCompare(b.activo));
            // Los grupos que no son ventana temporal son eventos normales
            // (p.ej. un 1x2): mejor el nombre del partido que el título de una
            // de sus patas, que es lo que caía por defecto.
            if (!g.esVentana && this.app.isMultiLegEvent(g.posiciones)) {
                g.label = this.app.getEventTitle(g.posiciones);
            }
        });
        return lista;
    }

    // Grupos en el formato que espera renderConsolidatedChart: un punto por
    // VENTANA (no por operación), en orden cronológico ascendente para que el
    // acumulado se construya bien.
    getChartGroups(openPositions, closedPositions) {
        return this.build(openPositions, closedPositions)
            .slice()
            .sort((a, b) => a.ts - b.ts)
            .map(g => ({
                title: g.label,
                items: g.posiciones,
                timestamp: g.ts * 1000,
                pnl: g.pnl,
                slug: g.esVentana ? `${g.filas.length} activo${g.filas.length > 1 ? 's' : ''}` : (g.posiciones[0]?.slug || '—'),
                outcome: g.filas.map(f => f.outcome).join(' / '),
                type: g.filas.every(f => f.abierta) ? 'Abierta' : 'Cerrada'
            }));
    }

    render(openPositions, closedPositions) {
        if (!this.tbody) return;

        const grupos = this.build(openPositions, closedPositions);
        if (!grupos.length) {
            this.tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay operaciones para esta wallet</td></tr>';
            return;
        }

        let html = '';
        let primero = true;
        grupos.forEach(g => {
            if (!primero) html += '<tr class="group-separator"><td colspan="7"></td></tr>';
            primero = false;

            const cls = g.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            // "activos" sólo cuando es una ventana temporal compartida; si es un
            // evento normal, sus filas son patas del mismo mercado.
            const unidad = g.esVentana ? 'activos' : 'patas';
            const activos = g.filas.length > 1
                ? `<small class="market-total">· ${g.filas.length} ${unidad}</small>`
                : '';
            html += `<tr class="group-title event-title"><td colspan="7" class="title-cell">${g.label}
                        <small class="market-total ${cls}">(${g.pnl >= 0 ? '+' : ''}${this.formatUSD(g.pnl)})</small>
                        ${activos}</td></tr>`;

            g.filas.forEach(f => {
                const pcls = f.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                const estado = f.abierta
                    ? '<span class="side-badge">Abierta</span>'
                    : '<span class="side-badge">Cerrada</span>';
                html += `
                    <tr>
                        <td>${this.formatDate(f.ts)}</td>
                        <td><div>${f.activo}</div><small><code class="slug">${f.pos.slug || '—'}</code></small></td>
                        <td><span class="side-badge">${f.outcome}</span></td>
                        <td class="text-right"><strong>${this.formatUSD(f.inv)}</strong></td>
                        <td class="text-right">${this.formatCents(f.avgPrice)}</td>
                        <td class="text-right">${f.shares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="text-right"><strong class="${pcls}">${f.pnl >= 0 ? '+' : ''}${this.formatUSD(f.pnl)}</strong></td>
                    </tr>`;
            });
        });

        this.tbody.innerHTML = html;
    }
}
