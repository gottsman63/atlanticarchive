import { LitElement, html, css } from 'lit-element';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

export class ResultLineItem extends LitElement {
  // Callbacks
  private _authorCallback: (author: string) => void;
  private _articleCallback: (url: string) => void;
  private _coverSelectCallback: (url: string) => void;
  private _coverHoverCallback: (url: string, thumbnailBounds: DOMRect | null) => void;

  // Internal fields
  private _title: string = '';
  private _snippet: string = '';
  private _date: string = '';
  private _authors: {author_name: string, article_count: number}[] = [];
  private _blurb: string = '';
  private _imageUrl: string = '';
  private _articleUrl: string = '';

  constructor(
    authorCallback: (author: string) => void,
    articleCallback: (url: string) => void,
    coverSelectCallback: (url: string) => void,
    coverHoverCallback: (url: string, thumbnailBounds: DOMRect | null) => void,
    height: number = 60
  ) {
    super();
    this._authorCallback = authorCallback;
    this._articleCallback = articleCallback;
    this._coverSelectCallback = coverSelectCallback;
    this._coverHoverCallback = coverHoverCallback;
    this.style.height = `${height}px`;
    this.title = 'Loading...'
  }

static styles = css`
    :host {
        display: block;
    }
    .container {
        display: flex;
        align-items: flex-start;
        margin-left: 10px;
    }
    .thumbnail {
        height: 70px;
        width: auto;
        max-width: 120px;
        object-fit: contain;
        margin-right: 12px;
        margin-top: 0px;
        cursor: pointer;
        background: #f0f0f0;
        display: block;
    }
    .text {
        display: flex;
        flex-direction: column;
    }
    .snippet {
        display: inline-block;
        white-space: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        vertical-align: bottom;
        max-width: 100%;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none;  /* IE 10+ */
        text-overflow: initial;
    }
    .snippet::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
        background: transparent;
    }
    .snippet .emphasis {
        font-weight: bold;
        background-color: var(--sl-color-primary-600, #3b82f6);
        color: white;
    }
    .line {
        margin: 2px 0;
        height: 1.1em;
        display: flex;
        align-items: center;
        min-width: 0;
        overflow: visible;
    }
    .title {
        color: var(--sl-color-primary-600, #3b82f6);
        font-size: 1.2em;
        font-weight: bold;
        cursor: pointer;
        flex-shrink: 0;
    }
    .title:hover {
        text-decoration: underline;
    }
    .date {
        color: var(--sl-color-danger-600, #ff0000);
        font-weight: bold;
    }
    .author-list {
        display: inline-block;
        white-space: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        vertical-align: bottom;
        max-width: 100%;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none;  /* IE 10+ */
    }
    .author-list::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
        background: transparent;
    }
    .author {
        text-decoration: none;
        font-weight: bold;
        cursor: pointer;
        white-space: nowrap;
    }
    .author:hover {
        text-decoration: underline;
    }
    .blurb {
        font-style: italic;
        font-size: 1.1em;
        color: var(--sl-color-neutral-600, #6b7280);
        line-height: 1.2;
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        display: block;
        text-overflow: initial;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none;  /* IE 10+ */
    }
    .blurb::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
        background: transparent;
    }
`;

  render() {
    return html`
      <div class="container">
      <img
        id="thumbnail"
        class="thumbnail"
        src="${this._imageUrl}"
        alt="Thumbnail"
        @click=${() => this._coverSelectCallback(this._imageUrl)}
        @mouseenter=${() => {
          const element = this.renderRoot.querySelector<HTMLImageElement>('#thumbnail');
          const bounds = element?.getBoundingClientRect() || null;
          this._coverHoverCallback(this._imageUrl, bounds);
        }}
        @mouseleave=${() => {
            // this._coverHoverCallback('', this.getElementsByClassName('thumbnail')[0]?.getBoundingClientRect() || null);
            }
        }
      />
      <div class="text">
        <div class="line">
        <span class="title" @click=${() => this._articleCallback(this._articleUrl)}>${this._title}</span>
        <span style="display:inline-block; width:1em;"></span>
        <span class="snippet"> ${unsafeHTML(this._snippet)}</span>
        </div>
        <div class="line">
        <span class="date">${this._date}</span>
        <span style="display:inline-block; width:1em;"></span>
        ${this._authors.map(
          (author, idx) => html`
          <span
            class="author"
            @click=${() => this._authorCallback(author.author_name)}
            >${author.author_name} (${author.article_count})</span
          >${idx < this._authors.length - 1 ? ', ' : ''}
          `
        )}
        </div>
        <div class="line blurb">${this._blurb}</div>
      </div>
      </div>
    `;
  }

  // Property getters/setters
  get title(): string {
    return this._title;
  }
  set title(value: string) {
    const old = this._title;
    this._title = value;
    this.requestUpdate('title', old);
  }

  get snippet(): string {
    return this._snippet;
  }
  set snippet(value: string) {
    const old = this._snippet;
    if (value) {
        // Replace <em> tags with <span class="emphasis"> for styling
        let s = value.replace(/<em>/g, '<span class="emphasis">').replace(/<\/em>/g, '</span>');
        this._snippet = s;
    } else {
        this._snippet = '';
    }
    this.requestUpdate('snippet', old);
  }

  get date(): string {
    return this._date;
  }
  set date(value: number) {
    const old = this._date;
    const dateObj = new Date(value * 1000);
    const stringDate = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    this._date = stringDate;
    this.requestUpdate('date', old);
  }

  get authors(): {author_name: string, article_count: number}[] {
    return this._authors;
  }
  set authors(value: {author_name: string, article_count: number}[]) {
    const old = this._authors;
    this._authors = value;
    this.requestUpdate('authors', old);
  }

  get blurb(): string {
    return this._blurb;
  }
  set blurb(value: string) {
    const old = this._blurb;
    this._blurb = value;
    this.requestUpdate('blurb', old);
  }

  get articleUrl(): string {
    return this._articleUrl;
  }
  set articleUrl(value: string) {
    const old = this._articleUrl;
    this._articleUrl = value;
    this.requestUpdate('articleUrl', old);
  }

  set imageUrl(url: string) {
    const old = this._imageUrl;
    this._imageUrl = url;
    this.requestUpdate('imageUrl', old);
  }
}

customElements.define('result-line-item', ResultLineItem);