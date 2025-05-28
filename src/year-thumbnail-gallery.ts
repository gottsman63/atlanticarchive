import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface ThumbnailEventDetail {
  index: number;
  src: string;
  thumbnailBounds?: DOMRect | null; // Optional bounds for hover events
  year: number;
}

@customElement('year-thumbnail-gallery')
export class YearThumbnailGallery extends LitElement {
  // backing fields
  private _year = '';
  private _images: string[] = [];

  /** Year label to display on the left */
  @property({ type: String })
  get year(): string { return this._year; }
  set year(value: string) {
    const old = this._year;
    this._year = value;
    this.requestUpdate('year', old);
  }

  /** Array of image URLs (max 12 shown) */
  @property({ type: Array })
  get images(): string[] { return this._images; }
  set images(value: string[]) {
    const old = this._images;
    this._images = value;
    this.requestUpdate('images', old);
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      /* you can override this in page CSS */
      height: 100px;
      box-sizing: border-box;
    }
    .container {
      display: flex;
      align-items: center;
      height: 100%;
      overflow-x: auto;
    }
    .year {
      flex: 0 0 auto;
      margin-right: 1rem;
      font-size: 1.2em;
      font-weight: bold;
      white-space: nowrap;
    }
    .thumbs {
      display: flex;
      flex: 1 1 auto;
      gap: 0.5rem;
      align-items: center;
      overflow-x: auto;
      /* ensure thumbs container fills host height */
      height: 100%;
    }
    .thumb {
      flex: 0 0 auto;
      /* never taller than the container, but shrink if needed */
      max-height: 100%;
      height: auto;
      width: auto;
      object-fit: contain;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 4px 4px rgba(0, 0, 0, 0.5);
    }
  `;

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('images')) {
      // enforce at most 12 images
      this._images = this._images.slice(0, 12);
    }
  }

  render() {
    return html`
      <div class="container">
        <div class="year">${this.year}</div>
        <div class="thumbs">
          ${this.images.map((src, i) => html`
            <img
              src=${src}
              title="${this.extractMonthFromCoverUrl(src)}"
              class="thumb"
              style="display: block"
              @error=${(e: Event) => {
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = 'none';
              }}
              @load=${(e: Event) => {
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = 'block';
              }}
              @mousemove=${() => {
                this._onHover(i); 
              }}
              @click=${() => this._onClick(i)}
            />
          `)}
        </div>
      </div>
    `;
  }

  private _onHover(index: number) {
    this.dispatchEvent(new CustomEvent<ThumbnailEventDetail>('thumbnail-hover', {
      detail: { index, 
        src: this.images[index], 
        year: parseInt(this.year, 10),
        thumbnailBounds: (this.renderRoot.querySelectorAll('.thumb')[index] as HTMLElement)?.getBoundingClientRect() },
      bubbles: true,
      composed: true
    }));
  }

  private _onClick(index: number) {
    console.log('Thumbnail clicked:', index, this.images[index]);
    this.dispatchEvent(new CustomEvent<ThumbnailEventDetail>('thumbnail-click', {
      detail: { index, 
        src: this.images[index],
        year: parseInt(this.year, 10) },
      bubbles: true,
      composed: true
    }));
  }

  extractMonthFromCoverUrl(url: string) {
    const match = url.match(/(\d{4})_(\d{1,2})\.jpg/);
    if (match) {
        const month = parseInt(match[2], 10);
        const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return monthAbbr[month - 1] || "Dec";
    }
    return "Dec";
  }
}
