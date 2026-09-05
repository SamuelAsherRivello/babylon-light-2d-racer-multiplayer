import type { RaceState } from './types';
export interface Member { sessionId:string; name:string; ready:boolean; carId:number }
export interface Lobby { code:string; capacity:number; hostId:string; members:Member[]; phase:'lobby'|'countdown'|'racing' }
export interface Snapshot { race:RaceState; sequence:number; serverTime?:number }
export interface Finished { message:string; winnerId?:number }
