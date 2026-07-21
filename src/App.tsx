import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { multiplier, paused, mode, date, setMultiplier, togglePause, setMode } =
    useSimulation(canvasRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" />
      <Toolbar
        multiplier={multiplier}
        paused={paused}
        mode={mode}
        onSelectSpeed={setMultiplier}
        onTogglePause={togglePause}
        onSelectMode={setMode}
      />
      <DateDisplay date={date} />
    </div>
  );
}
