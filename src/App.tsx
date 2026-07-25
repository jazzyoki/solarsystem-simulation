import { useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { COMETS, PLANETS } from './sim/data';
import { dateInputToSimDays } from './sim/formatDate';
import { CometPicker } from './ui/CometPicker';
import { DateDisplay } from './ui/DateDisplay';
import { PlanetPicker } from './ui/PlanetPicker';
import { Toolbar } from './ui/Toolbar';

const FOCUSABLE_BODIES = ['Sun', ...PLANETS.map((p) => p.name)];

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
    focusedBody,
    selectBody,
  } = useSimulation(canvasRef, canvas3dRef);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="scene" hidden={mode === 'threeD'} />
      <canvas ref={canvas3dRef} className="scene" hidden={mode !== 'threeD'} />
      <div className="left-stack">
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
        <div className="picker-column">
          {mode === 'threeD' && (
            <PlanetPicker planets={FOCUSABLE_BODIES} selected={focusedBody} onSelect={selectBody} />
          )}
          {cometsEnabled && (
            <CometPicker
              comets={COMETS.map((c) => ({ name: c.name, designation: c.designation, note: c.note }))}
              selected={selectedComet}
              onSelect={selectComet}
              onJumpToPerihelion={jumpToPerihelion}
            />
          )}
        </div>
      </div>
      <DateDisplay
        date={date}
        onSelectDate={(value) => seekToDate(dateInputToSimDays(value))}
        onToday={goToToday}
      />
    </div>
  );
}
