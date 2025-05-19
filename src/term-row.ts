import { LitElement, html, css } from 'lit';
import './compound-button';
import { CompoundButton } from './compound-button';

/**
 * <term-row>
 *
 * Displays either a loading skeleton or a row of compound-buttons.
 * Emits a `row-state-change` event with { included, excluded, neutral } whenever any child's state changes.
 *
 * Methods:
 * - setTerms(terms: string[], selected: boolean = false):
 *     populates the row with terms and sets all child buttons to 'checked' if selected=true, else 'unchecked'.
 */
export class TermRow extends LitElement {
  terms!: Record<string, any>;
  // terms: { term: string, state: string, isSelected: false, matchCount: 0 }[] = [];

  // static properties = {
  //   /** The array of terms to render */
  //   terms: { type: Object },
  // };

  static styles = css`
    :host {
      display: block;
      margin: 0.05rem 0;
    }

    .button-row {
      display: flex;
      overflow-x: auto;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .button-row::-webkit-scrollbar {
      height: 3px;
    }

    .button-row::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 4px;
    }

    .button-row::-webkit-scrollbar-thumb:hover {
      background: #aaa;
    }
  `;

  constructor() {
    super();
    this.terms = {};
  }

  render() {
    return html`
      <div class="button-row">
      ${Object.values(this.terms).map(
      obj => html`
      <compound-button
        .term=${obj.term}
        .state=${obj.state}
        .matchCount=${obj.matchCount}
        ?selected=${obj.isSelected}
        @state-change=${(event: CustomEvent) => this._onChildStateChange(event)}
        @selection-change=${(event: CustomEvent) => this._onChildSelectionChange(event)}
        @button-hover-change=${(event: CustomEvent) => this._dispatchButtonHoverChange(event)}
      ></compound-button>
      `
    )}
      </div>
    `;
  }

  dehydrate() {
    return this.terms;
  }

  hydrate(terms: Record<string, { term: string; state: string; matchCount: number; isSelected: boolean }>) {
    if (terms) {
      this.terms = terms;
    } else {
      this.terms = {};
    }
    this.requestUpdate();
  }

  getState(term: string) {
    return this.terms[term].state;
  }

  setState(term: string, state: string) {
    if (this.terms[term]) {
      this.terms[term].state = state;
      this.requestUpdate();
    }
  }

  setMatchCount(term: string, count: number) {
    if (this.terms[term]) {
      this.terms[term].matchCount = count;
      this.shadowRoot?.querySelectorAll<CompoundButton>('compound-button').forEach(button => {
        button.requestUpdate();
      });
      this.requestUpdate();
    }
  }

  /** Handle child state-change: re-emit aggregated state immediately */
  _onChildStateChange(event: CustomEvent) {
    this._dispatchStateChange(event);
  }

  _onChildSelectionChange(event: CustomEvent) {
    const target = event.target as any;
    const term = target.term;
    const isSelected = target.isSelected;
    this.terms[term].isSelected = isSelected;
    this._dispatchSelectionChange();
  }

  _dispatchButtonHoverChange(event: CustomEvent) {
    this.dispatchEvent(new CustomEvent('button-hover-change', {
      detail: {
        term: event.detail.term
      }
    }));
  }

  _dispatchSelectionChange() {
    this.dispatchEvent(new CustomEvent('row-selection-change', {
      detail: {
        row: this,
      },
      bubbles: true,
      composed: true
    }));
  }

  /** Compute and dispatch the current checked row state based on DOM */
  _dispatchStateChange(event: CustomEvent) {
    const target = event.target as any;
    const term = target.term;
    const state = target.state;
    this.terms[term].state = state;
    this.dispatchEvent(new CustomEvent('row-check-change', {
      detail: {
        term: term,
        state: state
      },
      bubbles: true,
      composed: true
    }));
  }

  getTerms() {
    return Object.values(this.terms).map(obj => obj.term);
  }

  hasSelectedTerms() {
    return Object.values(this.terms).some(obj => obj.isSelected);
  }

  addNewTerm(term: string, state = 'checked') {
    if (this.terms[term]) {
      return;
    }
    if (!term) {
      return;
    }
    const myTerms = Object.values(this.terms).map(obj => obj.term);
    if (myTerms && myTerms.length > 0 && myTerms[0]) {
      if (term.startsWith(myTerms[0])) {
        delete this.terms[term];
      }
      for (let i = 0; i < myTerms.length; i++) {
        if (myTerms[i].startsWith(term)) {
          return;
        }
      }
      this.terms[term] = { term: term, state: state, isSelected: true, matchCount: 0 };
    } else {
      this.terms = {};
      this.terms[term] = { term: term, state: state, isSelected: true, matchCount: 0 };
    }
    this.requestUpdate();
  }

  getCheckedTerms() {
    return Object.values(this.terms).filter(obj => obj.state === 'checked').map(obj => obj.term);
  }

  getTentativeTerms() {
    return Object.values(this.terms).filter(obj => obj.state === 'tentative').map(obj => obj.term);
  }

  getSelectedTerms() {
    return Object.values(this.terms).filter(obj => obj.isSelected).map(obj => obj.term);
  }

  isSelected(term: string) {
    return this.terms[term] ? this.terms[term].isSelected : false;
  }

  toggleSelection(term: string) {
    if (this.terms[term]) {
      this.terms[term].isSelected = !this.terms[term].isSelected;
      this.requestUpdate();
      this._dispatchStateChange(new CustomEvent('state-change', { detail: { term, state: this.terms[term]?.state } }));
    }
  }

  selectTermsForCheck(terms: string[]) {
    // Uncheck all terms first
    Object.values(this.terms).forEach(obj => {
      if (obj.state !== 'tentative') {
        this.setState(obj.term, 'unchecked');
      }
    });
    terms.forEach(term => {
      this.setState(term, 'checked');
    });
    this.requestUpdate();
  }

  setTermsMatchCounts(termDict: Record<string, number>) {
    Object.values(this.terms).forEach(obj => {
      if (termDict[obj.term]) {
        obj.matchCount = termDict[obj.term];
      } else {
        obj.matchCount = 0;
      }
    });
    this.requestUpdate();
  }

  /**
   * Populate terms and optionally mark all as checked.
   */
  setTerms(termList: string[], checked = false) {
    termList.forEach(term => {
      if (term) {
        this.terms[term] = { term: term, state: checked ? 'checked' : 'unchecked', isSelected: false, matchCount: 0 };
      }
    });
    this.requestUpdate();
  }
}

customElements.define('term-row', TermRow);
