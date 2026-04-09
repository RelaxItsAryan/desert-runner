import { Hand, Keyboard } from "lucide-react";

interface ControlsGuideProps {
  controlMode: "gesture" | "keyboard";
}

export const ControlsGuide = ({ controlMode }: ControlsGuideProps) => {
  return (
    <div className="absolute bottom-6 left-6 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-4 pointer-events-none z-10">
      <div className="flex items-center gap-2 mb-3">
        {controlMode === "gesture" ? <Hand className="w-4 h-4 text-primary" /> : <Keyboard className="w-4 h-4 text-primary" />}
        <span className="text-sm text-muted-foreground">{controlMode === "gesture" ? "Hand Gestures" : "Keyboard Controls"}</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {controlMode === "gesture" ? (
          <>
            <div>Move hand left/right: steer</div>
            <div>Push hand forward: accelerate</div>
            <div>Pull hand backward: brake</div>
            <div>Closed fist: stop</div>
            <div>Open palm: resume</div>
          </>
        ) : (
          <>
            <div>W / Arrow Up: accelerate</div>
            <div>S / Arrow Down: brake</div>
            <div>A / Arrow Left: steer left</div>
            <div>D / Arrow Right: steer right</div>
          </>
        )}
      </div>
    </div>
  );
};
