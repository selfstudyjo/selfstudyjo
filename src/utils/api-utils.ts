export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export function normalizePaginatedResponse<T>(data: any): PaginatedResponse<T> {
    console.log('Normalizing API response:', data);

    if (!data) {
        console.log('No data provided, returning empty response');
        return {
            count: 0,
            next: null,
            previous: null,
            results: []
        };
    }

    // Check if response is already a paginated response from Django REST Framework
    if (typeof data === 'object' && ('results' in data || 'count' in data)) {
        console.log('Response is paginated DRF format');
        return {
            count: data.count || (Array.isArray(data.results) ? data.results.length : 0),
            next: data.next || null,
            previous: data.previous || null,
            results: Array.isArray(data.results) ? data.results : (data.results ? [data.results] : [])
        };
    }

    // If it's an array, treat it as all results
    if (Array.isArray(data)) {
        console.log('Response is an array');
        return {
            count: data.length,
            next: null,
            previous: null,
            results: data
        };
    }

    // Single object response
    console.log('Response is a single object');
    return {
        count: 1,
        next: null,
        previous: null,
        results: [data]
    };
}

export function ensureArray<T>(data: any): T[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return [data];
}
