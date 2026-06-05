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

    async getPositions(user) {
        return this.fetchFromAPI('/positions', {
            user: user,
            sizeThreshold: 1,
            limit: 100,
            sortBy: 'TOKENS',
            sortDirection: 'DESC'
        });
    }

    async fetchAllClosedPositions(user, pageSize = 50) {
        const results = [];
        let offset = 0;
        const maxPages = 20; // proteger contra bucles infinitos, hasta 1000 posiciones

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
            offset += pageSize;
        }

        return results;
    }

    async getClosedPositions(user) {
        return this.fetchAllClosedPositions(user, 50);
    }

    async fetchAllActivity(user, pageSize = 50) {
        const results = [];
        let offset = 0;
        const maxPages = 20; // proteger contra bucles infinitos, hasta 1000 actividades

        for (let page = 0; page < maxPages; page++) {
            const pageData = await this.fetchFromAPI('/activity', {
                user: user,
                limit: pageSize,
                offset: offset,
                sortBy: 'TIMESTAMP',
                sortDirection: 'DESC'
            });

            if (!Array.isArray(pageData)) {
                throw new Error('Respuesta de activity inesperada: se esperaba un array');
            }

            results.push(...pageData);
            if (pageData.length < pageSize) {
                break;
            }
            offset += pageSize;
        }

        return results;
    }

    async getActivity(user) {
        return this.fetchAllActivity(user, 50);
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