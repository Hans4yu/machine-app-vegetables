import { CAMERA_CONFIG } from "../config.js";
import { logError, getCameraErrorMessage } from "../utils/index.js";

class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = CAMERA_CONFIG;
    this.currentFPS = CAMERA_CONFIG.defaultFPS;
    this.frameInterval = 1000 / CAMERA_CONFIG.defaultFPS;
    this.lastFrameTime = 0;
  }

  initializeElements(videoId, canvasId) {
    this.video = document.getElementById(videoId);
    this.canvas = document.getElementById(canvasId);
  }

  async loadCameras(cameraSelect) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      if (cameraSelect) {
        cameraSelect.innerHTML = "";
        videoDevices.forEach((device, index) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `Kamera ${index + 1}`;
          cameraSelect.appendChild(option);
        });
      }

      return videoDevices;
    } catch (error) {
      logError("CameraService.loadCameras", error);
      return [];
    }
  }

  _buildConstraints(selectedValue) {
    const base = {
      audio: false,
      video: {
        ...this.config.videoConstraints,
      },
    };

    if (!selectedValue || selectedValue === "default") {
      base.video.facingMode = { ideal: "environment" };
    } else if (selectedValue === "front") {
      base.video.facingMode = "user";
    } else {
      base.video.deviceId = { exact: selectedValue };
    }

    return base;
  }

  async startCamera(videoId, canvasId, cameraSelect) {
    this.initializeElements(videoId, canvasId);
    this.#showLivePreview();

    const selectedValue = cameraSelect ? cameraSelect.value : "default";
    const constraints = this._buildConstraints(selectedValue);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = resolve;
        this.video.onerror = reject;
      });

      await this.video.play();

      if (this.canvas) {
        this.canvas.width = this.video.videoWidth || 640;
        this.canvas.height = this.video.videoHeight || 480;
      }

      return true;
    } catch (error) {
      logError("CameraService.startCamera", error);
      throw new Error(getCameraErrorMessage(error));
    }
  }

  stopCamera({ keepSnapshot = false } = {}) {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    if (!keepSnapshot) {
      this.#showLivePreview();
    }
  }

  setFPS(fps) {
    const validFPS = Math.min(
      Math.max(fps, this.config.minFPS),
      this.config.maxFPS,
    );
    this.currentFPS = validFPS;
    this.frameInterval = 1000 / validFPS;
  }

  shouldProcessFrame() {
    const now = performance.now();
    if (now - this.lastFrameTime >= this.frameInterval) {
      this.lastFrameTime = now;
      return true;
    }
    return false;
  }

  captureFrame() {
    if (!this.canvas || !this.video || !this.isActive()) {
      return null;
    }

    const ctx = this.canvas.getContext("2d");
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas;
  }

  freezeCurrentFrame() {
    if (!this.canvas || !this.video) {
      return false;
    }

    try {
      if (this.isActive()) {
        const ctx = this.canvas.getContext("2d");
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      }

      this.canvas.classList.remove("hidden");
      this.video.classList.add("hidden");
      return true;
    } catch (error) {
      logError("CameraService.freezeCurrentFrame", error);
      return false;
    }
  }

  isActive() {
    return !!(
      this.stream &&
      this.stream.active &&
      this.video &&
      !this.video.paused &&
      !this.video.ended
    );
  }

  #showLivePreview() {
    if (this.canvas) {
      this.canvas.classList.add("hidden");
    }

    if (this.video) {
      this.video.classList.remove("hidden");
    }
  }
}

export default CameraService;
