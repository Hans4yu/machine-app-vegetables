import CameraService from "../../services/camera.service.js";
import DetectionService from "../../services/detection.service.js";
import RootFactsService from "../../services/rootfacts.service.js";
import { isValidDetection, logError } from "../../utils/index.js";

class HomePresenter {
  #view = null;
  #cameraService = null;
  #detectionService = null;
  #rootFactsService = null;
  #isScanning = false;
  #animationFrameId = null;
  #lastDetectedLabel = null;

  constructor(view) {
    this.#view = view;
    this.#cameraService = new CameraService();
    this.#detectionService = new DetectionService();
    this.#rootFactsService = new RootFactsService();
  }

  async initialize() {
    this.#view.setStatus("Memuat Model AI...", false);
    this.#view.showModelLoadingProgress("vision", 0);
    this.#view.showModelLoadingProgress("brain", 0);

    try {
      await Promise.all([
        this.#detectionService.loadModel((pct) => {
          this.#view.showModelLoadingProgress("vision", pct);
        }),
        this.#rootFactsService.loadModel((pct) => {
          this.#view.showModelLoadingProgress("brain", pct);
        }),
      ]);

      this.#view.hideModelLoadingProgress();
      this.#view.setStatus("Model Siap", true);
      this.#view.enableToggleButton();

      await this.#cameraService.loadCameras(this.#view.getCameraSelect());
    } catch (error) {
      logError("HomePresenter.initialize", error);
      this.#view.setStatus("Gagal Memuat Model", false);
      this.#view.showError("Gagal memuat model AI. Silakan refresh halaman.");
    }
  }

  async onToggleCamera() {
    if (this.#isScanning) {
      this.#stopScanning();
    } else {
      await this.#startScanning();
    }
  }

  async #startScanning() {
    try {
      this.#view.setStatus("Memulai Kamera...", false);
      await this.#cameraService.startCamera(
        "media-video",
        "media-canvas",
        this.#view.getCameraSelect(),
      );

      this.#isScanning = true;
      this.#view.setScanningState(true);
      this.#view.showLoadingState();
      this.#view.setStatus("Memindai...", true);

      this.#runDetectionLoop();
    } catch (error) {
      logError("HomePresenter.#startScanning", error);
      this.#view.setStatus("Gagal Membuka Kamera", false);
      this.#view.showError(error.message);
    }
  }

  #stopScanning() {
    this.#isScanning = false;

    if (this.#animationFrameId) {
      cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }

    this.#cameraService.stopCamera();
    this.#lastDetectedLabel = null;
    this.#view.setScanningState(false);
    this.#view.showIdleState();
    this.#view.setStatus("Model Siap", true);
  }

  #runDetectionLoop() {
    const loop = async () => {
      if (!this.#isScanning) {
        return;
      }

      if (this.#cameraService.shouldProcessFrame()) {
        const frame = this.#cameraService.captureFrame();
        if (frame) {
          try {
            const result = await this.#detectionService.predict(frame);

            if (isValidDetection(result)) {
              this.#view.updateConfidence(result.confidence);
              this.#view.showResultState(result.label);

              if (result.label !== this.#lastDetectedLabel) {
                this.#lastDetectedLabel = result.label;
                this.#triggerFactGeneration(result.label);
              }
            }
          } catch (error) {
            logError("HomePresenter.#runDetectionLoop", error);
          }
        }
      }

      this.#animationFrameId = requestAnimationFrame(loop);
    };

    this.#animationFrameId = requestAnimationFrame(loop);
  }

  async #triggerFactGeneration(label) {
    const tone = this.#view.getCurrentTone();
    this.#view.showFactLoading(true);

    try {
      console.log("Generating fact for:", label, "tone:", tone);
      const fact = await this.#rootFactsService.generateFacts(label, tone);
      console.log("Generated fact:", fact);
      if (fact) {
        this.#view.displayFact(fact);
      } else {
        console.warn("Fact generation returned null - service not ready?");
        this.#view.displayFact("Model AI belum siap. Tunggu sebentar...");
      }
    } catch (error) {
      logError("HomePresenter.#triggerFactGeneration", error);
      this.#view.displayFact("Gagal memuat fakta. Coba lagi.");
    } finally {
      this.#view.showFactLoading(false);
    }
  }

  onFPSChange(fps) {
    this.#cameraService.setFPS(fps);
  }

  onToneChange(tone) {
    this.#rootFactsService.setTone(tone);
    this.#lastDetectedLabel = null;
  }

  onCameraChange() {
    if (this.#isScanning) {
      this.#stopScanning();
    }
  }

  async onCopyFact(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      console.warn("Copy to clipboard failed:", err);
      return false;
    }
  }

  destroy() {
    this.#stopScanning();
  }
}

export default HomePresenter;
