export enum EntityType {
  PLAYER = 'PLAYER',
  BLOCK = 'BLOCK',
  SPIKE = 'SPIKE',
  HALF_SPIKE = 'HALF_SPIKE',
  ORB_JUMP = 'ORB_JUMP', // Yellow (Standard)
  ORB_JUMP_PURPLE = 'ORB_JUMP_PURPLE', // Small Jump
  ORB_JUMP_RED = 'ORB_JUMP_RED', // Big Jump
  ORB_GRAVITY = 'ORB_GRAVITY', // Blue
  PORTAL_GRAVITY = 'PORTAL_GRAVITY',
  PORTAL_SPEED_SLOW = 'PORTAL_SPEED_SLOW', // 0.8x
  PORTAL_SPEED_NORMAL = 'PORTAL_SPEED_NORMAL', // 1x
  PORTAL_SPEED_FAST = 'PORTAL_SPEED_FAST', // 1.2x
  PORTAL_SPEED_VERY_FAST = 'PORTAL_SPEED_VERY_FAST', // 1.4x
  FLOOR = 'FLOOR'
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  EDITOR = 'EDITOR',
  TESTING = 'TESTING',
  GAME_OVER = 'GAME_OVER',
  WON = 'WON'
}

export enum GameMode {
  CLASSIC = 'CLASSIC', // Câmera fixa em Y, chão e teto definidos
  FREE = 'FREE' // Câmera segue Y, sem teto (modo "Final")
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface LevelObject {
  id: string;
  type: EntityType;
  x: number; 
  y: number;
  rotation?: number; // 0, 90, 180, 270
}

export interface LevelData {
  name: string;
  objects: LevelObject[];
  length: number;
  floorY: number;
  musicUrl?: string;
  gameMode: GameMode;
  showHitboxes?: boolean;
}

export interface Player {
  position: Vector2;
  velocity: Vector2;
  isGrounded: boolean;
  isDead: boolean;
  rotation: number;
  gravityScale: number;
  canOrbJump: boolean;
  speedMultiplier: number;
}