import React from 'react';
import {
  Globe,
  Map,
  Columns2,
  Cpu,
  GraduationCap,
  Sun,
  Moon,
  Presentation,
  HelpCircle,
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
  onStartTour: () => void;
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
  onStartTour,
  ephemerisEngine,
  isLoading,
}) => {
  return (
    <header className="fixed top-3 right-3 z-30 flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
      {/* Ephemeris Status Pill */}
      <div className="hidden xl:flex items-center gap-1.5 hud-panel rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
          }`}
        />
        <span>{ephemerisEngine}</span>
      </div>

      {/* Spatial Projection Switcher */}
      <div
        role="group"
        aria-label="Spatial Projection Mode"
        data-tour="projection"
        className="hud-panel rounded-lg p-1 flex items-center gap-0.5 text-[11px]"
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
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 font-medium'
                  : 'text-slate-400 hover:text-slate-100 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3D Camera Presets — Hidden when in 2D Polar Projection */}
      {projection !== '2d_polar' && (
        <div
          role="group"
          aria-label="3D Camera Framing Presets"
          className="hidden md:flex hud-panel rounded-lg p-1 items-center gap-0.5 text-[11px] font-mono"
        >
          {(
            [
              { id: 'orbit', label: 'Orbit' },
              { id: 'top_down', label: 'Nadir' },
              { id: 'low_oblique', label: 'Oblique' },
            ] as const
          ).map((cam) => {
            const active = cameraPreset === cam.id;
            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => onChangeCameraPreset(cam.id)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  active
                    ? 'bg-slate-700/80 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cam.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Persona Mode Toggle */}
      <button
        type="button"
        onClick={() =>
          onChangePersonaMode(personaMode === 'engineering' ? 'educator' : 'engineering')
        }
        className="hud-panel rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors"
        title="Switch between Engineering & Educator Mode"
      >
        {personaMode === 'engineering' ? (
          <>
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Eng</span>
          </>
        ) : (
          <>
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            <span>Edu</span>
          </>
        )}
      </button>

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label="Toggle color theme"
        className="hud-panel rounded-lg p-1.5 text-slate-300 hover:text-white transition-colors"
        title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4 text-amber-300" />
        ) : (
          <Moon className="w-4 h-4 text-sky-400" />
        )}
      </button>

      {/* Interactive Product Tour Trigger */}
      <button
        type="button"
        onClick={onStartTour}
        aria-label="Start interactive product tour"
        className="hud-panel rounded-lg p-1.5 text-slate-300 hover:text-sky-300 transition-colors"
        title="Start 1-Minute Interactive Tour"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* SVS Presentation Mode */}
      <button
        type="button"
        onClick={onEnterPresentation}
        className="hud-panel rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20 border-sky-400/40 flex items-center gap-1.5 transition-colors"
        title="Enter Clean NASA SVS Presentation View [Esc to exit]"
      >
        <Presentation className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Present</span>
      </button>
    </header>
  );
};