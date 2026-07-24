import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { COMETS } from './sim/data';
import { dateInputToSimDays } from './sim/formatDate';
import { CometPicker } from './ui/CometPicker';
import { DateDisplay } from './ui/DateDisplay';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvas3dRef = useRef<HTMLCanvasElement | null>(null);
  const {
    multiplier,
    paused,
    mode,
    date,
    setMultiplier,
    togglePause,
    setMode,
    seekToDate,
    goToToday,
    cometsEnabled,
    selectedComet,
    setCometsEnabled,
    selectComet,
    jumpToPerihelion,
  } = useSimulation(canvasRef, canvas3dRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" hidden={mode === 'threeD'} />
      <canvas ref={canvas3dRef} className="scene" hidden={mode !== 'threeD'} />
      <Toolbar
        multiplier={multiplier}
        paused={paused}
        mode={mode}
        onSelectSpeed={setMultiplier}
        onTogglePause={togglePause}
        onSelectMode={setMode}
        cometsEnabled={cometsEnabled}
        onToggleComets={() => setCometsEnabled(!cometsEnabled)}
      />
      {cometsEnabled && (
        <CometPicker
          comets={COMETS.map((c) => ({ name: c.name, designation: c.designation, note: c.note }))}
          selected={selectedComet}
          onSelect={selectComet}
          onJumpToPerihelion={jumpToPerihelion}
        />
      )}
      <DateDisplay
        date={date}
        onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
        onToday={goToToday}
      />
    </div>
  );
}
