import React from 'react';
import {
  Globe,
  Map,
  Columns2,
  Sun,
  Moon,
  Presentation,
  GraduationCap,
  Cpu,
} from 'lucide-react';
import type { PersonaMode } from '../../types/mission';
import type { CameraPresetId, ProjectionMode } from '../../types/workbench';

interface TopRightToolbarProps {
  projection: ProjectionMode;
  onChangeProjection: (mode: ProjectionMode) => void;
  cameraPreset: CameraPresetId;
  onChangeCameraPreset: (preset: CameraPresetId) => void;
  personaMode: PersonaMode;
  onChangePersonaMode: (mode: PersonaMode) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onEnterPresentation: () => void;
  ephemerisEngine: string;
  isLoading: boolean;
}

export const TopRightToolbar: React.FC<TopRightToolbarProps> = ({
  projection,
  onChangeProjection,
  cameraPreset,
  onChangeCameraPreset,
  personaMode,
  onChangePersonaMode,
  theme,
  onToggleTheme,
  onEnterPresentation,
  ephemerisEngine,
  isLoading,
}) => {
  return (
    <header
      aria-label="Viewport Projection and Mode Controls"
      className="fixed top-3 right-3 z-30 flex flex-wrap items-center justify-end gap-1.5 pointer-events-auto"
    >
      {/* Ephemeris Engine Status Pill */}
      <div className="hidden xl:flex items-center gap-1.5 hud-panel rounded-md px-2.5 py-1 text-[10px] font-mono text-slate-300">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
          }`}
        />
        <span>{isLoading ? 'COMPUTING' : ephemerisEngine.toUpperCase()}</span>
      </div>

      {/* Projection Switcher */}
      <div
        role="group"
        aria-label="Map Projection Mode"
        className="hud-panel rounded-md p-0.5 flex items-center text-[11px]"
      >
        {(
          [
            { id: '3d_terrain', label: '3D Terrain', icon: Globe },
            { id: '2d_polar', label: '2D Polar', icon: Map },
            { id: 'split', label: 'Split', icon: Columns2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = projection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeProjection(item.id)}
              aria-pressed={active}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                active
                  ? 'bg-sky-400/20 text-sky-300 font-medium border border-sky-400/40'
                  : 'text-slate-400 hover:text-slate-100 border border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Camera Preset Switcher */}
      <div
        role="group"
        aria-label="Camera Presets"
        className="hidden lg:flex hud-panel rounded-md p-0.5 items-center text-[11px] font-mono"
      >
        {(
          [
            { id: 'orbit', label: 'Orbit' },
            { id: 'top_down', label: 'Nadir' },
            { id: 'low_oblique', label: 'Oblique' },
          ] as const
        ).map((preset) => {
          const active = cameraPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChangeCameraPreset(preset.id)}
              aria-pressed={active}
              className={`px-2 py-1 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                active
                  ? 'bg-slate-700/80 text-slate-100 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Engineering vs Educator Mode */}
      <button
        type="button"
        onClick={() =>
          onChangePersonaMode(personaMode === 'engineering' ? 'educator' : 'engineering')
        }
        title="Switch between Engineering Telemetry and Guided Educator Annotations"
        className="hud-panel rounded-md px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {personaMode === 'engineering' ? (
          <>
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Eng</span>
          </>
        ) : (
          <>
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Edu</span>
          </>
        )}
      </button>

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="hud-panel rounded-md p-1.5 text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {theme === 'dark' ? (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-sky-500" />
        )}
      </button>

      {/* SVS Presentation Mode */}
      <button
        type="button"
        onClick={onEnterPresentation}
        title="Enter SVS Clean Presentation Mode"
        className="hud-panel rounded-md px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1.5 text-sky-300 border-sky-500/40 hover:bg-sky-500/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Presentation className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Present</span>
      </button>
    </header>
  );
};