// ==========================================
// NISHA SEARCH WEB WORKER
// Offloads heavy Fuse.js fuzzy search and indexing from the main UI thread
// ==========================================

import Fuse from 'fuse.js';

const SEARCH_SYNONYMS = {
    'найк': 'nike', 'найки': 'nike', 'адидас': 'adidas', 'адики': 'adidas',
    'пума': 'puma', 'левис': 'levis', 'левайс': 'levis', 'кархарт': 'carhartt',
    'кархартт': 'carhartt', 'каргарт': 'carhartt', 'стон': 'stone island',
    'стоник': 'stone island', 'айленд': 'island', 'армани': 'armani',
    'гесс': 'guess', 'гэсс': 'guess', 'рибок': 'reebok', 'ванс': 'vans',
    'вэнс': 'vans', 'нью беланс': 'new balance', 'нью баланс': 'new balance',
    'ньюбики': 'new balance', 'ральф': 'ralph lauren polo', 'поло': 'polo',
    'саутпол': 'southpole', 'соутпол': 'southpole', 'рокавер': 'rocawear',
    'эвис': 'evisu', 'эвису': 'evisu', 'норс фейс': 'the north face',
    'тнф': 'the north face', 'патагония': 'patagonia', 'диккис': 'dickies',
    'дикис': 'dickies', 'зилла': 'zilla', 'стэсси': 'stussy', 'стусси': 'stussy',
    'суприм': 'supreme', 'худи': 'hoodie', 'худак': 'hoodie', 'толстовка': 'hoodie sweatshirt',
    'зипка': 'zip hoodie', 'зип': 'zip', 'ветровка': 'jacket windbreaker',
    'куртка': 'jacket', 'пуховик': 'down jacket puffer', 'свитшот': 'sweatshirt',
    'кофта': 'sweater knitwear', 'свитер': 'sweater', 'футболка': 't-shirt tee',
    'тишка': 't-shirt tee', 'майка': 'tank top', 'лонгслив': 'longsleeve',
    'штаны': 'pants trousers', 'штани': 'pants', 'джинсы': 'jeans denim',
    'джинси': 'jeans denim', 'шорты': 'shorts', 'шорти': 'shorts',
    'кепка': 'cap hat', 'шапка': 'beanie hat', 'рюкзак': 'backpack',
    'сумка': 'bag', 'кроссовки': 'sneakers shoes', 'кроссы': 'sneakers',
    'кроси': 'sneakers', 'кеды': 'sneakers shoes vans'
};

const CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y',
    'э': 'e', 'ю': 'yu', 'я': 'ya', 'є': 'ye'
};

function transliterateCyrillic(str) {
    if (!str || typeof str !== 'string') return '';
    return str.split('').map(char => {
        const lower = char.toLowerCase();
        return CYRILLIC_TO_LATIN[lower] !== undefined ? CYRILLIC_TO_LATIN[lower] : char;
    }).join('');
}

function expandSearchQuery(query) {
    if (!query || typeof query !== 'string') return [];
    const clean = query.replace(/[#&]/g, '').trim().toLowerCase();
    if (!clean) return [];

    const variants = new Set();
    variants.add(clean);

    // Прямой поиск синонимов
    if (SEARCH_SYNONYMS[clean]) {
        SEARCH_SYNONYMS[clean].split(' ').forEach(w => variants.add(w));
    }

    // Пословный поиск синонимов
    const words = clean.split(/\s+/);
    if (words.length > 1) {
        let hasWordSynonym = false;
        const replacedWords = words.map(w => {
            if (SEARCH_SYNONYMS[w]) {
                hasWordSynonym = true;
                return SEARCH_SYNONYMS[w].split(' ')[0];
            }
            return w;
        });
        if (hasWordSynonym) {
            variants.add(replacedWords.join(' '));
        }
    }

    // Транслитерация кириллицы
    if (/[а-яёіїєґ]/i.test(clean)) {
        const translit = transliterateCyrillic(clean);
        if (translit && translit !== clean) {
            variants.add(translit);
        }
    }

    return Array.from(variants);
}

// Конфигурация Fuse.js
const FUSE_OPTIONS = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.4,
    ignoreLocation: true,
    useExtendedSearch: true,
    keys: [
        { name: 'tags', weight: 1.0 },
        { name: 'brand', weight: 0.8 },
        { name: 'name', weight: 0.8 },
        { name: 'size', weight: 0.8 },
        { name: 'category', weight: 0.2 }
    ]
};

let allItems = [];
let itemsById = new Map();
let fuseInstance = null;

// Обработка сообщений из главного потока
self.onmessage = function(e) {
    const data = e.data;
    if (!data || !data.type) return;

    switch (data.type) {
        case 'SET_ITEMS': {
            const rawItems = Array.isArray(data.items) ? data.items : [];
            // Сохраняем только необходимые для поиска и превью поля, чтобы экономить память
            allItems = rawItems.map(item => ({
                id: item.id,
                name: item.name || '',
                brand: item.brand || '',
                price: item.price,
                old_price: item.old_price,
                size: item.size || '',
                category: item.category || '',
                tags: item.tags || '',
                status: item.status || 'available',
                is_sale: item.is_sale,
                thumbnails: item.thumbnails || [],
                images: item.images || []
            }));

            itemsById.clear();
            allItems.forEach(i => itemsById.set(i.id, i));

            // Инициализация Fuse.js в фоновом потоке
            fuseInstance = new Fuse(allItems, FUSE_OPTIONS);

            self.postMessage({
                type: 'ITEMS_SET_SUCCESS',
                count: allItems.length,
                requestId: data.requestId
            });
            break;
        }

        case 'SEARCH_LIVE': {
            const { query, limit = 8, requestId } = data;
            if (!fuseInstance || !query || !query.trim()) {
                self.postMessage({
                    type: 'SEARCH_LIVE_RESULTS',
                    results: [],
                    requestId
                });
                return;
            }

            const cleanTerm = query.replace(/#/g, '').trim().toLowerCase();
            const queryVariants = expandSearchQuery(cleanTerm);
            const collected = [];
            const seenIds = new Set();

            for (const variant of queryVariants) {
                const subResults = fuseInstance.search(variant);
                for (let i = 0; i < subResults.length; i++) {
                    const r = subResults[i];
                    if (!seenIds.has(r.item.id)) {
                        seenIds.add(r.item.id);
                        collected.push({
                            item: r.item,
                            matches: r.matches,
                            score: r.score
                        });
                        if (collected.length >= limit) break;
                    }
                }
                if (collected.length >= limit) break;
            }

            self.postMessage({
                type: 'SEARCH_LIVE_RESULTS',
                results: collected.slice(0, limit),
                requestId
            });
            break;
        }

        case 'SEARCH_CATALOG': {
            const { query, candidateIds, requestId } = data;
            if (!fuseInstance || !query || !query.trim()) {
                self.postMessage({
                    type: 'SEARCH_CATALOG_RESULTS',
                    matchedIds: candidateIds || [],
                    requestId
                });
                return;
            }

            const cleanTerm = query.replace(/#/g, '').trim().toLowerCase();
            const queryVariants = expandSearchQuery(cleanTerm);
            const candidateSet = candidateIds ? new Set(candidateIds) : null;
            const matchedIds = [];
            const seenIds = new Set();

            for (const variant of queryVariants) {
                const results = fuseInstance.search(variant);
                for (let i = 0; i < results.length; i++) {
                    const id = results[i].item.id;
                    if (!seenIds.has(id)) {
                        if (!candidateSet || candidateSet.has(id)) {
                            seenIds.add(id);
                            matchedIds.push(id);
                        }
                    }
                }
            }

            self.postMessage({
                type: 'SEARCH_CATALOG_RESULTS',
                matchedIds,
                requestId
            });
            break;
        }

        case 'CLEAR': {
            allItems = [];
            itemsById.clear();
            fuseInstance = null;
            self.postMessage({ type: 'CLEAR_SUCCESS', requestId: data.requestId });
            break;
        }
    }
};
