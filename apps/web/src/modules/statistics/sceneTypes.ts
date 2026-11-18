import type { EvolutionPoint, LandscapeMode, Pillar } from './types';
export interface CameraCommand {
  action: 'reset' | 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
  version: number;
}
export interface SceneProps {
  series: EvolutionPoint[];
  visible: Pillar[];
  mode: LandscapeMode;
  selected: number;
  cameraCommand: CameraCommand;
  onSelect: (index: number, area?: Pillar) => void;
  onUnavailable: () => void;
}
