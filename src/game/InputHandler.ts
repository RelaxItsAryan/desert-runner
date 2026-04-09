import { InputState } from "./types";

export class InputHandler {
  private keyboardState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  private gestureState = {
    steering: 0,
    throttle: 0,
    brake: 0,
    handDetected: false,
    motionStopped: false,
  };

  constructor(useKeyboard = false) {
    if (useKeyboard) {
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    switch (e.key.toLowerCase()) {
      case "w":
      case "arrowup":
        this.keyboardState.forward = true;
        break;
      case "s":
      case "arrowdown":
        this.keyboardState.backward = true;
        break;
      case "a":
      case "arrowleft":
        this.keyboardState.left = true;
        break;
      case "d":
      case "arrowright":
        this.keyboardState.right = true;
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    switch (e.key.toLowerCase()) {
      case "w":
      case "arrowup":
        this.keyboardState.forward = false;
        break;
      case "s":
      case "arrowdown":
        this.keyboardState.backward = false;
        break;
      case "a":
      case "arrowleft":
        this.keyboardState.left = false;
        break;
      case "d":
      case "arrowright":
        this.keyboardState.right = false;
        break;
    }
  };

  public setGestureState(next: Partial<InputState>): void {
    if (typeof next.steering === "number") {
      this.gestureState.steering = Math.max(-1, Math.min(1, next.steering));
    }
    if (typeof next.throttle === "number") {
      this.gestureState.throttle = Math.max(0, Math.min(1, next.throttle));
    }
    if (typeof next.brake === "number") {
      this.gestureState.brake = Math.max(0, Math.min(1, next.brake));
    }
    if (typeof next.handDetected === "boolean") {
      this.gestureState.handDetected = next.handDetected;
    }
    if (typeof next.motionStopped === "boolean") {
      this.gestureState.motionStopped = next.motionStopped;
    }
  }

  public getState(): InputState {
    const keyboardSteering = this.keyboardState.left ? -1 : this.keyboardState.right ? 1 : 0;
    const steering = keyboardSteering !== 0 ? keyboardSteering : this.gestureState.steering;

    const throttle = this.keyboardState.forward ? 1 : this.gestureState.throttle;
    const brake = this.keyboardState.backward ? 1 : this.gestureState.brake;
    const motionStopped = this.gestureState.motionStopped && !this.keyboardState.forward;

    return {
      forward: this.keyboardState.forward || throttle > 0.05,
      backward: this.keyboardState.backward || brake > 0.08,
      left: this.keyboardState.left || steering < -0.12,
      right: this.keyboardState.right || steering > 0.12,
      steering,
      throttle,
      brake,
      handDetected: this.gestureState.handDetected,
      motionStopped,
    };
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
