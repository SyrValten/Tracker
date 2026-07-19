// api.js - Clase para llamadas a la API de Polymarket
class PolymarketAPI {
    constructor() {
        this.baseURL = 'https://data-api.polymarket.com';
    }

    async fetchFromAPI(endpoint, params) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    async fetchAllPositions(user, pageSize = 100) {
        const results = [];
        let offset = 0;
        const maxPages = 50; // hasta 5000 posiciones abiertas (wallets de alto volumen)

        for (let page = 0; page < maxPages; page++) {
            const pageData = await this.fetchFromAPI('/positions', {
                user: user,
                sizeThreshold: 1,
                limit: pageSize,
                offset: offset,
                sortBy: 'TOKENS',
                sortDirection: 'DESC'
            });

            if (!Array.isArray(pageData)) {
                throw new Error('Respuesta de positions inesperada: se esperaba un array');
            }

            results.push(...pageData);
            if (pageData.length < pageSize) {
                break;
            }
            offset += pageSize;
        }

        return results;
    }

    async getPositions(user) {
        // Paginado: trae TODAS las posiciones abiertas, no solo las 100 más grandes.
        // (wallets de alto volumen pueden tener cientos de perdedoras sin redimir
        //  que de otro modo quedarían fuera del top 100 y falsearían el P&L)
        return this.fetchAllPositions(user, 100);
    }

    async fetchAllClosedPositions(user, pageSize = 50, sinceTs = null) {
        // OJO: /closed-positions sirve máx. 50 por página aunque pidas más.
        // Por eso pageSize=50 (si pones 100 el bucle creería que se acabó).
        // sinceTs (epoch segundos): si se pasa, para de paginar al llegar a
        //   posiciones más viejas que ese corte (vienen ordenadas por fecha DESC)
        //   → carga muchísimo más rápida para vistas recientes.
        const results = [];
        let offset = 0;
        // Sin tope práctico: pagina hasta agotar. maxPages alto = red de
        // seguridad contra bucles infinitos (1000 x 50 = 50.000 posiciones).
        const maxPages = 1000;
        const posTs = (p) => {
            const t = Number(p.timestamp || p.closeTimestamp || 0);
            if (t) return t;
            const parts = String(p.slug || '').split('-');
            const last = Number(parts[parts.length - 1]);
            return (Number.isFinite(last) && last > 1e9) ? last : 0;
        };

        for (let page = 0; page < maxPages; page++) {
            const pageData = await this.fetchFromAPI('/closed-positions', {
                user: user,
                limit: pageSize,
                offset: offset,
                sortBy: 'TIMESTAMP',
                sortDirection: 'DESC'
            });

            if (!Array.isArray(pageData)) {
                throw new Error('Respuesta de closed-positions inesperada: se esperaba un array');
            }

            results.push(...pageData);
            if (pageData.length < pageSize) {
                break;
            }
            // Filtro por fecha: si la última de la página ya es más vieja que el
            // corte, no hace falta pedir más páginas (están ordenadas DESC).
            if (sinceTs != null) {
                const lastTs = posTs(pageData[pageData.length - 1]);
                if (lastTs && lastTs < sinceTs) break;
            }
            offset += pageSize;
        }

        // Si se filtra por fecha, descartar las que quedaron por debajo del corte.
        if (sinceTs != null) {
            return results.filter(p => posTs(p) >= sinceTs);
        }
        return results;
    }

    async getClosedPositions(user, sinceTs = null) {
        return this.fetchAllClosedPositions(user, 50, sinceTs);
    }

    async fetchAllActivity(user, pageSize = 100) {
        const results = [];
        let offset = 0;
        // El P&L real se reconstruye desde aquí (el USDC de /activity es el
        // efectivo de verdad; avgPrice*shares se deja comisiones por el camino).
        //
        // OJO con el tope: /activity devuelve HTTP 400 a partir de offset ~5000
        // (comprobado por bisección). Pedir más no trae nada y además rompía la
        // carga entera: el error se propagaba, la promesa de actividad quedaba
        // rechazada y el libro se quedaba VACÍO, de modo que las wallets con
        // mucho historial perdían el P&L exacto sin avisar.
        const maxOffset = 5000;

        while (offset <= maxOffset) {
            let pageData;
            try {
                pageData = await this.fetchFromAPI('/activity', {
                    user: user,
                    limit: pageSize,
                    offset: offset,
                    sortBy: 'TIMESTAMP',
                    sortDirection: 'DESC'
                });
            } catch (error) {
                // Si una página falla, se conserva lo ya descargado en vez de
                // perderlo todo: con historial parcial el P&L sigue siendo
                // exacto para las operaciones que sí cubre.
                console.warn(`/activity cortado en offset ${offset}:`, error.message);
                break;
            }

            if (!Array.isArray(pageData)) break;

            results.push(...pageData);
            if (pageData.length < pageSize) break;
            offset += pageSize;
        }

        return results;
    }

    async getActivity(user) {
        return this.fetchAllActivity(user, 100);
    }

    async getTotalValue(user) {
        return this.fetchFromAPI('/value', { user: user });
    }

    async getLeaderboard(user, timePeriod = 'ALL') {
        return this.fetchFromAPI('/v1/leaderboard', {
            user: user,
            category: 'OVERALL',
            timePeriod: timePeriod,
            orderBy: 'PNL',
            limit: 25
        });    }

    async getTraded(user) {
        return this.fetchFromAPI('/traded', { user: user });
    }

    async getPublicProfile(address) {
        const url = new URL('https://gamma-api.polymarket.com/public-profile');
        url.searchParams.append('address', address);
        
        console.log('Fetching profile from:', url.toString());
        
        try {
            const response = await fetch(url);
            console.log('Profile response status:', response.status);
            
            if (!response.ok) {
                const error = `Error ${response.status}: ${response.statusText}`;
                console.error('API Error (public-profile):', error);
                throw new Error(error);
            }
            
            const data = await response.json();
            console.log('Profile data received:', data);
            return data;
        } catch (error) {
            console.error('API Error (public-profile):', error);
            return null;
        }
    }
}