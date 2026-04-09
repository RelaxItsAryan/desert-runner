import { Hand } from "lucide-react";

export const ControlsGuide = () => {
  return (
    <div className="absolute bottom-6 left-6 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-4 pointer-events-none z-10">
      <div className="flex items-center gap-2 mb-3">
        <Hand className="w-4 h-4 text-primary" />
        <span className="text-sm text-muted-foreground">Hand Gestures</span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>Move hand left/right: steer</div>
        <div>Push hand forward: accelerate</div>
        <div>Pull hand backward: brake</div>
        <div>Closed fist: stop</div>
        <div>Open palm: resume</div>
        <div>W/A/S/D: keyboard fallback</div>
      </div>
    </div>
  );
};
