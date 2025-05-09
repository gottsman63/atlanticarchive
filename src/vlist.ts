function setValue(key: string, value: any) {
    if (value === null) {
        console.log('setValue: value is null for key:', key);
    }
    localStorage.setItem(key, JSON.stringify(value));
}

function getValue(key: string) {
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : null;
    }
    catch {
        console.log('Bad data for key:', key);
    }
}

export class VirtualizedList {
    containerName: string;
    itemRenderer: ((index: number, query: any, incomingItem: HTMLElement | null) => HTMLElement) | null = null;
    totalItems: number;
    rowHeight: number;
    buffer: number;
    visibleItems: Map<number, HTMLElement>;
    spacer: HTMLElement;
    query: string;
    listName: string;
    scrollKey: string;
    getTotalItems: (query: string, callback: (response: { total_count: number }) => void) => void;
    ticking: boolean = false;

    constructor(containerName: string, 
        itemRenderer: ((index: number, query: any, incomingItem: HTMLElement | null) => HTMLElement) | null = null, 
        totalItems: number, 
        rowHeight: number, 
        query: string, 
        listName: string, 
        getTotalItems: (query: string, callback: (response: { total_count: number }) => void) => void) {
        // if (! container) {
        //     console.error('VirtualizedList: container is null');
        //     debugger
        // }
        this.containerName = containerName;
        this.itemRenderer = itemRenderer; // Callback to create items
        this.totalItems = totalItems;
        this.rowHeight = rowHeight;
        this.buffer = 20; // Number of rows above/below the viewport to render
        this.visibleItems = new Map(); // {index: element}
        this.query = query;
        this.listName = listName;
        this.spacer = document.createElement('div');
        this.scrollKey = this.listName + ':scroll';
        this.getTotalItems = getTotalItems;
        this.init(); 
    }

    init() {
        // console.log('VirtualizedList.init', this.listName);
        this.visibleItems.clear();
        this.getContainer().innerHTML = '';
        // Set up the container
        this.getContainer().style.overflowY = 'auto';
        this.getContainer().style.position = 'relative';

        // Create the spacer element
        this.spacer.style.height = `${this.totalItems * this.rowHeight}px`;
        this.spacer.style.position = 'relative';
        this.getContainer().appendChild(this.spacer);

        const scrollOffset = getValue(this.scrollKey) || 0;
        this.getContainer().scrollTop = scrollOffset;
        if (this.onScroll) { // Remove existing scroll event listener if it exists
            this.getContainer().removeEventListener('scroll', this.onScroll);
        }        
        this.onScroll = this.onScroll.bind(this);
        this.getContainer().addEventListener('scroll', this.onScroll);
        this.renderVisibleItems();
        this.updateItemCount(this.totalItems);
    }

    getContainer(): HTMLElement {
        const element = document.getElementById(this.containerName);
        if (!element) {
            console.error('VirtualizedList: container is null', this.containerName);
        }
        if (element) {
            return element;
        }
        throw new Error(`Container with ID ${this.containerName} not found`);
    }

    calculateVisibleRange() {
        const scrollTop = this.getContainer().scrollTop;
        const viewportHeight = this.getContainer().clientHeight;

        const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.buffer);
        const endIndex = Math.min(
            this.totalItems - 1,
            Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.buffer
        );
        return { startIndex, endIndex };
    }

    prepVisibleItem(index: number) {
        if (!this.itemRenderer) { return null; }
        const itemElement = this.itemRenderer(index, this.query, null); // Create item via callback
        if (!itemElement) {
            console.error('VirtualizedList: itemRenderer returned null for index:', index);
            return null;
        }
        itemElement.style.position = 'absolute';
        itemElement.style.top = `${index * this.rowHeight}px`;
        itemElement.style.height = `${this.rowHeight}px`;
        itemElement.style.width = '100%';
        (itemElement as any).creationTime = Date.now();
        this.visibleItems.set(index, itemElement);
        this.spacer.appendChild(itemElement);
        return itemElement;
    }

    renderVisibleItems() {
        // console.log('renderVisibleItems', this.listName);
        // if (this.totalItems == -1) {
        //     // console.log('...fetching the first item.');
        //     this.itemRenderer(0, this.query);  // Force a fetch of the first item (if any) to get the actual item count.
        //     return;
        // }
        if (this.itemRenderer == null) { return ; }
        const queryRetryDelay = 2 * 1000;
        const { startIndex, endIndex } = this.calculateVisibleRange();
        // Add new items to the DOM
        for (let i = startIndex; i <= endIndex; i++) {
            let itemElement;
            if (!this.visibleItems.has(i)) {
                itemElement = this.prepVisibleItem(i);
            } else {
                itemElement = this.visibleItems.get(i) as HTMLElement;
                const creationTime = (itemElement as any).creationTime;
                if (itemElement.textContent && itemElement.textContent.startsWith("Loading...") && (Date.now() - creationTime > queryRetryDelay)) {
                    this.itemRenderer(i, this.query, itemElement);
                    (itemElement as any).creationTime = Date.now();
                    itemElement.textContent = "Loading..." + (itemElement as any).creationTime
                }
            }
        }
    }
    onScroll() {
        const scrollTop = this.getContainer().scrollTop;
        setValue(this.scrollKey, scrollTop);
        if (!this.ticking) {
            requestAnimationFrame(() => {
                this.renderVisibleItems();
                this.ticking = false;
            });
            this.ticking = true;
        }
    }

    async updateQuery(query: any) {
        if (JSON.stringify(query) !== JSON.stringify(this.query)) {
            this.query = query;
            this.getTotalItems(this.query, (response) => {
                this.totalItems = response.total_count;
                this.updateTotalItems(this.totalItems);
                this.spacer.innerHTML = '';
                this.visibleItems.clear();
                setValue(this.scrollKey, 0);
                this.init();
            });
        } else {
            const scrollOffset = getValue(this.scrollKey) || 0;
            this.getContainer().scrollTop = scrollOffset;
            this.renderVisibleItems();
        }
    }

    updateTotalItems(newTotalItems: number) {
        // console.log('updateTotalItems', newTotalItems, this.listName);
        if (newTotalItems !== this.totalItems) {
            // console.log(`Updating total items: ${newTotalItems}, ${this.listName}`, tabName);
            this.totalItems = newTotalItems;
            this.init()
        }
    }

    updateItemCount(count: number) {
        try {
            const wrapperId = 'scroll-area-wrapper';
            const wrapper = document.getElementById(wrapperId);
            if (!wrapper) {
                console.error('VirtualizedList: wrapper is null', wrapperId);
                return;
            }
            const itemCountElement = wrapper.querySelector('.jviewer-item-count');
            if (!itemCountElement) {
                console.error('VirtualizedList: itemCountElement is null', wrapperId);
                return;
            }
            itemCountElement.textContent = `${count} Items`;
        } catch (e) {
            console.error('VirtualizedList: error updating item count', e);
        }
    }

    destroy() {
        // Clean up the DOM and event listeners
        this.getContainer().removeEventListener('scroll', this.onScroll);
        this.getContainer().innerHTML = '';
    }
}
