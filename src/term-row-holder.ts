import { LitElement, html, css } from 'lit';
import type { TermRow } from './term-row'; // Ensure TermRow is exported from term-row.js
import type { CompoundButton } from './compound-button'; // Ensure CompoundButton is exported from compound-button.js
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';

/**
 * <term-row-holder>
 *
 * Manages a vertical stack of <term-row>s.
 *
 * API:
 * - addRow(terms?: string[]): append a new term-row (skeleton if terms omitted).
 * - setLastRowTerms(terms: string[]): populate the newest skeleton row with terms.
 * - getLastRowSelectedTerms(): string[]
 * - getQueryTerms(): { included: string[], excluded: string[] }
 *
 * Behavior:
 * - On any compound-button `term-click`: toggles selection, prunes following rows,
 *   emits `selectionChanged` with the current bottom row's selected terms, and
 *   if any selected adds a fresh skeleton row.
 * - On any term-row `row-state-change`: emits `queryChanged` with aggregated included/excluded.
 */
export class TermRowHolder extends LitElement {
  terms: { term: string, state: string, isSelected: false, matchCount: 0 }[] = [];

  static styles = css`
    :host {
      display: block;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  `;

  constructor() {
    super();
  }

  render() {
    return html`
      <div style="display: flex; align-items: center; gap: 0.5rem;">
      <sl-icon-button name="trash" label="Reset" @click=${this.reset}></sl-icon-button>
      <div class="rows" style="overflow-x: auto; white-space: nowrap;"></div>
      </div>
    `;
  }

  firstUpdated() {
    const container = this.getContainer();
    if (!container) return;
    // Listen for child selection and state-change events
    container.addEventListener('button-hover-change', e =>  this._handleButtonHover(e as CustomEvent));
    container.addEventListener('row-selection-change', e => this._handleSelection(e as CustomEvent));
    container.addEventListener('row-check-change', e => this._emitQueryChanged(e as CustomEvent));
  }

  getContainer() {
    return this.shadowRoot?.querySelector('.rows');
  }

  dehydrate() {
    const container = this.getContainer();
    if (!container) return;
    const rows = Array.from(container.children) as TermRow[];
    const memento = rows.map(r => r.dehydrate());
    return memento;
  }

  rehydrate(memento: { term: string, state: string, isSelected: false, matchCount: 0 }[]) {  
    const container = this.getContainer();
    if (!container) return;
    this.terms = memento;
    this.terms.forEach(t => {
      const row = document.createElement('term-row') as TermRow;
      container.appendChild(row);
      row.hydrate({ [t.term]: t });
    });
    this.requestUpdate();
  }

  setMatchCounts(dict: Object) {
    const container = this.getContainer();
    if (!container) return;
    const rows = Array.from(container.children) as TermRow[];
    rows.forEach(r => {
      Object.entries(dict).forEach(([key, value]) => {
        r.setMatchCount(key, value);
      });
    });
  }

  addRow(terms: string[] = []) {
    const row = document.createElement('term-row') as TermRow;
    row.setTerms(terms)
    const container = this.getContainer();
    if (!container) return;
    container.appendChild(row);
    const checkedTerms = this.getCheckedTerms();
    checkedTerms.forEach(term => {
      row.setState(term, 'checked');
    });
    this.requestUpdate();
  }

  selectTermsForCheck(terms: string[]) {
    const container = this.getContainer();
    if (!container) return;
    const rows = Array.from(container.children) as TermRow[];
    rows.forEach(r => {
      r.selectTermsForCheck(terms);
    });
  }

  _handleSelection(event: CustomEvent) {
    // A term has changed state in a child row.
    // Which row?
    const row = event.detail.row;
    this.trimRowsAfter(row);
    this.dispatchEvent(new CustomEvent('selectionChanged', {
      bubbles: true,
      composed: true
    }));
  }

  _handleButtonHover(event: CustomEvent) {
    // A term has changed state in a child row.
    // Which row?
    this.dispatchEvent(new CustomEvent('buttonHoverChange', {
      detail: { term: event.detail.term },
      bubbles: true,
      composed: true
    }));
  }

  trimRowsAfter(row: TermRow) {
    const container = this.getContainer();
    if (!container) return;
    while (container.lastChild && container.lastChild !== row) {
      container.removeChild(container.lastChild);
    }
    if (container.children.length > 1 && !(container.lastChild as TermRow).hasSelectedTerms()) {
        if (container.lastChild) {
          container.lastChild.remove();
        }
    }
  }

  _emitQueryChanged(event: CustomEvent) {
    const term = event.detail.term;
    const state = event.detail.state;
    // Propagate the term state to all occurrences of the term in all of the rows.
    const container = this.getContainer();
    if (!container) return;
    const rows = Array.from(container.children) as TermRow[];
    for (const r of rows) {
      r.setState(term, state);
    }
    this.dispatchEvent(new CustomEvent('queryChanged', {
      detail: { term: term, state: state },
      bubbles: true,
      composed: true
    }));
    this.requestUpdate();
  }

  /** Selected terms in the bottom-most populated row */
  getLastRowSelectedTerms() {
    const container = this.getContainer();
    if (!container) return [];
    const rows = Array.from(container.children) as TermRow[];
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (Array.isArray(r.terms) && r.terms.length) {
        return Array.from(
          r.querySelectorAll('compound-button[selected]') as unknown as CompoundButton[]
        ).map(b => b.term);
      }
    }
    return [];
  }

  addTermsToTopmostRow(terms: string[]) {
    const container = this.getContainer();
    if (!container) return;
    const row = Array.from(container.children)[0] as TermRow
    if (row) {
      terms.forEach(term => {
        row.addNewTerm(term);
      });
    } else {
      this.addRow(terms);
    }
  }

  getSelectedTerms() {
    const container = this.getContainer();
    if (!container) return [];
    const rows = Array.from(container.children) as TermRow[];
    let selected = [];
    for (const r of rows) {
      selected.push(...r.getSelectedTerms());
    }
    selected = Array.from(new Set(selected));
    return selected;
  }

  /** Aggregate include across all rows */
  getCheckedTerms() {
    const container = this.getContainer();
    if (!container) return [];
    const rows = Array.from(container.children) as TermRow[];
    let included = [];
    for (const r of rows) {
      included.push(...r.getCheckedTerms());
    }
    included = Array.from(new Set(included));
    return included;
  }

  getTentativeTerms() {
    const container = this.getContainer();
    if (!container) return [];
    const rows = Array.from(container.children) as TermRow[];
    let tentative = [];
    for (const r of rows) {
      tentative.push(...r.getTentativeTerms());
    }
    tentative = Array.from(new Set(tentative));
    return tentative;
  }

  getAllTerms() {
    const container = this.getContainer();
    if (!container) return [];
    const rows = Array.from(container.children) as TermRow[];
    let all = [];
    for (const r of rows) {
      all.push(...r.getTerms());
    }
    all = Array.from(new Set(all));
    return all;
  }

  /** Remove all term-rows */
  reset() {
    const container = this.getContainer();
    if (!container) return;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    this._emitQueryChanged(
        new CustomEvent('row-check-change', {
            detail: { term: '', state: 'unchecked' },
            bubbles: true,
            composed: true
        }))
    }
}

customElements.define('term-row-holder', TermRowHolder);