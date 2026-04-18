/**
 * User Identity — generates and persists a unique browser ID.
 * This gives each browser/device its own isolated dashboard history.
 */

const STORAGE_KEY = 'scxray_user_id';

export function getUserId() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : 
            'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
}
