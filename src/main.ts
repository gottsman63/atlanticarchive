import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
setBasePath('/node_modules/@shoelace-style/shoelace/dist/');
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import TomSelect from 'tom-select';
// import 'tom-select/dist/css/tom-select.css';
import 'tom-select/dist/css/tom-select.default.css';
import './style.css'
import LZString from 'lz-string';

// Import noUiSlider
import 'nouislider/dist/nouislider.css';
import noUiSlider from 'nouislider';
import wNumb from 'wnumb';
import './vlist.js'; // likewise
import './compound-button.js';
import './term-row.js';
// import { TermRowHolder } from './term-row-holder';
import { VirtualizedList } from './vlist';
import { Chart, ChartDataset, Colors, registerables } from 'chart.js';
import { ResultLineItem } from './result-line-item.js';
import { YearThumbnailGallery } from './year-thumbnail-gallery.js';

Chart.register(...registerables);

const fetchUrl = 'https://ocf23hr7gvdwnjvqjdxkyfn72q0krmpf.lambda-url.eu-west-1.on.aws/'; // Default URL

const fetchUrls = [
    { url: 'https://7xadmewddfcppw5lweztbzlv2u0wxcvk.lambda-url.eu-west-1.on.aws/', region: 'Ireland', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
    { url: 'https://7l7dxsu2m33pjnh6e62sfl54py0ixquy.lambda-url.us-west-2.on.aws/', region: 'Oregon', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
    { url: 'https://mmhwe4ilkqhhqb5efd3ecmsqy40pgfib.lambda-url.us-east-1.on.aws/', region: 'N. Virginia', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
    { url: 'https://2y674htvpcocgsrdjp2azmpspq0vioiq.lambda-url.us-east-2.on.aws/', region: 'Ohio', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
    { url: 'https://cdgwrchh6zf25bztnf4xcltcqu0ulxqb.lambda-url.us-west-1.on.aws/', region: 'N. California', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
];

// let pendingQueries: { [key: string]: any } = {};
const blockSize = 25;
const dataCallbackCache: { [key: string]: any } = {};
// const cacheForGetAllRecords: { [key: string]: any } = {};
let lastPingTestTime = 0;
const pingIntervalSeconds = 10 * 1000; 

let MouseX = 0;
let MouseY = 0;
let LastThumbnailBounds: DOMRect | null = null;

window.addEventListener('mousemove', (event) => {
    MouseX = event.clientX;
    MouseY = event.clientY;
    const bounds = LastThumbnailBounds as DOMRect | null;
    if (!bounds) {
        return;
    }
    if (MouseX < bounds.left ||
        MouseX > bounds.right ||
        MouseY < bounds.top ||
        MouseY > bounds.bottom
        ) {
    const coverOverlay = document.getElementById('cover-overlay') as HTMLDivElement;
    coverOverlay.style.display = 'none';
    LastThumbnailBounds = null;
    }
});

// ------------------------- Fetch Single Retry Management -------------------------
const fetchSingleCache: Map<string, { url: string, response: any, callback: any, nextTryTime: number }> = new Map();
let fetchSingleScanInterval: any;
startScanningForFetchSingleRetries();
// ----------------------- End Fetch Single Retry Management -----------------------

function debounce<T extends (...args: any[]) => void>(func: T, delay = 100): (...args: Parameters<T>) => void {
    let timeoutId: number | undefined;
    return (...args: Parameters<T>) => {
        // Clear the previous timeout
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
        // Set a new timeout
        timeoutId = window.setTimeout(() => {
            func(...args);
        }, delay);
    };
}

function loadPage(url: string, newTab = false) {
    const a = document.createElement('a');
    a.href = url;
    if (newTab) a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function hoverCover(url: string, thumbnailBounds: DOMRect | null = null) {
    LastThumbnailBounds = thumbnailBounds;
    const coverOverlay = document.getElementById('cover-overlay') as HTMLDivElement;
    const overlayImage = document.getElementById('cover-overlay-image') as HTMLImageElement;
    if (url) {
        coverOverlay.style.display = 'flex';
        overlayImage.src = url;
    }
}

function getCumulativeLineIndexOfYearMonth(query: any, year: number, month: number, callback: (index: number) => void) {
        const queryCopy = JSON.parse(JSON.stringify(query));
        queryCopy.query = 'recordindexofyearmonth';
        queryCopy.year = year;
        queryCopy.month = month;
        getAllRecords(queryCopy, (result: any) => {
            callback(result.results.index);
        });
    }

function flashElement(element: HTMLElement) {
    element.style.visibility = 'hidden';
    setTimeout(() => {
        element.style.visibility = 'visible';
    }, 300);
    setTimeout(() => {
        element.style.visibility = 'hidden';
    }, 600);
    setTimeout(() => {
        element.style.visibility = 'visible';
    }, 900);
}

function getImageUrlFromYearMonth (year: number, month: number): string {
    // Construct the image URL based on the year and month
    return `https://d1nm0ipwz8mc85.cloudfront.net/cover_${year}_${month}.jpg`;
};

// --------------------------- Date Slider ------------------------------
class DoubleSlider extends HTMLElement {
    tabName: string;

    constructor(callback: (arg0: number, arg1: number) => void) {
        super();
        this.tabName = 'tabname';
        // this.attachShadow({ mode: 'open' });
        const div = document.createElement('div');
        const id = this.tabName + '-slider'
        div.id = id;
        // this.shadowRoot.appendChild(div);
        this.appendChild(div);
        const currentYear = new Date().getFullYear();
        const minYear = 1857;
        const slider = noUiSlider.create(div, {
            start: [minYear, currentYear],
            tooltips: [wNumb({ decimals: 0 }), wNumb({ decimals: 0 })],
            connect: true,
            range: {
                'min': minYear,
                'max': currentYear
            },
            step: 1
        });
        slider.on('update', (values: (string | number)[], _handle: number) => {
            callback(Math.floor(Number(values[0])), Math.floor(Number(values[1])));
        })

        div.style.marginLeft = '50px';
        div.style.marginRight = '50px';
        div.style.marginTop = '30px';

        const style = document.createElement('style');
        style.textContent = `
      .noUi-connect {
              background: var(--sl-color-primary-500, #3b82f6);
          }
      .noUi-tooltip {
          font-family: 'Inter', sans-serif;
          font-size: 0.85rem;
          background: var(--sl-color-neutral-100, #f9f9f9);
          color: var(--sl-color-neutral-700, #333);
          border-radius: 4px;
          border: 1px solid var(--sl-color-neutral-300, #ccc);
          padding: 2px 6px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      `
        // this.shadowRoot.appendChild(style);
        this.appendChild(style);
    }

    setDateRange(startYear: number, endYear: number) {
        const slider = document.getElementById(this.tabName + '-slider');
        if (slider) {
            const noUiSliderInstance = (slider as any).noUiSlider;
            if (noUiSliderInstance) {
                noUiSliderInstance.set([startYear, endYear]);
            }
        }
    }

    getRange() {
        const slider = document.getElementById(this.tabName + '-slider');
        if (slider) {
            const noUiSliderInstance = (slider as any).noUiSlider;
            if (noUiSliderInstance) {
                const values = noUiSliderInstance.get();
                const startYear = Math.floor(Number(values[0]));
                const endYear = Math.floor(Number(values[1]));
                return { startYear, endYear };
            }
        }
        return { startYear: 1857, endYear: new Date().getFullYear() };
    }

    isAtMaxRange() {
        const startYear = 1857;
        const endYear = new Date().getFullYear();
        const years = this.getRange();
        return years.startYear === startYear && (years.endYear === endYear)
    }

    resetRange() {
        const currentYear = new Date().getFullYear();
        const minYear = 1857;
        this.setDateRange(minYear, currentYear);
    }

    flashIfConstrained() {
        const slider = document.getElementById(this.tabName + '-slider');
        if (slider) {
            const noUiSliderInstance = (slider as any).noUiSlider;
            if (noUiSliderInstance) {
                const values = noUiSliderInstance.get();
                const startYear = Math.floor(Number(values[0]));
                const endYear = Math.floor(Number(values[1]));
                if (startYear > 1857 || endYear < new Date().getFullYear()) {
                    flashElement(slider);
                }
            }
        }
    }
}

customElements.define("double-slider", DoubleSlider);
// ------------------------- End Date Slider ----------------------------

// ------------------------------ Search Element --------------------------------
class SearchElement extends HTMLElement {
    changeCallback: () => void;
    resetDateSlider: () => void;
    tomSelect!: TomSelect;

    constructor(changeCallback: () => void, resetDateSlider: () => void) {
        super();
        this.innerHTML = `
        <div class="jviewer-search-bar" style="display: flex; justify-content: center;">
          <select id="author-select" autocorrect="off" placeholder="Search for an author"></select>
          <sl-button id="reset-author" variant="primary" size="medium" pill>Show all Articles</sl-button>
          <sl-input id="search-string" placeholder="Search for words or (in quotes) a phrase" size="large" pill clearable autocorrect="off" style="width: 50%;"></sl-input>
        </div>
          `;

        const debouncedHandleInputChange = debounce((e) => this.handleInputChange(e), 300);

        // Attach a single event listener to the parent div
        this.querySelectorAll('sl-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.clearAuthorField();
                debouncedHandleInputChange(e);
            });
            input.addEventListener('sl-clear', (e) => this.handleInputChange(e)); // no need to debounce this
        });

        this.changeCallback = changeCallback;
        this.resetDateSlider = resetDateSlider;

        const searchString = this.querySelector('#search-string') as HTMLInputElement;
        searchString.addEventListener('input', debouncedHandleInputChange);
        searchString.addEventListener('sl-clear', (e) => this.handleInputChange(e));

        const authorSelect = this.querySelector('#author-select') as HTMLSelectElement;
        authorSelect.addEventListener('change', () => this.changeCallback());

        const resetAuthorButton = this.querySelector('#reset-author') as HTMLElement;
        resetAuthorButton.addEventListener('click', (e) => {
            this.clearAuthorField();
            this.setSearchString('');
            this.handleInputChange(e);
        });

        window.addEventListener("pageshow", (event) => {
            if (event.persisted) {
                // Page was restored from BFCache; reinitialize IndexedDB-based context
                this.initialize();
            }
        });
    }

    initialize() {
        const result: string = this.getSearchString();
        const element = this.querySelector('#search-string') as HTMLInputElement;
        element.value = result;
        this.setupTomSelect();
    }

    // firstUpdated() {
    //     this.setupTomSelect();
    // }

    setupTomSelect() {
        this.tomSelect = new TomSelect('#author-select', {
            valueField: 'id',
            dropdownParent: 'body',
            labelField: 'name',
            loadThrottle: 300,
            options: [],
            searchField: ['name'],
            load: function (query: String, callback: any) {
                if (!query.length) callback();
                getAllRecords({ query: 'authors', searchstring: query }, (result: any) => {
                    const records: any = result.results.map((item: any) => ({
                        id: item.name,
                        name: item.name + ' (' + item.article_count + ')',
                    }));
                    callback(records);
                });
            }
        });

        this.tomSelect.on('item_add', (value: string) => {
            const item = this.tomSelect.getItem(value);
            if (item) {
                const author = item.getAttribute('data-value');
                if (author) {
                    sessionStorage.setItem('author', author);
                    sessionStorage.setItem('searchString', '');
                    const element = this.querySelector('#search-string') as HTMLInputElement;
                    element.value = '';
                    // this.setResetAuthorButtonVisibility();
                    this.changeCallback();
                }
            }
        });
    }

    setResetAuthorButtonVisibility() {
        // const element = document.querySelector('#author-select') as HTMLInputElement;
        // if (!element) return;
        // const author = sessionStorage.getItem('author') as string;
        // if (author.length > 0) {
        //     element.style.visibility = 'visible';
        // } else {
        //     element.style.visibility = 'hidden';
        // }
    }

    flashAuthorField() {
        return;
        const element = this.querySelector('#reset-author') as HTMLInputElement;
        if (true) {
            element.style.visibility = 'hidden';
            setTimeout(() => {
                element.style.visibility = 'visible';
            }, 300);
            setTimeout(() => {
                element.style.visibility = 'hidden';
            }, 600);
            setTimeout(() => {
                element.style.visibility = 'visible';
            }, 900);
        }
    }

    getAuthor(): string {
        if (!this.tomSelect) {
            return '';
        }
        const author = sessionStorage.getItem('author');
        // const author = this.tomSelect.control_input.value;
        return author as string;
    }

    getSearchString(): string {
        const searchString = sessionStorage.getItem('searchString');
        const result = searchString || '';
        return result;
    }

    setSearchString(s: string) {
        sessionStorage.setItem('searchString', s);
        const element = this.querySelector('#search-string') as HTMLInputElement;
        element.value = s;
        this.changeCallback();
    }

    setAuthor(s: string) {
        // const element = this.querySelector('#author-select') as HTMLInputElement;
        // element.value = s;
        sessionStorage.setItem('searchString', '');
        const searchElement = this.querySelector('#search-string') as HTMLInputElement;
        searchElement.value = '';
        sessionStorage.setItem('author', s);
        if (this.tomSelect) {
            this.tomSelect.clear();
            // this.tomSelect.control_input.value = s;
            // this.setResetAuthorButtonVisibility();
            // this.tomSelect.addOption({ value: s, text: s });
            // this.tomSelect.setValue(s);
            // this.tomSelect.open();
            this.tomSelect.setTextboxValue(s);
            // this.tomSelect.refreshOptions(true);
            this.tomSelect.load(s);
            this.tomSelect.open();
            if (this.tomSelect.dropdown_content && this.tomSelect.dropdown_content.firstChild) {
                const firstOption = this.tomSelect.dropdown_content.firstChild as HTMLElement;
                if (firstOption && typeof firstOption.click === 'function') {
                    setTimeout(() => firstOption.click(), 0);
                }
            }
            // Immediately close the dropdown to allow future mouse clicks but not leave it open
            // Try blurring the input to close the dropdown without clearing the selection
            const input = this.tomSelect.control_input;
            if (input && typeof input.blur === 'function') {
                setTimeout(() => input.blur(), 100);
            }
            // this.tomSelect.focus();
            // this.tomSelect.close();
            this.changeCallback();
            // this.setResetAuthorButtonVisibility(s.length > 0);
        }
    }

    clearAuthorField() {
        const element = this.querySelector('#author-select') as HTMLInputElement;
        if (element) {
            element.value = '';
            sessionStorage.setItem('author', '');
            this.tomSelect.clear();
            this.setResetAuthorButtonVisibility();
        }
    }

    setDateRange(startYear: number, endYear: number) {
        const element = this.querySelector('#search-string') as HTMLInputElement;
        element.value = startYear + ' ' + endYear;
        this.changeCallback();
    }

    handleInputChange(_event: any): void {
        const element = this.querySelector('#search-string');
        this.setSearchString((element as HTMLInputElement)?.value);
        this.changeCallback();
    }

    flashHighlight(elementName: string) {
        const element = this.querySelector(elementName) as HTMLInputElement;
        if (element.value.length > 0) {
            element.classList.add('highlight');
            setTimeout(() => { element.classList.remove('highlight'); }, 300);
            setTimeout(() => { element.classList.add('highlight'); }, 600);
            setTimeout(() => { element.classList.remove('highlight'); }, 900);
        }
    }

    flashInputFields() {
        this.flashHighlight('#search-string');
    }
}

customElements.define('search-element', SearchElement);
// ---------------------------- End Search Element --------------------------------

// ------------------------------ Term Frequency Chart ------------------------------
class TermFrequencyChart extends HTMLElement {
    chart: Chart | null = null;
    chartContainer: HTMLDivElement | null = null;
    activeIndex: number = 0;
    query: any = null;

    constructor() {
        super();
        Chart.register(Colors);
        this.chartContainer = document.createElement('div');
        const chartCanvas = document.createElement('canvas');
        this.chartContainer.style.width = '93%';
        this.chartContainer.style.marginLeft = '50px';
        this.chartContainer.style.marginRight = '0px';
        this.chartContainer.style.marginTop = '0';
        this.chartContainer.style.marginBottom = '0';
        this.chartContainer.style.height = '200px';
        // chartCanvas.style.height = 'auto';
        this.chartContainer.appendChild(chartCanvas);
        // this.chartContainer.className = 'chart';
        this.chartContainer.id = 'stem-frequency-chart';
        this.appendChild(this.chartContainer);
        const ctx = chartCanvas.getContext('2d');
        if (ctx) {
            this.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [], // Add labels dynamically
                    datasets: [] // Add datasets dynamically
                },
                options: {
                    onHover: (event) => {
                        const canvas = event.native?.target as HTMLCanvasElement;
                        if (canvas) {
                            canvas.style.cursor = 'pointer';
                        }
                    },
                    onClick: (event, _elements) => {
                        if (!this.chart) return;
                        if (!event.x) return;
                        const canvasX = event.x;
                        // grab the category (or time) scale
                        const xScale = this.chart.scales['x']; // or 'x-axis-0' in older versions

                        // invert the pixel to a value; for a category scale this is a float index
                        const floatIndex = xScale.getValueForPixel(canvasX) as number;

                        // round to the nearest actual data index
                        const index = Math.round(floatIndex);
                        // const { index } = elements[0];
                        if (index !== this.activeIndex) {
                            this.activeIndex = index;
                            this.chart?.update();            // re-render with new colors
                            // 3) Report the year
                            if (this.chart?.data.labels) {
                                const year = this.chart.data.labels[index];
                                const term = this.chart.getDatasetMeta(0).label;
                                getCumulativeLineIndexOfYearMonth(this.query, parseInt(year as string), 12, (rowIndexOfYear: number) => {
                                    const hoverEvent = new CustomEvent('bar-click', {
                                        detail: { "index": rowIndexOfYear, "term": term, "year": year, rowIndexOfYear: rowIndexOfYear},
                                    });
                                    this.dispatchEvent(hoverEvent);
                                });
                            }
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        },
                    },
                    scales: {
                        x: {
                            stacked: true,
                        },
                        y: {
                            stacked: true,
                        },
                    },
                },
            });
        }
    }

    setQuery(query: any) {
        this.query = query;
        const queryCopy = JSON.parse(JSON.stringify(this.query));
        queryCopy.query = 'articlesyearcounts';
        getAllRecords(queryCopy, (result: any) => {
            this.setTermsData(result);
        });
    }

    clearTermData() {
        if (this.chart) {
            this.chart.data.labels = [];
            this.chart.data.datasets = [];
            this.chart.update();
        }
    }

    setYearHighlight(year: number) {
        const index = year - 1857; // Adjust index to match the chart's x-axis labels
        this.activeIndex = index;
        this.chart?.update();
    }

    setTermsData(termDict: { [key: string]: number[] }) {
        // termDict is a dictionary of term keys, each with an array of counts.
        const currentYear = new Date().getFullYear();
        const minYear = 1857;
        const years = Array.from({ length: currentYear - minYear + 1 }, (_, i) => minYear + i);

        const colors = ['#4a90e2', '#FFA500', '#008000', '#0000FF', '#00FFFF', '#8A2BE2'];
        const owner = this;

        this.clearTermData();
        let colorIndex = 0;
        for (const [term, counts] of Object.entries(termDict.results)) {
            const dataset: ChartDataset<'bar'> = {
                label: (term ? ('Counts of Articles Containing "' + term + '"') : 'Article Counts by Year') +   " (Click a Bar to Jump to a Year's Articles)",
                data: counts as any as number[],
                backgroundColor: function (context: any) {
                    const idx = context.dataIndex;
                    return idx === owner.activeIndex ? 'red' : colors[0];
                }
            };
            // Increase the font size of the legend label (dataset label)
            if (owner.chart && owner.chart.options.plugins && owner.chart.options.plugins.legend) {
                owner.chart.options.plugins.legend.labels = {
                    ...owner.chart.options.plugins.legend.labels,
                    font: {
                        size: 18, // Set your desired font size here
                        weight: 'bold', // Optional: make the font bold
                    }
                };
            }
            if (this.chart) {
                this.chart.data.labels = years;
                this.chart.data.datasets.push(dataset);
                if (this.chart.options.scales && this.chart.options.scales.x) {
                    this.chart.options.scales.x.ticks = {
                        ...this.chart.options.scales.x.ticks,
                        font: {
                            size: 16, // Set the desired font size here
                            weight: 900, // Optional: make the font bold
                        },
                    };
                }
            }
            colorIndex++;
        }

        if (this.chart) {
            this.chart.update();
        }
    }
}
customElements.define('term-frequency-chart', TermFrequencyChart);
// ---------------------------- End Term Frequency Chart ----------------------------

// --------------------------------- Term Navigator --------------------------------
class TermNavigator extends HTMLElement {
    yearThumbnailGallery: YearThumbnailGallery;
    searchElement: SearchElement;
    // termRowHolder: TermRowHolder;
    dateSlider: DoubleSlider;
    scrollAreaName: string = 'scroll-area';
    scrollArea: HTMLElement | null = null;
    vListRenderCallback: ((index: number, query: any, incomingItem: ResultLineItem | null) => ResultLineItem) | null = null;
    listCache: VirtualizedList | null = null;
    startDateSeconds: number = 0;
    endDateSeconds: number = 0;
    rowHeightInPixels: number = 80;
    termFrequencyChart!: TermFrequencyChart;
    constructor() {
        super();
        const debouncedHandleChange = debounce(() => this.handleChange(), 300);

        this.yearThumbnailGallery = new YearThumbnailGallery();
        this.appendChild(this.yearThumbnailGallery);
        this.yearThumbnailGallery.id = 'year-thumbnail-gallery';
        this.yearThumbnailGallery.addEventListener('thumbnail-hover', (event: any) => {
            const url = event.detail.src;
            const thumbnailBounds = event.detail.thumbnailBounds;
            hoverCover(url, thumbnailBounds);
        });
        this.yearThumbnailGallery.addEventListener('thumbnail-click', (event: any) => {
            const src = event.detail.src;
            this.selectCover(src);
        });
        this.termFrequencyChart = new TermFrequencyChart();
        this.appendChild(this.termFrequencyChart);
        this.termFrequencyChart.addEventListener('bar-click', (event: any) => {
            const rowIndex = event.detail.index;
            this.listCache?.scrollToIndex(rowIndex);
            const year = event.detail.year;
            this.setGalleryYear(year);
        });

        this.dateSlider = new DoubleSlider((start, end) => {
            const startDate = new Date(start, 0, 1).getTime() / 1000; // an 1 of start year
            const endDate = new Date(end, 11, 31, 23, 59, 59).getTime() / 1000; // Dec 31 of end year
            this.setDateRange(startDate, endDate);
            debouncedHandleChange();
        });
        // this.appendChild(this.dateSlider);
        this.searchElement = new SearchElement(() => this.handleChange(), () => this.resetDateSlider());
        this.appendChild(this.searchElement);
        this.searchElement.style.position = 'relative';
        this.searchElement.style.left = '40px';

        const resultList = document.createElement('div');
        resultList.id = 'results';
        resultList.className = 'scroll-area-wrapper';
        resultList.innerHTML = `
      <div class="scroll-area-wrapper" id="scroll-area-wrapper">
          <div class="jviewer-item-count">0 Items</div>
          <div id="scroll-area" class="scroll-area">
              <ul id="list" class="hyperlist">
              </ul>
          </div>
      </div>      
      `;
        this.appendChild(resultList);
    }

    initialize() {
        this.searchElement.initialize();
        this.scrollArea = document.getElementById(this.scrollAreaName);
        if (!this.scrollArea) {
            console.error('Scroll area not found:', this.scrollAreaName);
            return;
        }
        this.vListRenderCallback = (index: number, query: any, incomingItem: ResultLineItem | null) => {
            let item;
            if (!incomingItem) {
                item = new ResultLineItem(
                    (author) => this.searchElement.setAuthor(author),
                    (url) => loadPage(url),
                    (url) => this.selectCover(url),
                    (url, thumbnailBounds) => hoverCover(url, thumbnailBounds),
                    this.rowHeightInPixels
                );
            } else {
                item = incomingItem;
            }
            getRecord(query, index, (record: any) => {
                if (record) {
                    item.date = record.date;
                    item.title = record.title;
                    item.snippet = record.snip;
                    item.blurb = record.blurb;
                    item.authors = record.authors;
                    item.articleUrl = record.link;
                    const year = record.year;
                    const month = record.month;
                    item.imageUrl = getImageUrlFromYearMonth(year, month);
                } else {
                    item.title = "Error loading record!";
                    item.snippet = "";
                    item.blurb = "";
                    item.authors = [];
                }
            });
            return item;
        }
        const query = this.getQuery();
        this.initializeListCache(query);
    }
    
    selectCover(url: string) {
        this.searchElement.clearAuthorField();
        this.searchElement.setSearchString('');
        const { year, month } = this.extractYearMonthFromCoverUrl(url);
        setTimeout(() => {
            getCumulativeLineIndexOfYearMonth(this.getQuery(), year, month, (rowIndexOfYear: number) => {
                this.listCache?.scrollToIndex(rowIndexOfYear);
            })
        }, 300);
    }

    extractYearMonthFromCoverUrl(url: string) {
        const match = url.match(/(\d{4})_(\d{1,2})\.jpg/);
        if (match) {
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            return { year, month };
        }
        const year = 2025;
        const month = 1;
        return { year, month };
    }

    async connectedCallback() {
        this.initialize();
        // this.rehydrate();
        this.handleChange();
        // this.updateResetAuthorButton();
    }

    selectAuthor(author: string) {
        this.searchElement.setAuthor(author);
    }

    setDateRange(startDateSeconds: number, endDateSeconds: number) {
        this.startDateSeconds = startDateSeconds;
        this.endDateSeconds = endDateSeconds;
    }

    resetDateSlider() {
        this.dateSlider.resetRange();
    }

    setGalleryYear(year: string) {
        this.yearThumbnailGallery.year = year;
        const query = { query: "monthsforyear", year: parseInt(year) };
        getAllRecords(query, (result: any) => {
            const yearNum = Number(year);
            const urls = result.results.map((item: number) => getImageUrlFromYearMonth(yearNum, item));
            this.yearThumbnailGallery.images = urls;
        });
    }

    async initializeListCache(query: any) {
        getQueryTotal(query, (response: any) => {
            if (response) {
                const totalItemCount = response.total_count;
                setTotalRecordCount(query, totalItemCount);
                this.listCache = new VirtualizedList(
                    this.scrollAreaName,
                    this.vListRenderCallback,
                    totalItemCount,
                    this.rowHeightInPixels,
                    query,
                    'tabid',
                    getQueryTotal,
                    (scrollIndex: number) => { 
                        const yearQuery = JSON.parse(JSON.stringify(this.getQuery()));
                        yearQuery.query = 'yearmonthofrecordindex'
                        yearQuery.index = scrollIndex;
                        getAllRecords(yearQuery, (result: any) => {
                            const yearMonth = result.results;
                            const year = yearMonth.year;
                            this.termFrequencyChart.setYearHighlight(year);
                            this.setGalleryYear(year.toString());
                        });
                    })
                }
        });
    }

    handleChange() {
        // clearPendingCache();
        const query = this.getQuery();
        if (this.listCache) {
            this.listCache.updateQuery(query);
        } else {
            this.initializeListCache(query);  // This should already have happened, but it can fail.
        }
        this.termFrequencyChart.setQuery(query);
    }

    getQuery(): { query: string, startdate: number, enddate: number, searchstring: string, author: string, terms: string[] | null } {
        const searchString = this.searchElement.getSearchString();
        const author = this.searchElement.getAuthor();
        const startDateSeconds = this.startDateSeconds;
        const endDateSeconds = this.endDateSeconds;
        const startYear = new Date(startDateSeconds * 1000).getFullYear();
        const endYear = new Date(endDateSeconds * 1000).getFullYear();
        const query = { query: 'collectionset', startdate: startYear, enddate: endYear, searchstring: searchString, terms: null, "author": author };
        return query
    }
}

customElements.define('term-navigator', TermNavigator);

function initializeDataCallbackCache(query: any) {
    const key = JSON.stringify(query);
    if (!dataCallbackCache[key]) {
        dataCallbackCache[key] = { callbacks: {} };
    }
    return key;
}

async function getAllRecords(query: any, sendResponse: (s: any) => void) {
    const queryDict = JSON.parse(JSON.stringify(query));
    // Serialize array values as JSON strings to preserve their structure
    const queryString = new URLSearchParams(queryDict).toString();
    const url = getFetchUrl() + '/request?' + queryString;
    await fetchSingle(url, sendResponse);
}

function processNewlyArrivedData(query: any, blockIndex: number, response: any) {
    // console.log(response);
    let recordIndex = 0
    const records = response.results;
    const key = initializeDataCallbackCache(query);
    for (let i = blockSize * blockIndex; i < blockSize * blockIndex + records.length; i++) {
        const record = records[recordIndex]
        saveRecordToCache(query, i, record);
        const callback = dataCallbackCache[key].callbacks[i];
        if (callback) {
            callback(record);
            delete dataCallbackCache[key].callbacks[i];
        }
        recordIndex++;
    }
}

function getQueryTotal(query: any, callback: (response: any) => void) {
    fetchBlockCount(query, callback);
}

function getRecord(query: any, index: number, sendResponse: (response: any) => void) {
    const blockIndex = Math.floor(index / blockSize);
    const key = initializeDataCallbackCache(query);
    const record = getRecordFromCache(query, index);
    if (record) {
        sendResponse(record);
        return;
    }
    dataCallbackCache[key].callbacks[index] = sendResponse;
    fetchBlockOffset(query, blockIndex, (response) => {
        if (response) {
            processNewlyArrivedData(query, blockIndex, response);
        }
    });
}

// function getServerAdmin(key: string, callback: (response: any) => void) {
//   const url = getFetchUrl() + '/admin?key=' + key;
//   fetchSingle(url, callback);
// }

function fetchBlockCount(query: any, callback: (response: any) => void) {
    // clearOldPendingCacheEntries();
    // if (isPending(query, -1)) {
    //     return null;
    // }
    // addToPendingCache(query, -1);
    const queryDict = JSON.parse(JSON.stringify(query));
    queryDict.query = 'collectionsetcount';
    const queryString = new URLSearchParams(queryDict).toString();
    const url = getFetchUrl() + '/request?' + queryString;
    fetchSingle(url, callback);
}

function fetchBlockOffset(query: any, blockIndex: number, callback: (response: any) => void) {
    // clearOldPendingCacheEntries();
    // if (isPending(query, blockIndex)) {
    //     return;
    // }
    // console.log('fetchBlockOffset', query, blockIndex);
    // addToPendingCache(query, blockIndex);
    const queryDict = JSON.parse(JSON.stringify(query));
    queryDict.limit = blockSize;
    queryDict.offset = blockIndex * blockSize;
    const queryString = new URLSearchParams(queryDict).toString();
    const url = getFetchUrl() + '/request?' + queryString;
    fetchSingle(url, callback);
}

function shouldExecuteFetchSingle(url: string, callback: any): boolean {
    const record = fetchSingleCache.get(url);
    if (!record) {
        fetchSingleCache.set(url, { url: url, response: null, callback: callback, nextTryTime: Date.now() + 2000 })
        return true;
    }
    if (record.nextTryTime === 0) {
        // The response is in the cache.  Just call the callback.
        callback(record.response);
        return false;
    }
    if (record.nextTryTime === -1) {
        // The fetch failed before.  Don't execute the fetch again.
        return false;
    }
    if (record.nextTryTime > Date.now()) {
        // The next try time is in the future.  Don't execute the fetch.
        return false;
    }
    record.nextTryTime = Date.now() + 2000;
    return true;
}

function fetchSingleSucceeded(url: string, callback: any, response: any) {
    const record = fetchSingleCache.get(url);
    if (record) {
        record.response = response;
        record.nextTryTime = 0; // Mark as successful
        callback(response);
    } else {
        console.error('No record found for URL:', url);
    }
}

function fetchSingleFailed(url: string) {
    const record = fetchSingleCache.get(url);
    if (record) {
        record.nextTryTime = -1; // Mark as failed
        record.response = null;
    }
}

async function fetchSingleScanForRetries() {
    for (const record of fetchSingleCache.values()) {
        if (record.nextTryTime > Date.now()) {
            await fetchSingle(record.url, record.callback);
        }
    }
}

async function startScanningForFetchSingleRetries() {
    // The risk we're trying to address is that web service requests might get caught behind a cold-starting Lambda function.  
    // We can periodically check for any requests that are pending
    // and retry them on the assumption that a Lambda function instance is now free (even though the cold-starting function instance may still be initializing).
    if (fetchSingleScanInterval) {
        clearInterval(fetchSingleScanInterval);
    }
    fetchSingleScanInterval = setInterval(() => {
        fetchSingleScanForRetries();
    }, 5000);
}

async function fetchSingle(url: string, callback: (response: any) => void) {
    try {
        if (!shouldExecuteFetchSingle(url, callback)) {
            return;
        }
        // console.log('Fetching:', url);
        // const startTime = Date.now();
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const jsonResponse = await response.json();
        // console.log('Fetch response:', jsonResponse);
        // const duration = Date.now() - startTime;
        // console.log('Fetch duration (' + url + '):', duration, 'ms');
        fetchSingleSucceeded(url, callback, jsonResponse);
    } catch (error) {
        console.error('Error fetching:', url, error);
        fetchSingleFailed(url);
    }
}

function pingTest() {
    updateTitleWithFetchUrl();
    const queryDict = { "query": "ping", "random": Math.random().toString(36) };
    const queryString = new URLSearchParams(queryDict).toString();
    // const url = fetchUrl + '/request?' + queryString;
    for (let i = 0; i < fetchUrls.length; i++) {
        const fetchUrlObj = fetchUrls[i];
        const url = fetchUrlObj.url + '/request?' + queryString;
        fetchUrlObj.latency = Number.MAX_SAFE_INTEGER;
        try {
            const startTime = Date.now();
            fetchSingle(url, (response) => {
                const duration = Date.now() - startTime;
                fetchUrlObj.latency = duration;
                fetchUrlObj.timestamp = response.build_timestamp;
                fetchUrlObj.crawltime = response.crawl_time;
                console.log('Build: ' + fetchUrlObj.timestamp + ' Crawl: ' + fetchUrlObj.crawltime + ' ' + fetchUrlObj.region + ' Latency: ' + fetchUrlObj.latency + 'ms');
            });
        } catch (error) {
            console.error(`Error fetching from ${fetchUrlObj.region}:`, error);
        }
    }
}

function updateTitleWithFetchUrl() {
    const titleElement = document.querySelector('title');
    if (titleElement) {
        const currentUrl = getFetchUrl();
        const fetchUrlObj = fetchUrls.find(urlObj => urlObj.url === currentUrl);
        if (fetchUrlObj) {
            titleElement.textContent = `Pelagic Archive - ${fetchUrlObj.region} (${fetchUrlObj.latency}ms)`;
        } else {
            titleElement.textContent = 'Pelagic Archive';
        }
    }
}

function getFetchUrl() {
    const currentTime = Date.now();
    if (currentTime - lastPingTestTime > pingIntervalSeconds) {
        lastPingTestTime = currentTime;
        pingTest();
    }

    const sortedUrls = fetchUrls.sort((a, b) => a.latency - b.latency);
    return sortedUrls[0]?.url || fetchUrl;
}
// ======================== End Server Database ========================

/* --------------------------------------------------------------------------
   🔹 Total Count Functions (setTotal, getTotal)
   -------------------------------------------------------------------------- */

// Store total count of records for a query
function setTotalRecordCount(query: any, total: number) {
    const queryKey = normalizeQuery(query);
    sessionStorage.setItem(queryKey, JSON.stringify(total));
}

function normalizeQuery(query: any) {
    return LZString.compressToUTF16(JSON.stringify(query, Object.keys(query).sort()));
}

function saveRecordToCache(query: any, index: number, record: any) {
    const queryStr = normalizeQuery(query);
    const key = queryStr + ':' + index;
    try {
        sessionStorage.setItem(key, JSON.stringify(LZString.compressToUTF16(record)));
    } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
            // If sessionStorage is full, clear it and try again once
            sessionStorage.clear();
            try {
                sessionStorage.setItem(key, JSON.stringify(LZString.compressToUTF16(record)));
            } catch (e) {
                console.error('Failed to save record to cache after clearing sessionStorage:', e);
            }
        } else {
            console.error('Error saving record to cache:', error);
        }
    }
}

function getRecordFromCache(query: any, index: number): any {
    const queryStr = normalizeQuery(query);
    const key = queryStr + ':' + index;
    const compressedRecord = sessionStorage.getItem(key);
    let record: string | null = null;
    if (compressedRecord) {
        record = LZString.decompressFromUTF16(compressedRecord);
    }
    return record ? JSON.parse(record) : null;
}