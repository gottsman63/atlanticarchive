import './style.css'
// Import Shoelace components
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/themes/light.css';
// Optionally register all Shoelace components at once
// import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
// setBasePath('/node_modules/@shoelace-style/shoelace/dist/');

// Import noUiSlider
import 'nouislider/dist/nouislider.css';
import noUiSlider from 'nouislider';
import wNumb from 'wnumb';
import './vlist.js'; // likewise
import './compound-button.js';
import './term-row.js';
import { TermRowHolder } from './term-row-holder';
import { VirtualizedList } from './vlist';

const fetchUrl = 'https://ocf23hr7gvdwnjvqjdxkyfn72q0krmpf.lambda-url.eu-west-1.on.aws/'; // Default URL

const fetchUrls = [
  { url: 'https://ocf23hr7gvdwnjvqjdxkyfn72q0krmpf.lambda-url.eu-west-1.on.aws/', region: 'Ireland', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
  { url: 'https://ag7chsk5zm74er3oatpdh6j24m0koppw.lambda-url.us-east-2.on.aws/', region: 'Ohio', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
  { url: 'https://73jo4qs6ly7d3yvmtau6ueh2vi0nwqwd.lambda-url.eu-west-2.on.aws/', region: 'London', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
  { url: 'https://xfpv2livbazgnqjp4gfjc4rlia0pgfey.lambda-url.us-west-2.on.aws/', region: 'Oregon', latency: Number.MAX_SAFE_INTEGER, timestamp: 0, crawltime: 0 },
];

let pendingQueries: { [key: string]: any } = {};
const blockSize = 50;
const dataCallbackCache: { [key: string]: any } = {};
const cacheForGetAllRecords: { [key: string]: any } = {};
let lastPingTestTime = 0;
const pingIntervalSeconds = 1 * 60 * 1000; // 5 minutes

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

function highlightSnippet(snippet: string | null): string {
  try {
      if (snippet) {
          let s = snippet.replace(/<em>/g, '<span class="jviewer-snippet-emphasis">');
          let s2 = s.replace(/<\/em>/g, '</span>');
          let s3 = s2.replace(/< em >/g, '<span class="jviewer-snippet-emphasis">');
          let s4 = s3.replace(/<\/ em >/g, '</span>');
          let snip = '<span class="jviewer-snippet">' + s4 + '</span>';
          return snip;
      } else {
          return "";
      }
  } catch (error) {
      console.error("Error in highlightSnippet:", error);
      return "";
  }
}

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
      const minYear = 1984;
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
}

customElements.define("double-slider", DoubleSlider);
// ------------------------- End Date Slider ----------------------------

// ------------------------------ Search Element --------------------------------
class SearchElement extends HTMLElement {
  changeCallback: () => void;

  constructor(changeCallback: () => void) {
      super();
      this.innerHTML = `
      <div class="jviewer-search-bar">
        <sl-input id="search-string" placeholder="Words in any order" size="medium" pill clearable></sl-input>
      </div>
        `;

        const debouncedHandleInputChange = debounce(this.handleInputChange, 400);

      // Attach a single event listener to the parent div
      this.querySelectorAll('sl-input').forEach(input => {
          input.addEventListener('input', debouncedHandleInputChange);
          input.addEventListener('sl-clear', this.handleInputChange); // no need to debounce this
      });

      this.changeCallback = changeCallback;

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
  }

  getSearchString(): string {
    const searchString = sessionStorage.getItem('searchString');
    return searchString || '';
  }

  setSearchString(s: string) {
    sessionStorage.setItem('searchString', s);
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

// --------------------------------- Term Navigator --------------------------------
class TermNavigator extends HTMLElement {
  searchElement: SearchElement;
  termRowHolder: TermRowHolder;
  scrollAreaName: string = '';
  scrollArea: HTMLElement | null = null;
  vListRenderCallback: ((index: number, query: any, incomingItem: HTMLElement | null) => HTMLElement) | null = null;
  listCache: VirtualizedList | null = null;
  startDateSeconds: number = 0;
  endDateSeconds: number = 0;

  constructor() {
      super();
      const debouncedHandleChange = debounce(() => this.handleChange(), 400);
      const dateSlider = new DoubleSlider((start, end) => {
        const startDate = new Date(start, 0, 1).getTime() / 1000; // Jan 1 of start year
        const endDate = new Date(end, 11, 31, 23, 59, 59).getTime() / 1000; // Dec 31 of end year
        this.setDateRange(startDate, endDate);
        debouncedHandleChange();
      });
      this.appendChild(dateSlider);

      this.searchElement = new SearchElement(() => { this.handleChange(); });
      this.appendChild(this.searchElement);
      this.searchElement.style.position = 'relative';
      this.searchElement.style.left = '40px';
      this.termRowHolder = new TermRowHolder();
      this.appendChild(this.termRowHolder);
      this.termRowHolder.addEventListener('queryChanged', (_event) => {
          const checkedTerms = this.termRowHolder.getCheckedTerms();
          const tentativeTerms = this.termRowHolder.getTentativeTerms();
          const terms = checkedTerms.concat(tentativeTerms);
          const trimmedTerms = terms.map(term => term.trim()).filter(term => term !== '');
          console.log('trimmedTerms:', trimmedTerms);
          this.searchElement.setSearchString(trimmedTerms.join(' '));
          this.resetMatchCounts();
          this.dehydrate();
      });
      this.termRowHolder.addEventListener('selectionChanged', (_event) => {
        const searchTerms = this.searchElement.getSearchString().split(' ');
          const relatedQuery = { "query": "relatedterms", "terms": searchTerms};
          // console.log('relatedQuery:', relatedQuery);
          getAllRecords(relatedQuery, (result: any) => {
              const relatedTerms: string[] = result;
              const lowercaseTerms = relatedTerms.map(term => term.toLowerCase());
              if (lowercaseTerms.length > 0) {
                  this.termRowHolder.addRow(lowercaseTerms);
              }
              this.resetMatchCounts();
              this.dehydrate();
          });
      });
      // const debouncedHandleChange = debounce(() => this.handleChange(), 200);
      const resultList = document.createElement('div');
      resultList.id = 'results';
      resultList.className = 'scroll-area-wrapper';
      resultList.innerHTML = `
      <div class="scroll-area-wrapper" id="scroll-area-wrapper">
          <div class="jviewer-item-count">0 Items</div>
          <div id="-scroll-area" class="scroll-area full-height-scroll-area">
              <ul id="list" class="hyperlist">
              </ul>
          </div>
      </div>      
      `;
      this.appendChild(resultList);
      setTimeout(() => {
          this.rehydrate();
      }, 200);
  }

  initialize() {
      this.searchElement.initialize();
      this.scrollAreaName = 'scroll-area';
      console.log('scrollAreaName:', this.scrollAreaName);
      this.scrollArea = document.getElementById(this.scrollAreaName);
      if (!this.scrollArea) {
          console.error('Scroll area not found:', this.scrollAreaName);
          return;
      }
      this.vListRenderCallback = (index, query, incomingItem) => {
          let item;
          if (!incomingItem) {
              item = document.createElement('div');
              item.classList.add('scroll-item'); // Apply the CSS class to the item
              item.style.height = '30px'; // Ensure row height matches `itemHeight`
              item.textContent = "Loading..." + index; // + ' ' + this.tabName + ' ' + JSON.stringify(query); // Placeholder content
          } else {
              item = incomingItem;
          }
          getRecord(query, index, (record: any) => {
              if (record) {
                  const date = record.date;
                  let dateString = '<no date>';
                  if (date > 0) {
                      dateString = '<span class="date">' + (new Date(date * 1000).toISOString().split('T')[0]) + '</span>';
                  }
                  const title = '<span class="wiki-category-name"> ' + record.collection + ' </span>' + dateString + ' <span class="jviewer-title">' + record.title + '</span>';
                  const snip = highlightSnippet(record.snip);
                  item.textContent = '';
                  item.innerHTML = title + snip;
                  item.title = '    Ctrl/Cmd-Click to open...\n' + record.link + '\n    ...in a new tab.';
                  item.addEventListener('click', (event) => {
                      if (event.ctrlKey || event.metaKey || event.button === 1) { // Check if Ctrl key (or Cmd key on macOS) is pressed
                          loadPage(record.link, true); // Open in new tab
                      } else {
                          loadPage(record.link); // Open in current tab
                      }
                  });
                  item.style.cursor = 'pointer';
              } else {
                  item.textContent = "Error loading record!";
              }
          });
          return item;
      }
      const query = this.getQuery();
      this.initializeListCache(query);
  }

  async connectedCallback() {
      await this.initialize();
      await this.handleChange();
  }

  setDateRange(startDateSeconds: number, endDateSeconds: number) {
    this.startDateSeconds = startDateSeconds;
    this.endDateSeconds = endDateSeconds;
}

  resetMatchCounts() {
      const tentativeTerms = this.termRowHolder.getTentativeTerms();
      if (tentativeTerms.length > 0) {
          return;
      }
      const query = this.getQuery();
      const terms = this.termRowHolder.getAllTerms();
      query.terms = terms;
      query.query = 'incrementalresultcounts';
      getAllRecords(query, (response: any) => {
          console.log('resetMatchCounts:', response);
          this.termRowHolder.setMatchCounts(response);
          this.dehydrate();
      });
  }

  dehydrate() {
      const termHolderMemento = this.termRowHolder.dehydrate();
      const memento = {
          termRowHolder: termHolderMemento,
          searchElement: this.searchElement.getSearchString()
      };
      sessionStorage.setItem('memento', JSON.stringify(memento));
  }

  rehydrate() {
      const memento = JSON.parse(sessionStorage.getItem('memento') as string);
      if (!memento) {
          return;
      }
      if (this.termRowHolder) {
          this.termRowHolder.rehydrate(memento.termRowHolder);
      } else {
          console.error('termRowHolder is not initialized.');
      }
      this.searchElement.setSearchString(memento.searchString);
      this.handleChange();
  }

  async initializeListCache(query: any) {
      getQueryTotal(query, (response: any) => {
          if (response) {
              const totalItemCount = response.total_count;
              setTotal(query, totalItemCount);
              this.listCache = new VirtualizedList(
                  this.scrollAreaName,
                  this.vListRenderCallback,
                  totalItemCount,
                  30,
                  query,
                  'tabid',
                  getQueryTotal);
          }
      });
  }

  handleChange() {
      clearPendingCache();
      const query = this.getQuery();
      if (this.listCache) {
          this.listCache.updateQuery(query);
      } else {
          this.initializeListCache(query);  // This should already have happened, but it can fail.
      }
      const terms = query.searchstring.trim().split(' ');
      const tentativeTerms = this.termRowHolder.getTentativeTerms();
      const nonTentativeTerms = terms.filter(term => !tentativeTerms.includes(term));
      const trimmedNonTentativeTerms = nonTentativeTerms.map(term => term.trim()).filter(term => term !== '');
      this.termRowHolder.addTermsToTopmostRow(trimmedNonTentativeTerms);
      this.termRowHolder.selectTermsForCheck(trimmedNonTentativeTerms);
      this.resetMatchCounts();
  }

  getQuery(): {query: string, startdate: number, enddate: number, searchstring: string, terms: string[] | null} {
      const searchString = this.searchElement.getSearchString();
      const startDateSeconds = this.startDateSeconds;
      const endDateSeconds = this.endDateSeconds;
      const startYear = new Date(startDateSeconds * 1000).getFullYear();
      const endYear = new Date(endDateSeconds * 1000).getFullYear();
      const query = { query: 'collectionset', startdate: startYear, enddate: endYear, searchstring: searchString, terms: null };
      return query
  }
}

customElements.define('term-navigator', TermNavigator);


// =========================== Server Database =========================
// function getQueryBlockKey(queryKey, blockIndex) {
//   return queryKey + ": " + blockIndex;
// }

function isPending(query: any, blockIndex: number) {
  const key = JSON.stringify(query) + blockIndex;
  const record = pendingQueries[key];
  if (record) {
      const time = Date.now() - record.time;
      if (time > 2 * 1000) {
          delete pendingQueries[key];
          return false;
      }
  } else {
      return false;
  }
  return pendingQueries[key];
}

function addToPendingCache(query: any, blockIndex: number) {
  const key = JSON.stringify(query) + blockIndex;
  if (!pendingQueries[key]) {
      pendingQueries[key] = { query: query, blockIndex: blockIndex, time: Date.now() };
  }
}

function clearPendingCache() {
  pendingQueries = {};
}

function initializeDataCallbackCache(query: any) {
  const key = JSON.stringify(query);
  if (!dataCallbackCache[key]) {
      dataCallbackCache[key] = { callbacks: {} };
  }
  return key;
}

async function getAllRecords(query: any, sendResponse: (s: any) => void) {
  const queryKey = JSON.stringify(query);
  if (cacheForGetAllRecords[queryKey]) {
      sendResponse(cacheForGetAllRecords[queryKey]);
      return;
  }
  if (isPending(queryKey, 0)) {
      return;
  }
  addToPendingCache(query, 0);
  const queryDict = JSON.parse(JSON.stringify(query));
  // Serialize array values as JSON strings to preserve their structure
  const queryString = new URLSearchParams(queryDict).toString();
  const url = getFetchUrl() + '/request?' + queryString;
  try {
      let response = await fetch(url, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
          }
      });
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      let jsonResponse = await response.json();
      // console.log('getAllRecords response:', jsonResponse);
      if (jsonResponse.error) {
          console.error('Error in response:', jsonResponse.error);
          console.error('Query:', JSON.stringify(queryDict));
      } else {
          cacheForGetAllRecords[queryKey] = jsonResponse.results;
          sendResponse(jsonResponse.results);
      }
  } catch (error) {
      console.error('Error fetching block:', error);
      console.error('Query:', JSON.stringify(queryDict));
      delete pendingQueries[queryKey]; // Prevent infinite retries
      return null;
  }
}

function processNewlyArrivedData(query: any, blockIndex: number, response: any) {
  // console.log(response);
  let recordIndex = 0
  const records = response.results;
  const key = initializeDataCallbackCache(query);
  for (let i = blockSize * blockIndex; i < blockSize * blockIndex + records.length; i++) {
      const record = records[recordIndex]
      saveToCache(query, i, record);
      const callback = dataCallbackCache[key].callbacks[i];
      if (callback) {
          callback(record);
          delete dataCallbackCache[key].callbacks[i];
      }
      recordIndex++;
  }
}

function getQueryTotal(query: any, callback: (response: any) => void) {
  const response = fetchBlockCount(query, callback);
  return response;
}

function getRecord(query: any, index: number, sendResponse: (response: any) => void) {
  const blockIndex = Math.floor(index / blockSize);
  const key = initializeDataCallbackCache(query);
  const record = getFromCache(query, index);
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

function fetchBlockCount(query: any, callback: (response: any) => void ) {
  if (isPending(query, -1)) {
      return null;
  }
  addToPendingCache(query, -1);
  const queryDict = JSON.parse(JSON.stringify(query));
  queryDict.query = 'collectionsetcount';
  const queryString = new URLSearchParams(queryDict).toString();
  const url = getFetchUrl() + '/request?' + queryString;
  fetchSingle(url, callback);
}

function fetchBlockOffset(query: any, blockIndex: number, callback: (response: any) => void) {
  if (isPending(query, blockIndex)) {
      return;
  }
  addToPendingCache(query, blockIndex);
  const queryDict = JSON.parse(JSON.stringify(query));
  queryDict.limit = blockSize;
  queryDict.offset = blockIndex * blockSize;
  const queryString = new URLSearchParams(queryDict).toString();
  const url = getFetchUrl() + '/request?' + queryString;
  fetchSingle(url, callback);
}

async function fetchSingle(url: string, callback: (response: any) => void) {
  try {
      const response = await fetch(url, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
          }
      });
      const jsonResponse = await response.json();
      callback(jsonResponse);
  } catch (error) {
      console.error('Error fetching:', url, error);
  }
}

function pingTest() {
  const queryDict = { "query": "ping" }
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

function getFetchUrl() {
  const currentTime = Date.now();
  if (currentTime - lastPingTestTime > pingIntervalSeconds) {
      lastPingTestTime = currentTime;
      pingTest();
  }

  const sortedUrls = fetchUrls.sort((a, b) => a.latency - b.latency);
  return sortedUrls[0]?.url || fetchUrl;
}

async function updateServerLabel() {
  try {
      const sortedUrls = fetchUrls.sort((a, b) => a.latency - b.latency);
      const fetchUrlObj = sortedUrls[0];
      const startTime = Date.now();
      const queryDict = { "query": "ping" }
      const queryString = new URLSearchParams(queryDict).toString();
      const url = fetchUrlObj.url + '/request?' + queryString;
      fetchSingle(url, (response) => {
          const duration = Date.now() - startTime;
          fetchUrlObj.latency = duration;
          fetchUrlObj.timestamp = response.build_timestamp;
          fetchUrlObj.crawltime = response.crawl_time;
          console.log('Build: ' + fetchUrlObj.timestamp + ' Crawl: ' + fetchUrlObj.crawltime + ' ' + fetchUrlObj.region + ' Latency: ' + fetchUrlObj.latency + 'ms')
      });
  } catch (error) {
      console.error(`Error fetching: `, error);
  }

}
// ======================== End Server Database ========================

/* --------------------------------------------------------------------------
   🔹 Total Count Functions (setTotal, getTotal)
   -------------------------------------------------------------------------- */

// Store total count of records for a query
async function setTotal(query: any, total: number) {
  const queryKey = normalizeQuery(query);
  sessionStorage.setItem(queryKey, JSON.stringify(total));
}

// Retrieve total count for a given query
async function getTotal(query: any) {
  const queryKey = normalizeQuery(query);
  const total = sessionStorage.getItem(queryKey);
  if (total) {
      return parseInt(total, 10);
  }
  return null;
}

function normalizeQuery(query: any) {
  return JSON.stringify(query, Object.keys(query).sort());
}

function saveToCache(query: any, index: number, record: any) {
  const queryStr = normalizeQuery(query);
  const key = queryStr + ':' + index;
  sessionStorage.setItem(key, JSON.stringify(record));
}

function getFromCache(query: any, index: number): any {
  const queryStr = normalizeQuery(query);
  const key = queryStr + ':' + index;
  const record = sessionStorage.getItem(key);
  if (record) {
      return JSON.parse(record);
  }
  return null;
}