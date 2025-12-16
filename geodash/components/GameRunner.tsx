import React, { useRef, useEffect, useState } from 'react';
import { Player, LevelData, EntityType, LevelObject, GameMode, Vector2 } from '../types';
import { 
  TILE_SIZE, GRAVITY, JUMP_FORCE, MOVE_SPEED, TERMINAL_VELOCITY, ROTATION_SPEED,
  COLOR_BG, COLOR_PLAYER, COLOR_BLOCK, COLOR_SPIKE, COLOR_FLOOR, COLOR_PLAYER_BORDER,
  ORB_JUMP_FORCE, COLOR_ORB_JUMP, COLOR_ORB_GRAVITY, COLOR_PORTAL_GRAVITY, CEILING_HEIGHT,
  COLOR_BLOCK_GLOW, PORTAL_HEIGHT_BLOCKS, MUSIC_PROCEDURAL,
  COLOR_SPEED_SLOW, COLOR_SPEED_NORMAL, COLOR_SPEED_FAST, COLOR_SPEED_VERY_FAST,
  ORB_JUMP_PURPLE_FORCE, COLOR_ORB_PURPLE, ORB_JUMP_RED_FORCE, COLOR_ORB_RED
} from '../constants';

interface GameRunnerProps {
  level: LevelData;
  onDie: () => void;
  onWin: () => void;
  isActive: boolean;
  isProcedural?: boolean; 
  isTestMode?: boolean;
  onTestComplete?: (trail: Vector2[], deathPos: Vector2 | null) => void;
  showHitboxes?: boolean;
}

// Particle System Types
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

const GameRunner: React.FC<GameRunnerProps> = ({ 
    level: initialLevel, 
    onDie, 
    onWin, 
    isActive, 
    isProcedural, 
    isTestMode, 
    onTestComplete,
    showHitboxes 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const playerRef = useRef<Player>({
    position: { x: 0, y: 0 }, 
    velocity: { x: MOVE_SPEED, y: 0 },
    isGrounded: true,
    isDead: false,
    rotation: 0,
    gravityScale: 1,
    canOrbJump: true,
    speedMultiplier: 1.0
  });

  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const recordedTrailRef = useRef<Vector2[]>([]); // For editor testing path
  const bgParticlesRef = useRef<{x: number, y: number, speed: number, size: number}[]>([]);
  const shakeRef = useRef<number>(0);

  const cameraRef = useRef<{x: number, y: number}>({ x: 0, y: 0 });
  const inputRef = useRef<{jump: boolean, jumpPressedThisFrame: boolean}>({ jump: false, jumpPressedThisFrame: false });
  const timeRef = useRef<number>(0);
  
  const [currentLevel, setCurrentLevel] = useState<LevelData>(initialLevel);

  useEffect(() => {
    bgParticlesRef.current = Array.from({ length: 50 }).map(() => ({
        x: Math.random() * 2000,
        y: Math.random() * 800,
        speed: 0.2 + Math.random() * 0.5,
        size: Math.random() * 2
    }));
  }, []);

  useEffect(() => {
    playerRef.current = {
      position: { x: 0, y: 0 },
      velocity: { x: MOVE_SPEED, y: 0 },
      isGrounded: true,
      isDead: false,
      rotation: 0,
      gravityScale: 1,
      canOrbJump: true,
      speedMultiplier: 1.0
    };
    cameraRef.current = { x: 0, y: 0 };
    particlesRef.current = [];
    trailRef.current = [];
    recordedTrailRef.current = [];
    shakeRef.current = 0;

    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
    }

    let musicSrc = initialLevel.musicUrl;
    if (isProcedural) {
        musicSrc = MUSIC_PROCEDURAL;
        const proceduralObjects = generateProceduralSegment(0, 1000);
        setCurrentLevel({
            ...initialLevel,
            length: 100000, 
            gameMode: GameMode.CLASSIC, // Procedural padrao classic, poderia ser free
            objects: proceduralObjects
        });
    } else {
        setCurrentLevel(initialLevel);
    }

    if (musicSrc && isActive) {
        audioRef.current = new Audio(musicSrc);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(e => console.log("Audio auto-play blocked", e));
    }

    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
    }
  }, [initialLevel, isActive, isProcedural]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (!inputRef.current.jump) inputRef.current.jumpPressedThisFrame = true;
        inputRef.current.jump = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        inputRef.current.jump = false;
        inputRef.current.jumpPressedThisFrame = false;
        playerRef.current.canOrbJump = true; 
      }
    };
    const handleMouseDown = () => { 
        if (!inputRef.current.jump) inputRef.current.jumpPressedThisFrame = true;
        inputRef.current.jump = true; 
    };
    const handleMouseUp = () => { 
        inputRef.current.jump = false; 
        inputRef.current.jumpPressedThisFrame = false;
        playerRef.current.canOrbJump = true;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleMouseDown, {passive: false});
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  const spawnParticles = (x: number, y: number, count: number, color: string, speedMult: number = 1) => {
      for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 * speedMult;
          particlesRef.current.push({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              maxLife: 1.0,
              color: color,
              size: Math.random() * 4 + 2
          });
      }
  };

  // Smart Procedural Generation
  const generateProceduralSegment = (startX: number, length: number): LevelObject[] => {
      const objects: LevelObject[] = [];
      let x = startX + 15;
      let currentGravity = 1; // Track gravity to know where to place floor/ceiling

      while (x < startX + length) {
          const r = Math.random();
          
          // Helper to place relative to current gravity floor
          const place = (type: EntityType, offsetX: number, offsetY: number, rotation: number = 0) => {
              // If gravity is 1: Floor is y=1. 
              // If gravity is -1: Floor is Ceiling (y=CEILING_HEIGHT).
              const y = currentGravity === 1 ? offsetY : (CEILING_HEIGHT - offsetY + 1);
              // If gravity is -1, objects might need rotation flip (like spikes)
              let finalRot = rotation;
              if (currentGravity === -1 && (type === EntityType.SPIKE || type === EntityType.HALF_SPIKE)) {
                  // If spike is on 'floor' (ceiling), it needs to point down.
                  // Normal spike points up (0 deg). Inverted should be 180.
                  finalRot = (rotation + 180) % 360;
              }
              
              objects.push({ 
                  id: `p-${x}-${offsetX}`, 
                  type, 
                  x: x + offsetX, 
                  y: y, 
                  rotation: finalRot 
              });
          };

          if (r < 0.15) {
              // Spike
              place(EntityType.SPIKE, 0, 1);
              x += 3;
          } else if (r < 0.35) {
              // Block Jump
              place(EntityType.BLOCK, 0, 1);
              x += 4;
          } else if (r < 0.40) {
              // Gravity Portal Trap
               place(EntityType.BLOCK, 0, 1);
               place(EntityType.PORTAL_GRAVITY, 0, 2);
               currentGravity *= -1; // Flip internal state
               x += 10;
          } else if (r < 0.5) {
              // Staircase
              place(EntityType.BLOCK, 0, 1);
              place(EntityType.BLOCK, 1, 2);
              place(EntityType.BLOCK, 2, 3);
              x += 6;
          } else if (r < 0.55) {
              // Orb Jump
              place(EntityType.ORB_JUMP, 0, 3);
              place(EntityType.SPIKE, 0, 1);
              place(EntityType.SPIKE, 1, 1);
              x += 5;
          } else {
              x += 2;
          }
      }
      return objects;
  };

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const checkCollision = (r1: {x: number, y: number, w: number, h: number}, r2: {x: number, y: number, w: number, h: number}) => {
      return (
        r1.x < r2.x + r2.w &&
        r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h &&
        r1.y + r1.h > r2.y
      );
    };

    const update = () => {
      timeRef.current += 0.05;
      const player = playerRef.current;
      const gravityMult = player.gravityScale; 

      if (shakeRef.current > 0) shakeRef.current *= 0.9;
      if (shakeRef.current < 0.5) shakeRef.current = 0;

      if (player.isDead) {
          spawnParticles(player.position.x + 24, player.position.y - 24, 5, COLOR_PLAYER, 0.5);
          return;
      }

      // Record Trail for Editor Test
      if (isTestMode && !player.isDead && timeRef.current % 0.1 < 0.05) {
          recordedTrailRef.current.push({ x: player.position.x, y: player.position.y });
      }

      // --- Ground / Stability Check ---
      if (player.isGrounded && !inputRef.current.jump) {
          let supported = false;
          if (gravityMult === 1) {
              if (player.position.y >= 0) supported = true; 
          } else {
              if (currentLevel.gameMode !== GameMode.FREE) {
                  const ceilY = -(CEILING_HEIGHT * TILE_SIZE);
                  if (player.position.y <= ceilY + TILE_SIZE + 2) supported = true;
              }
          }

          if (!supported) {
            const pX = player.position.x + TILE_SIZE/2;
            for (const obj of currentLevel.objects) {
                if (obj.type === EntityType.BLOCK) {
                    const oX = obj.x * TILE_SIZE;
                    const oY = -obj.y * TILE_SIZE; 
                    
                    if (pX > oX && pX < oX + TILE_SIZE) {
                        if (gravityMult === 1) {
                            if (Math.abs(player.position.y - oY) < 5) {
                                supported = true;
                                break;
                            }
                        } else {
                            const targetY = oY + 2 * TILE_SIZE;
                            if (Math.abs(player.position.y - targetY) < 5) {
                                supported = true;
                                break;
                            }
                        }
                    }
                }
            }
          }

          if (!supported) {
              player.isGrounded = false;
          }
      }

      // --- Physics Update ---
      if (!player.isGrounded) {
          player.velocity.y += GRAVITY * gravityMult;
      } else {
          player.velocity.y = 0; 
      }

      // Apply Speed Multiplier
      player.velocity.x = MOVE_SPEED * player.speedMultiplier;

      if (inputRef.current.jump && player.isGrounded) {
        player.velocity.y = JUMP_FORCE * gravityMult;
        player.isGrounded = false;
        player.canOrbJump = false; 
        spawnParticles(player.position.x + 24, player.position.y, 10, 'white');
      }
      
      if (gravityMult === 1) {
          if (player.velocity.y > TERMINAL_VELOCITY) player.velocity.y = TERMINAL_VELOCITY;
      } else {
          if (player.velocity.y < -TERMINAL_VELOCITY) player.velocity.y = -TERMINAL_VELOCITY;
      }

      player.position.x += player.velocity.x;

      if (!player.isGrounded) {
        player.rotation += ROTATION_SPEED * gravityMult;
      } else {
        const rem = player.rotation % 90;
        if (rem !== 0) player.rotation = Math.round(player.rotation / 90) * 90;
      }

      if (timeRef.current % 0.1 < 0.1) {
          trailRef.current.push({
              x: player.position.x,
              y: player.position.y,
              rotation: player.rotation,
              alpha: 0.6
          });
          if (trailRef.current.length > 8) trailRef.current.shift();
      }

      // --- Collision Detection ---
      const prevY = player.position.y - player.velocity.y;
      player.position.y += player.velocity.y;
      
      const pRect = {
        x: player.position.x + 10,
        y: player.position.y - TILE_SIZE + 10,
        w: TILE_SIZE - 20,
        h: TILE_SIZE - 20
      };
      
      const pCenterX = player.position.x + TILE_SIZE/2;
      const pCenterY = player.position.y - TILE_SIZE/2;

      for (const obj of currentLevel.objects) {
          const objX = obj.x * TILE_SIZE;
          const objY = -obj.y * TILE_SIZE; 
          const objCenterX = objX + TILE_SIZE/2;
          const objCenterY = objY + TILE_SIZE/2;
          
          if (
              obj.type === EntityType.ORB_JUMP || 
              obj.type === EntityType.ORB_GRAVITY ||
              obj.type === EntityType.ORB_JUMP_PURPLE ||
              obj.type === EntityType.ORB_JUMP_RED
             ) {
              const dx = pCenterX - objCenterX;
              const dy = pCenterY - objCenterY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const orbRadius = 32; 

              const isJumpInputActive = inputRef.current.jumpPressedThisFrame || (inputRef.current.jump && playerRef.current.canOrbJump);

              if (dist < orbRadius && isJumpInputActive && playerRef.current.canOrbJump) {
                  playerRef.current.canOrbJump = false; 
                  inputRef.current.jumpPressedThisFrame = false; 
                  
                  let orbColor = COLOR_ORB_JUMP;
                  if (obj.type === EntityType.ORB_GRAVITY) orbColor = COLOR_ORB_GRAVITY;
                  if (obj.type === EntityType.ORB_JUMP_PURPLE) orbColor = COLOR_ORB_PURPLE;
                  if (obj.type === EntityType.ORB_JUMP_RED) orbColor = COLOR_ORB_RED;

                  spawnParticles(objCenterX, objCenterY, 15, orbColor);

                  if (obj.type === EntityType.ORB_JUMP) {
                      player.velocity.y = ORB_JUMP_FORCE * gravityMult;
                      player.isGrounded = false;
                  } else if (obj.type === EntityType.ORB_JUMP_PURPLE) {
                      player.velocity.y = ORB_JUMP_PURPLE_FORCE * gravityMult;
                      player.isGrounded = false;
                  } else if (obj.type === EntityType.ORB_JUMP_RED) {
                      player.velocity.y = ORB_JUMP_RED_FORCE * gravityMult;
                      player.isGrounded = false;
                  } else if (obj.type === EntityType.ORB_GRAVITY) {
                      player.gravityScale *= -1; 
                      player.velocity.y = JUMP_FORCE * 0.5 * player.gravityScale; 
                      player.isGrounded = false;
                  }
              }
              continue; 
          }

          // Handle Portals
          if (
              obj.type === EntityType.PORTAL_GRAVITY || 
              obj.type === EntityType.PORTAL_SPEED_SLOW || 
              obj.type === EntityType.PORTAL_SPEED_NORMAL || 
              obj.type === EntityType.PORTAL_SPEED_FAST ||
              obj.type === EntityType.PORTAL_SPEED_VERY_FAST
          ) {
             const portalTop = objY - (PORTAL_HEIGHT_BLOCKS - 1) * TILE_SIZE;
             const portalH = PORTAL_HEIGHT_BLOCKS * TILE_SIZE;
             
             if (checkCollision(pRect, {x: objX + 15, y: portalTop, w: 18, h: portalH})) {
                 
                 // Speed Portals
                 if (obj.type === EntityType.PORTAL_SPEED_SLOW) player.speedMultiplier = 0.8;
                 if (obj.type === EntityType.PORTAL_SPEED_NORMAL) player.speedMultiplier = 1.0;
                 if (obj.type === EntityType.PORTAL_SPEED_FAST) player.speedMultiplier = 1.2;
                 if (obj.type === EntityType.PORTAL_SPEED_VERY_FAST) player.speedMultiplier = 1.4;

                 // Gravity Portal Logic
                 if (obj.type === EntityType.PORTAL_GRAVITY) {
                    const lastPortalX = (player as any).lastPortalX || -1000;
                    if (Math.abs(player.position.x - lastPortalX) > TILE_SIZE * 2) {
                        player.gravityScale *= -1;
                        spawnParticles(pCenterX, pCenterY, 20, COLOR_PORTAL_GRAVITY, 2);
                        (player as any).lastPortalX = player.position.x;
                    }
                 }
             }
             continue;
          }

          let hitBoxY = objY;
          let hitBoxH = TILE_SIZE;
          let hitBoxX = objX;
          let hitBoxW = TILE_SIZE;

          if (obj.type === EntityType.SPIKE) {
              hitBoxX += 14; hitBoxW -= 28;
              hitBoxY += 14; hitBoxH -= 28;
          } else if (obj.type === EntityType.HALF_SPIKE) {
              hitBoxX += 14; hitBoxW -= 28;
              hitBoxY += 28; hitBoxH -= 28; 
          }

          if (checkCollision(pRect, {x: hitBoxX, y: hitBoxY, w: hitBoxW, h: hitBoxH})) {
              if (obj.type === EntityType.SPIKE || obj.type === EntityType.HALF_SPIKE) {
                  player.isDead = true;
                  shakeRef.current = 20;
                  
                  if (isTestMode && onTestComplete) {
                      onTestComplete(recordedTrailRef.current, player.position);
                  } else {
                      onDie();
                  }
                  return;
              } else if (obj.type === EntityType.BLOCK) {
                  let landed = false;
                  if (gravityMult === 1) {
                      if (player.velocity.y >= 0 && prevY <= objY + 15) {
                          player.position.y = objY; 
                          landed = true;
                      }
                  } else {
                      const blockBottom = objY + TILE_SIZE;
                      if (player.velocity.y <= 0 && (prevY - TILE_SIZE) >= blockBottom - 15) {
                          player.position.y = blockBottom + TILE_SIZE; 
                          landed = true;
                      }
                  }

                  if (landed) {
                      player.velocity.y = 0;
                      player.isGrounded = true;
                  } else {
                      player.isDead = true;
                      shakeRef.current = 20;
                      if (isTestMode && onTestComplete) {
                          onTestComplete(recordedTrailRef.current, player.position);
                      } else {
                          onDie();
                      }
                      return;
                  }
              }
          }
      }

      // --- Floor/Ceiling Logic ---
      if (!player.isDead) {
          if (gravityMult === 1) {
              if (player.position.y >= 0) {
                  player.position.y = 0;
                  player.velocity.y = 0;
                  player.isGrounded = true;
              }
          } else {
              const ceilY = -(CEILING_HEIGHT * TILE_SIZE);
              
              if (currentLevel.gameMode === GameMode.FREE) {
                   if (player.position.y < -3000 || player.position.y > 1000) {
                       player.isDead = true;
                       if (isTestMode && onTestComplete) {
                           onTestComplete(recordedTrailRef.current, player.position);
                       } else {
                           onDie();
                       }
                   }
              } else {
                   if (player.position.y - TILE_SIZE <= ceilY) {
                       player.position.y = ceilY + TILE_SIZE;
                       player.velocity.y = 0;
                       player.isGrounded = true;
                  }
              }
          }
      }

      inputRef.current.jumpPressedThisFrame = false;
      
      const targetCamX = player.position.x - 300;
      cameraRef.current.x = targetCamX;

      if (currentLevel.gameMode === GameMode.FREE) {
          // Adjust camera offset to show more below the player
          // By subtracting from player.position.y, we set the target lower.
          // Since Y grows positively UP in this logic (wait, GameRunner logic: y=0 is floor, y+ is up),
          // Actually, let's look at Camera Translation:
          // ctx.translate(..., floorVisualY + shakeY - camY);
          // If camY is LOWER, the shift is smaller, so the world is drawn HIGHER up the screen.
          // This pushes the player UP visually, revealing more below.
          const targetCamY = player.position.y - 150; 
          cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;
      } else {
          cameraRef.current.y = 0; 
      }

      if (!isProcedural && player.position.x > currentLevel.length * TILE_SIZE) {
        if (isTestMode && onTestComplete) {
            onTestComplete(recordedTrailRef.current, null);
        } else {
            onWin();
        }
      }

      particlesRef.current.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.03;
      });
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    };

    const draw = () => {
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const shakeX = (Math.random() - 0.5) * shakeRef.current;
      const shakeY = (Math.random() - 0.5) * shakeRef.current;

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;
      
      const floorVisualY = canvas.height - 100;

      ctx.save();
      ctx.translate(-camX + shakeX, floorVisualY + shakeY - camY);

      bgParticlesRef.current.forEach(bg => {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          const screenX = (bg.x + camX * 0.1) % 2000;
          ctx.fillRect(camX + screenX - 500, bg.y - 1000 + camY, bg.size, bg.size);
      });
      
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      const startGrid = Math.floor(camX / 100) * 100;
      for(let i=0; i<25; i++) {
          ctx.beginPath();
          ctx.moveTo(startGrid + i*100, -2000);
          ctx.lineTo(startGrid + i*100, 1000);
          ctx.stroke();
      }

      ctx.fillStyle = COLOR_FLOOR;
      ctx.fillRect(camX - 100, 0, canvas.width + 200, 500); 
      ctx.fillStyle = 'white';
      ctx.fillRect(camX - 100, 0, canvas.width + 200, 4);
      
      if (currentLevel.gameMode === GameMode.CLASSIC) {
          const ceilY = -(CEILING_HEIGHT * TILE_SIZE);
          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(camX - 100, ceilY, canvas.width + 200, 2);
      }

      trailRef.current.forEach(pt => {
          ctx.save();
          ctx.translate(pt.x + TILE_SIZE/2, pt.y - TILE_SIZE/2);
          ctx.rotate((pt.rotation * Math.PI) / 180);
          ctx.globalAlpha = pt.alpha * 0.3;
          ctx.fillStyle = COLOR_PLAYER;
          ctx.fillRect(-TILE_SIZE/2, -TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
          ctx.restore();
      });

      currentLevel.objects.forEach(obj => {
        const x = obj.x * TILE_SIZE;
        const y = -obj.y * TILE_SIZE; 
        const cx = x + TILE_SIZE/2;
        const cy = y + TILE_SIZE/2;

        ctx.save();
        ctx.translate(cx, cy);
        if (obj.rotation) ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
        
        if (obj.type === EntityType.BLOCK) {
          ctx.fillStyle = COLOR_BLOCK;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.shadowColor = COLOR_BLOCK;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.shadowBlur = 0;
          
          if (showHitboxes) {
              ctx.strokeStyle = 'red';
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          }
        } else if (obj.type === EntityType.SPIKE) {
          ctx.fillStyle = COLOR_SPIKE;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + TILE_SIZE); 
          ctx.lineTo(x + TILE_SIZE / 2, y + 4); 
          ctx.lineTo(x + TILE_SIZE - 4, y + TILE_SIZE); 
          ctx.fill();
          
          if (showHitboxes) {
              ctx.strokeStyle = 'red';
              ctx.strokeRect(x + 14, y + 14, TILE_SIZE - 28, TILE_SIZE - 28);
          }
        } else if (obj.type === EntityType.HALF_SPIKE) {
          ctx.fillStyle = COLOR_SPIKE;
          ctx.beginPath();
          ctx.moveTo(x, y + TILE_SIZE); 
          ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE/2); 
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); 
          ctx.fill();
          
          if (showHitboxes) {
               ctx.strokeStyle = 'red';
               ctx.strokeRect(x + 14, y + 28, TILE_SIZE - 28, TILE_SIZE - 28);
          }
        } else if (
            obj.type === EntityType.ORB_JUMP || 
            obj.type === EntityType.ORB_GRAVITY ||
            obj.type === EntityType.ORB_JUMP_PURPLE ||
            obj.type === EntityType.ORB_JUMP_RED
        ) {
          let color = COLOR_ORB_JUMP;
          if (obj.type === EntityType.ORB_GRAVITY) color = COLOR_ORB_GRAVITY;
          if (obj.type === EntityType.ORB_JUMP_PURPLE) color = COLOR_ORB_PURPLE;
          if (obj.type === EntityType.ORB_JUMP_RED) color = COLOR_ORB_RED;

          const pulse = 1 + Math.sin(timeRef.current * 4) * 0.1;
          
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 28 * pulse, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
          
          if (showHitboxes) {
              ctx.strokeStyle = 'yellow';
              ctx.beginPath();
              ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 32, 0, Math.PI*2);
              ctx.stroke();
          }
        } else if (obj.type === EntityType.PORTAL_GRAVITY || 
                   obj.type === EntityType.PORTAL_SPEED_SLOW ||
                   obj.type === EntityType.PORTAL_SPEED_NORMAL ||
                   obj.type === EntityType.PORTAL_SPEED_FAST ||
                   obj.type === EntityType.PORTAL_SPEED_VERY_FAST
                  ) {
          const portalTop = y - (PORTAL_HEIGHT_BLOCKS - 1) * TILE_SIZE;
          const portalH = PORTAL_HEIGHT_BLOCKS * TILE_SIZE;
          
          let pColor = COLOR_PORTAL_GRAVITY;
          let label = "G";
          if (obj.type === EntityType.PORTAL_SPEED_SLOW) { pColor = COLOR_SPEED_SLOW; label = ">>>"; }
          if (obj.type === EntityType.PORTAL_SPEED_NORMAL) { pColor = COLOR_SPEED_NORMAL; label = ">>>"; }
          if (obj.type === EntityType.PORTAL_SPEED_FAST) { pColor = COLOR_SPEED_FAST; label = ">>>"; }
          if (obj.type === EntityType.PORTAL_SPEED_VERY_FAST) { pColor = COLOR_SPEED_VERY_FAST; label = ">>>"; }

          ctx.fillStyle = pColor + '33'; // Low opacity
          ctx.fillRect(x + 10, portalTop, 28, portalH);
          ctx.strokeStyle = pColor;
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 10, portalTop, 28, portalH);
          
          // Draw arrow or identifier
          ctx.fillStyle = 'white';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, x + 24, portalTop + portalH / 2);

          if (showHitboxes) {
              ctx.strokeStyle = 'red';
              ctx.strokeRect(x + 15, portalTop, 18, portalH);
          }
        }
        
        ctx.restore();
      });

      particlesRef.current.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
      });

      const p = playerRef.current;
      const pX = p.position.x;
      const pY = p.position.y - TILE_SIZE;

      if (!p.isDead) {
        ctx.save();
        ctx.translate(pX + TILE_SIZE/2, pY + TILE_SIZE/2);
        ctx.rotate((p.rotation * Math.PI) / 180);
        if (p.gravityScale === -1) ctx.scale(1, -1);

        ctx.translate(-(pX + TILE_SIZE/2), -(pY + TILE_SIZE/2));
        ctx.shadowColor = COLOR_PLAYER;
        ctx.shadowBlur = 10;
        ctx.fillStyle = COLOR_PLAYER;
        ctx.fillRect(pX, pY, TILE_SIZE, TILE_SIZE);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = COLOR_PLAYER_BORDER;
        ctx.lineWidth = 3;
        ctx.strokeRect(pX, pY, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = 'black';
        ctx.fillRect(pX + 30, pY + 12, 8, 8);
        ctx.fillRect(pX + 30, pY + 28, 8, 8);
        
        if (showHitboxes) {
            ctx.strokeStyle = 'red';
            // Correct hitbox drawing: use pX, pY to align with the player rect drawn above
            ctx.strokeRect(pX + 10, pY + 10, TILE_SIZE - 20, TILE_SIZE - 20); 
        }

        ctx.restore();
      }

      ctx.restore(); 

      // UI
      const progress = Math.min(100, Math.max(0, (p.position.x / (currentLevel.length * TILE_SIZE)) * 100));
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px monospace';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(isProcedural ? `SCORE: ${Math.floor(p.position.x/100)}` : `${Math.floor(progress)}%`, 20, 40);
      
      if (!isProcedural) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(20, 50, 200, 10);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(20, 50, 2 * progress, 10);
      }
      
      if (isTestMode) {
          ctx.fillStyle = 'yellow';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText("TEST MODE", canvas.width - 120, 40);
      }
    };

    const loop = () => {
      update();
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, currentLevel, onDie, onWin, isProcedural, isTestMode, showHitboxes]);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={675}
      className="w-full h-full block bg-gray-900 shadow-2xl rounded-lg cursor-pointer touch-none"
    />
  );
};

export default GameRunner;