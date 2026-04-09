type Landmark = { x: number; y: number; z: number };

interface GestureFrame {
  steering: number;
  throttle: number;
  brake: number;
  handDetected: boolean;
  motionStopped: boolean;
}

declare global {
  interface Window {
    Hands?: any;
    Camera?: any;
    drawConnectors?: (ctx: CanvasRenderingContext2D, landmarks: Landmark[], connections: any, style?: any) => void;
    drawLandmarks?: (ctx: CanvasRenderingContext2D, landmarks: Landmark[], style?: any) => void;
    HAND_CONNECTIONS?: any;
  }
}

const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
];

export class GestureController {
  private videoEl: HTMLVideoElement;
  private overlayCanvas: HTMLCanvasElement;
  private onFrame: (frame: GestureFrame) => void;
  private onStatus: (message: string) => void;
  private onMetrics: (fps: number) => void;

  private hands: any = null;
  private camera: any = null;
  private stream: MediaStream | null = null;
  private smoothedX = 0.5;
  private smoothedZ = 0;
  private baselineZ: number | null = null;
  private resumeBoostFrames = 0;
  private motionStopped = false;
  private isProcessingFrame = false;
  private initialized = false;
  private frameCounter = 0;
  private lastFpsTime = performance.now();

  constructor(
    videoEl: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement,
    onFrame: (frame: GestureFrame) => void,
    onStatus: (message: string) => void,
    onMetrics: (fps: number) => void,
  ) {
    this.videoEl = videoEl;
    this.overlayCanvas = overlayCanvas;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.onMetrics = onMetrics;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    this.onStatus("Initializing hand tracking...");
    await this.loadMediaPipeScripts();
    await this.startCamera();

    this.hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });

    this.hands.onResults((results: any) => this.handleResults(results));

    const Camera = window.Camera;
    this.camera = new Camera(this.videoEl, {
      width: 320,
      height: 240,
      onFrame: async () => {
        if (!this.hands || this.videoEl.readyState < 2 || this.isProcessingFrame) {
          return;
        }

        this.isProcessingFrame = true;
        try {
          await this.hands.send({ image: this.videoEl });
        } finally {
          this.isProcessingFrame = false;
        }
      },
    });

    await this.camera.start();
    this.initialized = true;
    this.onStatus("Show one hand to control the car");
  }

  public dispose(): void {
    this.camera?.stop?.();
    this.hands?.close?.();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.initialized = false;
  }

  private async startCamera(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    this.videoEl.srcObject = this.stream;
    await this.videoEl.play();
  }

  private async loadMediaPipeScripts(): Promise<void> {
    for (const src of MEDIAPIPE_SCRIPTS) {
      if ([...document.scripts].some((script) => script.src === src)) {
        continue;
      }
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    }
  }

  private handleResults(results: any): void {
    const ctx = this.overlayCanvas.getContext("2d");
    if (!ctx) return;

    const targetWidth = this.videoEl.videoWidth || 320;
    const targetHeight = this.videoEl.videoHeight || 240;
    if (this.overlayCanvas.width !== targetWidth || this.overlayCanvas.height !== targetHeight) {
      this.overlayCanvas.width = targetWidth;
      this.overlayCanvas.height = targetHeight;
    }
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    this.frameCounter += 1;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.onMetrics(Math.round((this.frameCounter * 1000) / (now - this.lastFpsTime)));
      this.lastFpsTime = now;
      this.frameCounter = 0;
    }

    const handLandmarks: Landmark[] | undefined = results.multiHandLandmarks?.[0];
    if (!handLandmarks) {
      this.onFrame({ steering: 0, throttle: 0, brake: 0, handDetected: false, motionStopped: this.motionStopped });
      return;
    }

    if (window.drawConnectors && window.drawLandmarks && window.HAND_CONNECTIONS) {
      window.drawConnectors(ctx, handLandmarks, window.HAND_CONNECTIONS, { color: "#00e5ff", lineWidth: 2 });
      window.drawLandmarks(ctx, handLandmarks, { color: "#ffb300", lineWidth: 1, radius: 2 });
    }

    const wrist = handLandmarks[0];
    this.smoothedX += (wrist.x - this.smoothedX) * 0.34;
    this.smoothedZ += (wrist.z - this.smoothedZ) * 0.3;

    if (this.baselineZ === null) {
      this.baselineZ = this.smoothedZ;
    } else {
      this.baselineZ += (this.smoothedZ - this.baselineZ) * 0.01;
    }

    const openPalm = this.isOpenPalm(handLandmarks);
    const fist = this.isFist(handLandmarks);

    if (fist) {
      this.motionStopped = true;
      this.resumeBoostFrames = 0;
      this.onStatus("Closed fist detected: STOPPED");
    } else if (openPalm && this.motionStopped) {
      this.motionStopped = false;
      this.resumeBoostFrames = 12;
      this.onStatus("Open palm detected: MOVING");
    }

    // Gesture mapping:
    // 1) horizontal wrist x (normalized [0..1]) -> steering left/right
    const centeredX = (this.smoothedX - 0.5) * 2;
    let steering = Math.max(-1, Math.min(1, centeredX * 1.6));
    if (Math.abs(steering) < 0.12) steering = 0;

    // 2) wrist z depth (toward camera is lower z) -> throttle/brake
    const depthDelta = (this.baselineZ ?? this.smoothedZ) - this.smoothedZ;
    const depthThrottle = this.motionStopped ? 0 : Math.max(0, Math.min(1, (depthDelta - 0.02) / 0.12));
    const throttle = this.resumeBoostFrames > 0 ? Math.max(0.35, depthThrottle) : depthThrottle;
    const brake = this.motionStopped ? 1 : Math.max(0, Math.min(1, (-depthDelta - 0.02) / 0.12));
    if (this.resumeBoostFrames > 0) {
      this.resumeBoostFrames -= 1;
    }

    this.onFrame({
      steering,
      throttle,
      brake,
      handDetected: true,
      motionStopped: this.motionStopped,
    });
  }

  private isOpenPalm(landmarks: Landmark[]): boolean {
    const fingerTips = [8, 12, 16, 20];
    const fingerPips = [6, 10, 14, 18];
    return fingerTips.every((tip, i) => landmarks[tip].y < landmarks[fingerPips[i]].y);
  }

  private isFist(landmarks: Landmark[]): boolean {
    const fingerTips = [8, 12, 16, 20];
    const fingerPips = [6, 10, 14, 18];
    const foldedCount = fingerTips.filter((tip, i) => landmarks[tip].y > landmarks[fingerPips[i]].y).length;
    return foldedCount >= 3;
  }
}

