export const storageRepository = {

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error(`Error reading ${key} from storage`, error);
            return [];
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving ${key} to storage`, error);
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    push(key, item) {
        const collection = this.get(key);
        collection.push(item);
        this.set(key, collection);
        return collection;
    },

    updateById(key, id, newData) {
        const collection = this.get(key);

        const updated = collection.map((item) =>
            item.id === id ? { ...item, ...newData } : item
        );

        this.set(key, updated);
        return updated;
    },

    deleteById(key, id) {
        const collection = this.get(key);

        const filtered = collection.filter((item) => item.id !== id);

        this.set(key, filtered);
        return filtered;
    }

};