/**
 * Radio Orlicko Lovelace Card
 *
 * Displays the currently playing track on Radio Orlicko with album art,
 * animated progress bar, show/host info, and Last.fm statistics.
 *
 * Usage:
 *   type: custom:radio-orlicko-card
 *   entity: media_player.radio_orlicko
 */

class RadioOrlickoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._progressTimer = null;
    this._positionBase = null;
    this._positionBaseTime = null;
    this._duration = null;
    this._lastTitle = undefined;
    this._lastShow = undefined;
    this._unavailableRendered = false;
    this._entityUnavailableRendered = false;
  }

  // ------------------------------------------------------------------ //
  // Lovelace card API
  // ------------------------------------------------------------------ //

  setConfig(config) {
    if (!config.entity) {
      throw new Error("Please define an entity (e.g. media_player.radio_orlicko)");
    }
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const entityId = this._config.entity;
    const state = hass.states[entityId];

    if (!state) {
      if (!this._unavailableRendered) {
        this._unavailableRendered = true;
        this._lastTitle = undefined;
        this._lastShow = undefined;
        this._renderUnavailable(entityId);
      }
      return;
    }

    // Entity found — clear unavailable flag so it re-renders cleanly if it was gone
    this._unavailableRendered = false;

    if (state.state === "unavailable") {
      if (!this._entityUnavailableRendered) {
        this._entityUnavailableRendered = true;
        this._lastTitle = undefined;
        this._lastShow = undefined;
        this._renderEntityUnavailable();
      }
      return;
    }

    this._entityUnavailableRendered = false;

    const attrs = state.attributes;
    const title = attrs.media_title;
    const currentShow = attrs.current_show;

    // Re-render when track or show changes
    if (title !== this._lastTitle || currentShow !== this._lastShow) {
      this._lastTitle = title;
      this._lastShow = currentShow;
      this._render(state);
    }

    this._syncPosition(attrs);
  }

  getCardSize() {
    return 1;
  }

  static getConfigElement() {
    return document.createElement("radio-orlicko-card-editor");
  }

  static getStubConfig(hass) {
    const entity =
      Object.keys(hass?.states ?? {}).find(
        (id) => id.startsWith("media_player.") && id.includes("radio_orlicko")
      ) ?? "media_player.radio_orlicko";
    return { entity };
  }

  disconnectedCallback() {
    this._stopProgressTimer();
  }

  // ------------------------------------------------------------------ //
  // Rendering
  // ------------------------------------------------------------------ //

  _render(state) {
    const attrs = state.attributes;
    const title = attrs.media_title || "Neznámá skladba";
    const artist = attrs.media_artist || "";
    const album = attrs.media_album_name || "";
    const albumArt = attrs.entity_picture || "";
    const currentShow = attrs.current_show || "";
    const currentHost = attrs.current_host || "";

    const metaLine = [artist, album].filter(Boolean).join(" · ");

    const showLine = [currentShow, currentHost ? `(${currentHost})` : ""]
      .filter(Boolean)
      .join(" ");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --card-bg: var(--ha-card-background, var(--card-background-color, #1a1a2e));
          --accent: var(--primary-color, #e63946);
          --text-primary: var(--primary-text-color, #e8e8f0);
          --text-secondary: var(--secondary-text-color, #9a9ab0);
          --art-bg: rgba(255,255,255,0.06);
          --progress-bg: rgba(255,255,255,0.12);
          --progress-fill: var(--accent);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        @media (prefers-color-scheme: light) {
          :host {
            --card-bg: var(--ha-card-background, var(--card-background-color, #ffffff));
            --text-primary: var(--primary-text-color, #121217);
            --text-secondary: var(--secondary-text-color, #54556b);
            --art-bg: rgba(0,0,0,0.06);
            --progress-bg: rgba(0,0,0,0.12);
          }
        }

        .card {
          background: var(--card-bg);
          border-radius: var(--ha-card-border-radius, 12px);
          overflow: hidden;
          box-shadow: var(--ha-card-box-shadow, 0 2px 12px rgba(0,0,0,0.25));
          color: var(--text-primary);
        }

        a.card-link {
          display: block;
          text-decoration: none;
          color: inherit;
        }

        .main-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 12px 6px;
        }

        .art-thumb {
          flex: 0 0 40px;
          width: 40px;
          height: 40px;
          border-radius: 6px;
          overflow: hidden;
          background: var(--art-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .art-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .info {
          flex: 1;
          min-width: 0;
        }

        .title {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meta-line {
          font-size: 11px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .show-line {
          font-size: 10px;
          color: var(--accent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
          opacity: 0.85;
        }

        .right-col {
          flex: 0 0 auto;
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .time-col {
          font-size: 11px;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .progress-bar {
          height: 3px;
          background: var(--progress-bg);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--progress-fill);
          transition: width 1s linear;
          width: 0%;
        }
      </style>

      <ha-card class="card">
        <a class="card-link" href="https://www.radioorlicko.cz/" target="_blank" rel="noopener noreferrer">
          <div class="main-row">
            <div class="art-thumb">
              ${albumArt
                ? `<img src="${this._escapeHtml(albumArt)}" alt="Album art" onerror="this.style.display='none'">`
                : `📻`
              }
            </div>
            <div class="info">
              <div class="title" title="${this._escapeHtml(title)}">${this._escapeHtml(title)}</div>
              ${metaLine ? `<div class="meta-line">${this._escapeHtml(metaLine)}</div>` : ""}
              ${showLine ? `<div class="show-line">${this._escapeHtml(showLine)}</div>` : ""}
            </div>
            <div class="right-col">
              <div class="time-col">
                <span id="orlicko-elapsed">0:00</span>
              </div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" id="orlicko-progress"></div>
          </div>
        </a>
      </ha-card>
    `;

    this._syncPosition(state.attributes);
    this._startProgressTimer();
  }

  _renderUnavailable(entityId) {
    this._stopProgressTimer();
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding:16px;text-align:center;color:var(--secondary-text-color,#9a9ab0);font-size:13px;line-height:1.5;">
          <div>📻 Entity not found</div>
          <div style="font-size:11px;margin-top:4px;opacity:0.7;">${this._escapeHtml(entityId)}</div>
        </div>
      </ha-card>
    `;
  }

  _renderEntityUnavailable() {
    this._stopProgressTimer();
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding:16px;text-align:center;color:var(--secondary-text-color,#9a9ab0);font-size:13px;">
          📻 Radio Orlicko unavailable
        </div>
      </ha-card>
    `;
  }

  // ------------------------------------------------------------------ //
  // Progress bar animation
  // ------------------------------------------------------------------ //

  _syncPosition(attrs) {
    const position = attrs.media_position;
    const updatedAt = attrs.media_position_updated_at;
    const duration = attrs.media_duration;

    if (position == null) return;

    this._positionBase = parseFloat(position);
    this._positionBaseTime = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    this._duration = duration != null ? parseFloat(duration) : null;

    this._updateProgressDOM();
  }

  _startProgressTimer() {
    this._stopProgressTimer();
    this._progressTimer = setInterval(() => this._updateProgressDOM(), 1000);
  }

  _stopProgressTimer() {
    if (this._progressTimer !== null) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  _updateProgressDOM() {
    if (this._positionBase == null) return;

    const elapsed = this._positionBase + (Date.now() - this._positionBaseTime) / 1000;
    const clamped = this._duration != null
      ? Math.min(Math.max(elapsed, 0), this._duration)
      : Math.max(elapsed, 0);

    const fill = this.shadowRoot.getElementById("orlicko-progress");
    const elapsedEl = this.shadowRoot.getElementById("orlicko-elapsed");
    if (elapsedEl) elapsedEl.textContent = this._formatTime(clamped);

    if (fill) {
      if (this._duration != null && this._duration > 0) {
        fill.style.width = `${((clamped / this._duration) * 100).toFixed(1)}%`;
      } else {
        // No duration — animate as indeterminate pulse via opacity
        fill.style.width = "100%";
        fill.style.opacity = `${0.3 + 0.4 * Math.abs(Math.sin(Date.now() / 1500))}`;
      }
    }
  }

  // ------------------------------------------------------------------ //
  // Utilities
  // ------------------------------------------------------------------ //

  _formatTime(seconds) {
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, "0")}`;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

// ------------------------------------------------------------------ //
// Card editor — makes the card configurable from the Lovelace UI
// ------------------------------------------------------------------ //

class RadioOrlickoCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._initialized = false;
  }

  setConfig(config) {
    this._config = config;
    if (this._form) {
      this._form.value = config;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._init();
    } else if (this._form) {
      this._form.hass = hass;
    }
  }

  _init() {
    this._initialized = true;

    this.shadowRoot.innerHTML = `<ha-form></ha-form>`;

    this._form = this.shadowRoot.querySelector("ha-form");
    this._form.hass = this._hass;
    this._form.schema = [
      {
        name: "entity",
        required: true,
        selector: { entity: { domain: "media_player" } },
      },
    ];
    this._form.value = this._config || {};
    this._form.computeLabel = (schema) =>
      schema.name === "entity" ? "Entity" : schema.name;

    this._form.addEventListener("value-changed", (e) => {
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: e.detail.value },
          bubbles: true,
          composed: true,
        })
      );
    });
  }
}

customElements.define("radio-orlicko-card-editor", RadioOrlickoCardEditor);

customElements.define("radio-orlicko-card", RadioOrlickoCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "custom:radio-orlicko-card",
  name: "Radio Orlicko Card",
  description: "Displays the currently playing track on Radio Orlicko with album art, animated progress, show info, and Last.fm statistics.",
  preview: true,
  documentationURL: "https://github.com/pdostal/radio-orlicko-ha-card",
});
