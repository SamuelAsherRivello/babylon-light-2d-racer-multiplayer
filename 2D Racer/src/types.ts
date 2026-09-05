export type Phase = 'menu' | 'countdown' | 'racing' | 'won' | 'lost';
export interface Input { throttle: boolean; brake: boolean; left: boolean; right: boolean }
export interface Car { id: number; x: number; z: number; y: number; heading: number; speed: number; steer: number; airborne: boolean; offroad: boolean; progress: number; color: string; lapProgress?: number }
export interface RaceState { phase: Phase; cars: Car[]; remaining: number; countdown: number; elapsed: number; position: number; lapProgress: number; winnerId?: number }
export type GameEvent = 'start' | 'go' | 'jump' | 'land' | 'hit' | 'win' | 'lose';
export interface TrackPoint { x: number; z: number }
export interface TrackDefinition { points: TrackPoint[]; width: number; ramps: { progress: number; length: number; height: number }[] }
