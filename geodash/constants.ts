import { LevelData, EntityType, GameMode } from './types';

// Physics & Rendering Constants
export const TILE_SIZE = 48; 
export const GRAVITY = 2.0; 
export const JUMP_FORCE = -24; 
export const ORB_JUMP_FORCE = -21; // Yellow Standard
export const ORB_JUMP_PURPLE_FORCE = -15; // Small Jump
export const ORB_JUMP_RED_FORCE = -34; // Big Jump
export const ORB_GRAVITY_FORCE = -15; // Blue Gravity (helper force)

export const MOVE_SPEED = 9; 
export const TERMINAL_VELOCITY = 30;
export const ROTATION_SPEED = 6;
export const CEILING_HEIGHT = 12; 
export const PORTAL_HEIGHT_BLOCKS = 3; 

// Colors (Neon Palette)
export const COLOR_BG = '#111827'; 
export const COLOR_PLAYER = '#fbbf24'; 
export const COLOR_PLAYER_BORDER = '#fff';
export const COLOR_BLOCK = '#3b82f6'; 
export const COLOR_BLOCK_GLOW = 'rgba(59, 130, 246, 0.4)';
export const COLOR_SPIKE = '#ef4444'; 
export const COLOR_FLOOR = '#4f46e5'; 

// New Entity Colors
export const COLOR_ORB_JUMP = '#facc15'; // Yellow
export const COLOR_ORB_PURPLE = '#a855f7'; // Purple
export const COLOR_ORB_RED = '#ef4444'; // Red
export const COLOR_ORB_GRAVITY = '#3b82f6'; // Blue
export const COLOR_PORTAL_GRAVITY = '#10b981'; 
export const COLOR_PARTICLE = '#ffffff';

// Speed Portal Colors
export const COLOR_SPEED_SLOW = '#f97316'; // Orange 0.8x
export const COLOR_SPEED_NORMAL = '#22c55e'; // Green 1x
export const COLOR_SPEED_FAST = '#ec4899'; // Pink 1.2x
export const COLOR_SPEED_VERY_FAST = '#ef4444'; // Red 1.4x

// Audio Defaults
export const MUSIC_PROCEDURAL = "https://cdn.pixabay.com/download/audio/2022/03/24/audio_1978434676.mp3?filename=electronic-future-beats-117417.mp3";
export const MUSIC_EDITOR = "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=cyberpunk-beat-116565.mp3";

// Default Level
export const DEFAULT_LEVEL: LevelData = {
  name: "New Level",
  length: 200,
  floorY: 0,
  gameMode: GameMode.CLASSIC,
  musicUrl: MUSIC_EDITOR,
  objects: [
    { id: '1', type: EntityType.BLOCK, x: 10, y: 1, rotation: 0 },
    { id: '2', type: EntityType.BLOCK, x: 11, y: 1, rotation: 0 },
    { id: '3', type: EntityType.SPIKE, x: 15, y: 1, rotation: 0 },
  ]
};