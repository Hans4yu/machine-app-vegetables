import HomePresenter from "./home-presenter.js";
import {
  generateCameraSection,
  generateInfoPanel,
  generateFooter,
} from "../../templates.js";
import {
  hideElement,
  showElement,
  setElementText,
  addFadeInAnimation,
} from "../../utils/index.js";

export default class HomePage {
  #presenter = null;
  #modelProgress = {
    vision: 0,
    brain: 0,
  };

  async render() {
    return `
      <main class="main-content">
        ${generateCameraSection()}
        ${generateInfoPanel()}
      </main>
      ${generateFooter()}
    `;
  }

  async afterRender() {
    this.#presenter = new HomePresenter(this);
    this.#_bindEvents();
    await this.#presenter.initialize();
  }

  #_bindEvents() {
    const btnToggle = document.getElementById("btn-toggle");
    const fpsSlider = document.getElementById("fps-slider");
    const fpsLabel = document.getElementById("fps-label");
    const toneSelect = document.getElementById("tone-select");
    const cameraSelect = document.getElementById("camera-select");
    const btnCopy = document.getElementById("btn-copy");

    btnToggle?.addEventListener("click", () => {
      this.#presenter.onToggleCamera();
    });

    fpsSlider?.addEventListener("input", (e) => {
      const fps = parseInt(e.target.value, 10);
      if (fpsLabel) {
        fpsLabel.textContent = `${fps} FPS`;
      }
      this.#presenter.onFPSChange(fps);
    });

    toneSelect?.addEventListener("change", (e) => {
      this.#presenter.onToneChange(e.target.value);
    });

    cameraSelect?.addEventListener("change", () => {
      this.#presenter.onCameraChange();
    });

    btnCopy?.addEventListener("click", async () => {
      const factText = document.getElementById("fun-fact-text")?.textContent;
      if (!factText || factText === "Fakta menarik akan muncul di sini...") {
        return;
      }

      const success = await this.#presenter.onCopyFact(factText);
      if (success) {
        btnCopy.classList.add("copied");
        setTimeout(() => btnCopy.classList.remove("copied"), 2000);
      }
    });

    window.addEventListener("beforeunload", () => {
      this.#presenter.destroy();
    });
  }

  setStatus(text, isActive) {
    const statusText = document.getElementById("status-text");
    const statusDot = document.getElementById("status-dot");
    if (statusText) {
      statusText.textContent = text;
    }
    if (statusDot) {
      statusDot.classList.toggle("active", isActive);
    }
  }

  showModelLoadingProgress(model, percent) {
    const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
    this.#modelProgress[model] = safePercent;
    const totalPercent = Math.round(
      (this.#modelProgress.vision + this.#modelProgress.brain) / 2,
    );
    const statusText = document.getElementById("status-text");
    if (statusText) {
      statusText.textContent = "Memuat Model...";
    }

    const progressFill = document.getElementById("model-progress-fill");
    const progressText = document.getElementById("model-progress-text");
    const progressDetail = document.getElementById("model-progress-detail");
    if (progressFill) {
      progressFill.style.width = `${totalPercent}%`;
    }
    if (progressText) {
      progressText.textContent = `${totalPercent}%`;
    }
    if (progressDetail) {
      progressDetail.textContent = `Vision Encoder ${this.#modelProgress.vision}% · Text Decoder ${this.#modelProgress.brain}%`;
    }
  }

  hideModelLoadingProgress() {
    const statusText = document.getElementById("status-text");
    const panel = document.getElementById("model-loading-panel");
    if (statusText) {
      statusText.textContent = "Model Siap";
    }
    hideElement(panel);
  }

  enableToggleButton() {
    const btn = document.getElementById("btn-toggle");
    if (btn) {
      btn.disabled = false;
    }
  }

  setScanningState(isScanning) {
    const btnToggle = document.getElementById("btn-toggle");
    const overlay = document.getElementById("camera-overlay");
    const placeholder = document.getElementById("camera-placeholder");

    if (btnToggle) {
      btnToggle.classList.toggle("scanning", isScanning);
      btnToggle.classList.remove("captured");
      this.#_setToggleButtonIcon(
        btnToggle,
        isScanning ? "square" : "scan-line",
        isScanning ? "Hentikan pemindaian" : "Mulai pemindaian",
      );
    }
    if (overlay) {
      overlay.classList.toggle("active", isScanning);
    }
    if (placeholder) {
      if (isScanning) {
        hideElement(placeholder);
      } else {
        showElement(placeholder);
      }
    }
  }

  setCapturedState(hasSnapshot = true) {
    const btnToggle = document.getElementById("btn-toggle");
    const overlay = document.getElementById("camera-overlay");
    const placeholder = document.getElementById("camera-placeholder");

    if (btnToggle) {
      btnToggle.classList.remove("scanning");
      btnToggle.classList.add("captured");
      this.#_setToggleButtonIcon(btnToggle, "refresh-cw", "Pindai ulang");
    }
    if (overlay) {
      overlay.classList.remove("active");
    }
    if (placeholder) {
      if (hasSnapshot) {
        hideElement(placeholder);
      } else {
        showElement(placeholder);
      }
    }
  }

  showIdleState() {
    showElement(document.getElementById("state-idle"));
    hideElement(document.getElementById("state-loading"));
    hideElement(document.getElementById("state-result"));
  }

  showLoadingState() {
    hideElement(document.getElementById("state-idle"));
    showElement(document.getElementById("state-loading"));
    hideElement(document.getElementById("state-result"));
  }

  showResultState(label) {
    const resultEl = document.getElementById("state-result");
    const detectedName = document.getElementById("detected-name");

    hideElement(document.getElementById("state-idle"));
    hideElement(document.getElementById("state-loading"));

    if (resultEl?.classList.contains("hidden")) {
      showElement(resultEl);
      addFadeInAnimation(resultEl);
    }

    if (detectedName) {
      setElementText(detectedName, label);
    }
  }

  updateConfidence(confidence) {
    const fill = document.getElementById("confidence-fill");
    const value = document.getElementById("detected-confidence");
    if (fill) {
      fill.style.width = `${confidence}%`;
    }
    if (value) {
      value.textContent = `${confidence}%`;
    }
  }

  showFactLoading(isLoading) {
    const loadingEl = document.getElementById("fun-fact-loading");
    const contentEl = document.getElementById("fun-fact-content");
    if (isLoading) {
      showElement(loadingEl);
      hideElement(contentEl);
    } else {
      hideElement(loadingEl);
      showElement(contentEl);
    }
  }

  displayFact(text) {
    const factText = document.getElementById("fun-fact-text");
    if (factText) {
      factText.textContent = text;
      addFadeInAnimation(factText);
    }
  }

  showError(message) {
    const loadingState = document.getElementById("state-loading");
    if (loadingState) {
      const p = loadingState.querySelector("p");
      if (p) {
        p.textContent = message;
      }
    }
    showElement(loadingState);
    hideElement(document.getElementById("state-idle"));
    hideElement(document.getElementById("state-result"));
  }

  getCameraSelect() {
    return document.getElementById("camera-select");
  }

  getCurrentTone() {
    return document.getElementById("tone-select")?.value || "normal";
  }

  #_setToggleButtonIcon(button, icon, label) {
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.innerHTML = `<i data-lucide="${icon}" width="24" height="24"></i>`;

    if (typeof window.lucide !== "undefined") {
      window.lucide.createIcons();
    }
  }
}
