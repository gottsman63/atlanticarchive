import { LitElement, html, css } from 'lit';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import { registerIconLibrary } from '@shoelace-style/shoelace';

/**
 * <compound-button>
 *
 * Displays a term label with a prominently sized include/exclude icon button.
 * - label click toggles selection immediately via attribute manipulation and emits `term-click`
 * - icon click cycles state: unchecked → checked → excluded, emitting `state-change`
 * - CSS highlights the button when `selected` attribute is present and shows black border when `isSelected`
 */

registerIconLibrary('custom', {
  resolver: name => {
    if (name === 'green-disc') {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="var(--sl-color-primary-600)"/></svg>';
    }
    if (name === 'green-ring') {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="var(--sl-color-primary-600)" stroke-width="6"/></svg>';
    }
    return '';
  }
});

export class CompoundButton extends LitElement {
    term: string = '';
    isSelected: boolean = false;
    state: string = 'unchecked';
    matchCount: number = 0;

  static properties = {
    term: { type: String },
    isSelected: { type: Boolean, reflect: true },
    state: { type: String },
    matchCount: { type : Number }
  };

  static styles = css`
    /* Container frame: transparent border by default, black when selected */
    :host {
      display: inline-block;
      border: 2px solid transparent;
      border-radius: 4px;
    }

    :host([isSelected]) {
      border-color: black;
    }

    .match-count {
      font-size: 0.8rem;
      color: var(--sl-color-primary-600);
    }

    sl-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Thicker SVG stroke */
    sl-icon-button::part(icon) svg {
      stroke-width: 4px;
    }

    /* Icon colors */
    sl-icon-button[name="check-circle"] ::part(base) {
      color: var(--sl-color-success-600);
    }
    sl-icon-button[name="x-circle"] ::part(base) {
      color: var(--sl-color-danger-600);
    }
    sl-icon-button[name="circle"] ::part(base) {
      color: var(--sl-color-neutral-500);
    }
  `;

  constructor() {
    super();
    this.term = '';
  }

  render() {
    return html`
      <sl-button @click=${this._onLabelClick}>
        <span>${this.term}</span><span> </span><span class="match-count">${this.state === 'checked' ? '' : this.matchCount}</span>
        <sl-icon-button
          name=${this._iconName()}
          library=${(this.getState() === 'checked' || this.getState() === 'tentative') ? 'custom' : 'default'}
          label="Toggle include/exclude"
          size="x-large"
          @click=${this._onIconClick}
          @mouseenter=${this._onIconHover} @mouseleave=${this._onIconHoverLeave}
        ></sl-icon-button>
      </sl-button>
    `;
  }

  _iconName() {
    if (this.getState() === 'checked') {
      return 'green-disc';
    } else if (this.getState() === 'unchecked') {
      return 'circle';
    } else if (this.getState() === 'tentative') {
      return 'green-ring'
    }
  }

  _onIconHover(e: CustomEvent) {
    e.stopPropagation();
    if (this.state === 'checked') {
      return;
    }
    this.setState('tentative');
  }

  _onIconHoverLeave(e: CustomEvent) {
    e.stopPropagation();
    if (this.state === 'tentative') {
      this.setState('unchecked');
    }
  }

  _onIconClick(e: CustomEvent) {
    e.stopPropagation();
    if (this.state === 'tentative') {
      this.setState('checked');
    } else if (this.state === 'checked') {
      this.setState('unchecked');
    } else {
      this.setState('checked');
    }
  }

  /**
   * Toggle `isSelected` on host synchronously,
   * then emit `term-click` with the new selection state.
   */
  _onLabelClick(e: CustomEvent) {
    // Prevent toggling when clicking the icon
    if (e.composedPath().some(el => (el as HTMLInputElement).tagName === 'SL-ICON-BUTTON')) {
      return;
    }
    this.isSelected = !this.isSelected;
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { term: this.term, selected: this.isSelected },
      bubbles: true,
      composed: true
    }));
    this.requestUpdate();
  }

  getState() {
    return this.state || 'unchecked';
  }
  
  setState(state: string) {
    this.state = state;
    this.dispatchEvent(new CustomEvent('state-change', {
      detail: { state: state, term: this.term },
      bubbles: true,
      composed: true
    }));
    this.requestUpdate();
  }
}

customElements.define('compound-button', CompoundButton);
