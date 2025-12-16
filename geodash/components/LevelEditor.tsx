import React, { useState, useRef, useEffect } from 'react';
import { LevelData, EntityType, LevelObject, GameMode, Vector2 } from '../types';
import { 
  TILE_SIZE, COLOR_BLOCK, COLOR_SPIKE, COLOR_ORB_JUMP, COLOR_ORB_GRAVITY, COLOR_PORTAL_GRAVITY, 
  PORTAL_HEIGHT_BLOCKS, CEILING_HEIGHT, MUSIC_EDITOR,
  COLOR_SPEED_SLOW, COLOR_SPEED_NORMAL, COLOR_SPEED_FAST, COLOR_SPEED_VERY_FAST,
  COLOR_ORB_PURPLE, COLOR_ORB_RED
} from '../constants';
import { generateLevelAI } from '../services/geminiService';
import { Loader2, Wand2, Play, Trash2, Eraser, Save, Upload, Music, Hand, Settings, RefreshCw, MousePointer2, Paintbrush, Move, Pencil, X, AlertTriangle } from 'lucide-react';

interface LevelEditorProps {
  level: LevelData;
  onUpdateLevel: (level: LevelData) => void;
  onPlay: () => void;
  onExit: () => void;
  testTrail?: Vector2[];
  deathPos?: Vector2 | null;
}

type EditorTool = 'PAN' | 'DRAW' | 'EDIT' | 'ERASE';
type Tab = 'BLOCKS' | 'TRAPS' | 'ORBS' | 'SPEED';

const LevelEditor: React.FC<LevelEditorProps> = ({ level, onUpdateLevel, onPlay, onExit, testTrail, deathPos }) => {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>(EntityType.BLOCK);
  const [toolMode, setToolMode] = useState<EditorTool>('PAN');
  const [activeTab, setActiveTab] = useState<Tab>('BLOCKS');
  
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0); // Vertical camera position
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Selection State
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // AI & Settings
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Editor View Settings (Default True)
  const [showHitboxes, setShowHitboxes] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{x: number, y: number} | null>(null);

  // Sync initial hitbox state to level data if needed, or just rely on the prop passing in App
  useEffect(() => {
     // Ensure level data knows about the default hitbox state immediately
     if (level.showHitboxes !== showHitboxes) {
         onUpdateLevel({ ...level, showHitboxes });
     }
  }, []);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const floorY = canvas.height - 100;
    
    ctx.save();
    // Translate including scrollY for vertical movement
    ctx.translate(-scrollX, floorY - scrollY);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const startGridX = Math.floor(scrollX / TILE_SIZE);
    const endGridX = startGridX + Math.ceil(canvas.width / TILE_SIZE) + 1;
    
    // Vertical Lines
    for (let i = startGridX; i <= endGridX; i++) {
      ctx.beginPath();
      ctx.moveTo(i * TILE_SIZE, -2000 + scrollY); // Extend grid vertically
      ctx.lineTo(i * TILE_SIZE, 100 + scrollY);
      ctx.stroke();
    }
    // Horizontal Lines (Dynamic based on ScrollY)
    const startGridY = Math.floor((scrollY - 1000) / TILE_SIZE);
    const endGridY = Math.floor((scrollY + 1000) / TILE_SIZE);

    for (let i = startGridY; i < endGridY; i++) {
        ctx.beginPath();
        ctx.moveTo(scrollX, i * TILE_SIZE);
        ctx.lineTo(scrollX + canvas.width, i * TILE_SIZE);
        ctx.stroke();
    }

    // Floor
    ctx.fillStyle = 'rgba(79, 70, 229, 0.5)';
    ctx.fillRect(scrollX, 0, canvas.width, 100);
    ctx.fillStyle = 'white';
    ctx.fillRect(scrollX, 0, canvas.width, 2);

    // Classic Mode Limit Line
    if (level.gameMode === GameMode.CLASSIC) {
        const ceilLimitY = -(CEILING_HEIGHT * TILE_SIZE);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(scrollX, ceilLimitY);
        ctx.lineTo(scrollX + canvas.width, ceilLimitY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = '12px sans-serif';
        ctx.fillText("CLASSIC MODE CEILING", scrollX + 20, ceilLimitY - 5);
    }

    // Objects
    level.objects.forEach(obj => {
      const x = obj.x * TILE_SIZE;
      const y = -obj.y * TILE_SIZE;
      const cx = x + TILE_SIZE/2;
      const cy = y + TILE_SIZE/2;
      
      ctx.save();
      ctx.translate(cx, cy);
      if (obj.rotation) ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      // Highlight Selection
      if (obj.id === selectedObjectId) {
          ctx.shadowColor = 'white';
          ctx.shadowBlur = 15;
      }

      if (obj.type === EntityType.BLOCK) {
        ctx.fillStyle = COLOR_BLOCK;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        if (showHitboxes) {
             ctx.strokeStyle = 'red';
             ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      } else if (obj.type === EntityType.SPIKE) {
        ctx.fillStyle = COLOR_SPIKE;
        ctx.beginPath();
        ctx.moveTo(x, y + TILE_SIZE); 
        ctx.lineTo(x + TILE_SIZE / 2, y); 
        ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); 
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
          obj.type === EntityType.ORB_JUMP_PURPLE || 
          obj.type === EntityType.ORB_JUMP_RED || 
          obj.type === EntityType.ORB_GRAVITY
      ) {
          let color = COLOR_ORB_JUMP;
          if (obj.type === EntityType.ORB_GRAVITY) color = COLOR_ORB_GRAVITY;
          if (obj.type === EntityType.ORB_JUMP_PURPLE) color = COLOR_ORB_PURPLE;
          if (obj.type === EntityType.ORB_JUMP_RED) color = COLOR_ORB_RED;

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 28, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
          if (showHitboxes) {
             ctx.strokeStyle = 'yellow';
             ctx.beginPath();
             ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 32, 0, Math.PI*2);
             ctx.stroke();
          }
      } else if (
          obj.type === EntityType.PORTAL_GRAVITY ||
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

          ctx.fillStyle = pColor + '55';
          ctx.fillRect(x + 10, portalTop, 28, portalH);
          ctx.strokeStyle = pColor;
          ctx.strokeRect(x + 10, portalTop, 28, portalH);
          
          ctx.fillStyle = 'white'; // anchor dot or text
          if (obj.type === EntityType.PORTAL_GRAVITY) {
              ctx.fillRect(x + TILE_SIZE/2 - 2, y + TILE_SIZE/2 - 2, 4, 4);
          } else {
              ctx.font = 'bold 12px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(label, x + 24, portalTop + portalH/2);
          }

          if (showHitboxes) {
             ctx.strokeStyle = 'red';
             ctx.strokeRect(x + 15, portalTop, 18, portalH);
          }
      }

      ctx.restore();
    });

    // Render Test Trail
    if (testTrail && testTrail.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#22d3ee'; // Cyan
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        testTrail.forEach((pos, index) => {
            const drawX = pos.x + TILE_SIZE/2; 
            const drawY = pos.y - TILE_SIZE/2; // Use pos.y directly, accounting for player height offset
            
            if (index === 0) ctx.moveTo(drawX, drawY);
            else ctx.lineTo(drawX, drawY);
        });
        
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Render Death Marker
    if (deathPos) {
        const dX = deathPos.x + TILE_SIZE/2;
        const dY = deathPos.y - TILE_SIZE/2; 
        
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(dX - 15, dY - 15);
        ctx.lineTo(dX + 15, dY + 15);
        ctx.moveTo(dX + 15, dY - 15);
        ctx.lineTo(dX - 15, dY + 15);
        ctx.stroke();
    }

    ctx.restore();
  }, [level, scrollX, scrollY, selectedObjectId, showHitboxes, testTrail, deathPos]);

  const getGridPos = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return {x: 0, y: 0};
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (clientX - rect.left) * scaleX + scrollX;
    const clickY = (clientY - rect.top) * scaleY;
    const floorY = canvas.height - 100;
    // Adjust logic relative to scrollY
    const relativeY = clickY - (floorY - scrollY);

    const gridX = Math.floor(clickX / TILE_SIZE);
    const gridY = Math.floor(-relativeY / TILE_SIZE) + 1;
    return { gridX, gridY };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    const { gridX, gridY } = getGridPos(e.clientX, e.clientY);

    if (toolMode === 'EDIT') {
        const obj = level.objects.find(o => o.x === gridX && o.y === gridY);
        setSelectedObjectId(obj ? obj.id : null);
    } else if (toolMode === 'ERASE') {
        const newObjects = level.objects.filter(o => o.x !== gridX || o.y !== gridY);
        onUpdateLevel({ ...level, objects: newObjects });
    } else if (toolMode === 'DRAW') {
        placeBlock(gridX, gridY);
    }
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    
    const dx = e.clientX - (lastPointerRef.current?.x || 0);
    const dy = e.clientY - (lastPointerRef.current?.y || 0);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    const { gridX, gridY } = getGridPos(e.clientX, e.clientY);

    if (toolMode === 'PAN') {
        // Drag moves camera in both axes
        setScrollX(prev => Math.max(0, prev - dx * 2));
        // Drag Down (dy > 0) -> Pull world down -> See higher Y (more negative Y in canvas logic, but visually we go up)
        setScrollY(prev => prev - dy * 2);
    } else if (toolMode === 'DRAW') {
        placeBlock(gridX, gridY);
    } else if (toolMode === 'ERASE') {
        const newObjects = level.objects.filter(o => o.x !== gridX || o.y !== gridY);
        onUpdateLevel({ ...level, objects: newObjects });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      // In PAN mode, click does nothing (no placement).
      if (isDraggingRef.current && toolMode === 'DRAW') {
           // Ensure a click places a block if movement was minimal (handled by pointer down/move logic)
           // But redundancy ensures single click works well.
           const { gridX, gridY } = getGridPos(e.clientX, e.clientY);
           if(gridX >= 0 && gridY >= 1) placeBlock(gridX, gridY);
      }

      isDraggingRef.current = false;
      lastPointerRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const placeBlock = (x: number, y: number) => {
      if (x < 0 || y < 1) return;
      const filtered = level.objects.filter(o => o.x !== x || o.y !== y);
      const newObj: LevelObject = {
        id: `${Date.now()}-${Math.random()}`,
        type: selectedEntity,
        x, y, rotation: 0
      };
      onUpdateLevel({ ...level, objects: [...filtered, newObj] });
  };

  const rotateSelection = () => {
      if (!selectedObjectId) return;
      const newObjects = level.objects.map(obj => {
          if (obj.id === selectedObjectId) {
              return { ...obj, rotation: ((obj.rotation || 0) + 90) % 360 };
          }
          return obj;
      });
      onUpdateLevel({ ...level, objects: newObjects });
  };

  const handleSaveLevel = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(level));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "level.json";
    a.click();
  };

  const handleLoadLevel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const parsed = JSON.parse(ev.target?.result as string);
            onUpdateLevel(parsed);
        } catch (err) { alert("Invalid File"); }
    };
    reader.readAsText(file);
  };
  
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdateLevel({ ...level, musicUrl: url });
    }
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const generatedObjects = await generateLevelAI(prompt, level.length);
      onUpdateLevel({ ...level, objects: [...level.objects, ...generatedObjects] });
      setShowAiModal(false); setPrompt('');
    } catch (e) { alert("AI Error"); } finally { setIsGenerating(false); }
  };
  
  const toggleHitboxes = () => {
      const newVal = !showHitboxes;
      setShowHitboxes(newVal);
      onUpdateLevel({ ...level, showHitboxes: newVal } as any);
  };

  const handleClearLevel = () => {
      onUpdateLevel({ ...level, objects: [] });
      setShowClearConfirm(false);
      setShowSettings(false);
  };

  const handleTestPlay = () => {
      // Calculate level duration/length based on objects
      // Speed is approx 9px/frame * 60fps = 540px/s. 
      // 2 seconds = 1080px.
      // TILE_SIZE = 48.
      // 1080 / 48 = ~22.5 tiles.
      // We set length to (Last Object X) + 23.
      
      const lastObjectX = level.objects.reduce((max, obj) => Math.max(max, obj.x), 0);
      const buffer = 23; 
      const newLength = Math.max(50, lastObjectX + buffer); // Ensure min length

      onUpdateLevel({ ...level, length: newLength, showHitboxes });
      onPlay();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 select-none">
      
      {/* Top Bar */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 z-10">
          <div className="flex items-center space-x-2">
              <button onClick={onExit} className="p-2 bg-red-600 hover:bg-red-500 rounded text-white mr-2" title="Exit to Menu"><X size={18}/></button>
              
              <button onClick={handleTestPlay} className="px-6 py-1.5 bg-green-500 hover:bg-green-400 text-black font-black rounded-md flex items-center shadow-lg shadow-green-900/20">
                  <Play size={18} className="mr-2 fill-current"/> TEST
              </button>
              <button onClick={() => setShowAiModal(true)} className="p-2 bg-purple-600 hover:bg-purple-500 rounded text-white"><Wand2 size={18}/></button>
          </div>
          
          <div className="flex items-center space-x-2">
              <button onClick={() => musicInputRef.current?.click()} className="p-2 text-pink-400 hover:text-pink-300" title="Upload Custom Music"><Music size={20}/></button>
              <input type="file" ref={musicInputRef} className="hidden" accept="audio/*" onChange={handleMusicUpload}/>

              <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-slate-400 hover:text-white"><Settings size={20}/></button>
              <button onClick={handleSaveLevel} className="p-2 text-blue-400 hover:text-blue-300"><Save size={20}/></button>
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-green-400 hover:text-green-300"><Upload size={20}/></button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleLoadLevel}/>
          </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative overflow-hidden flex">
          
          {/* Canvas */}
          <div className="flex-1 relative bg-slate-950">
               <canvas 
                    ref={canvasRef} 
                    width={1200} 
                    height={675} 
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className="absolute top-0 left-0 w-full h-full touch-none"
                    style={{ cursor: toolMode === 'PAN' ? 'move' : 'crosshair' }}
                />
               
               {/* Context Menu / Floating Tools */}
               <div className="absolute top-4 right-4 flex flex-col space-y-2">
                   <button 
                        onClick={() => setToolMode('PAN')} 
                        className={`p-3 rounded-lg shadow-xl border ${toolMode === 'PAN' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                        title="Move Camera (Drag)"
                   >
                       <Move size={20} />
                   </button>
                   
                   <button 
                        onClick={() => setToolMode('DRAW')} 
                        className={`p-3 rounded-lg shadow-xl border ${toolMode === 'DRAW' ? 'bg-pink-600 border-pink-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                        title="Draw Blocks (Click or Drag)"
                   >
                       <Pencil size={20} />
                   </button>

                   <button 
                        onClick={() => setToolMode('EDIT')} 
                        className={`p-3 rounded-lg shadow-xl border ${toolMode === 'EDIT' ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                   >
                       <MousePointer2 size={20} />
                   </button>
                   
                   <button 
                        onClick={() => setToolMode('ERASE')} 
                        className={`p-3 rounded-lg shadow-xl border ${toolMode === 'ERASE' ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                   >
                       <Eraser size={20} />
                   </button>

                   {toolMode === 'EDIT' && selectedObjectId && (
                       <button 
                            onClick={rotateSelection} 
                            className="p-3 rounded-lg shadow-xl bg-amber-500 text-black font-bold border border-amber-400 animate-pulse"
                       >
                           <RefreshCw size={20} />
                       </button>
                   )}
               </div>
          </div>
      </div>

      {/* Bottom Palette */}
      <div className="h-32 bg-slate-900 border-t border-slate-700 flex flex-col">
          <div className="flex px-4 border-b border-slate-700">
              <button onClick={() => setActiveTab('BLOCKS')} className={`px-4 py-2 text-sm font-bold ${activeTab === 'BLOCKS' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500'}`}>BLOCKS</button>
              <button onClick={() => setActiveTab('TRAPS')} className={`px-4 py-2 text-sm font-bold ${activeTab === 'TRAPS' ? 'text-red-400 border-b-2 border-red-400' : 'text-slate-500'}`}>TRAPS</button>
              <button onClick={() => setActiveTab('ORBS')} className={`px-4 py-2 text-sm font-bold ${activeTab === 'ORBS' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-slate-500'}`}>ORBS</button>
              <button onClick={() => setActiveTab('SPEED')} className={`px-4 py-2 text-sm font-bold ${activeTab === 'SPEED' ? 'text-green-400 border-b-2 border-green-400' : 'text-slate-500'}`}>SPEED</button>
          </div>
          <div className="flex-1 p-3 overflow-x-auto flex space-x-3 items-center">
              {activeTab === 'BLOCKS' && (
                  <button onClick={() => { setSelectedEntity(EntityType.BLOCK); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.BLOCK ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600'}`}>
                      <div className="w-10 h-10 bg-blue-500 border border-white"></div>
                  </button>
              )}
              {activeTab === 'TRAPS' && (
                  <>
                    <button onClick={() => { setSelectedEntity(EntityType.SPIKE); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.SPIKE ? 'border-red-500 bg-red-500/20' : 'border-slate-600'}`}>
                        <div className="w-0 h-0 border-x-8 border-x-transparent border-b-[16px] border-b-red-500"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.HALF_SPIKE); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.HALF_SPIKE ? 'border-red-500 bg-red-500/20' : 'border-slate-600'}`}>
                        <div className="w-0 h-0 border-x-8 border-x-transparent border-b-[8px] border-b-red-500 mt-2"></div>
                    </button>
                  </>
              )}
              {activeTab === 'ORBS' && (
                  <>
                    <button onClick={() => { setSelectedEntity(EntityType.ORB_JUMP); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.ORB_JUMP ? 'border-yellow-500 bg-yellow-500/20' : 'border-slate-600'}`}>
                        <div className="w-8 h-8 rounded-full bg-yellow-400 border-2 border-white"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.ORB_JUMP_PURPLE); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.ORB_JUMP_PURPLE ? 'border-purple-500 bg-purple-500/20' : 'border-slate-600'}`}>
                        <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.ORB_JUMP_RED); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.ORB_JUMP_RED ? 'border-red-500 bg-red-500/20' : 'border-slate-600'}`}>
                        <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-white"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.ORB_GRAVITY); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.ORB_GRAVITY ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600'}`}>
                        <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.PORTAL_GRAVITY); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex items-center justify-center ${selectedEntity === EntityType.PORTAL_GRAVITY ? 'border-green-500 bg-green-500/20' : 'border-slate-600'}`}>
                        <div className="w-6 h-10 bg-green-500/50 border border-green-400"></div>
                    </button>
                  </>
              )}
              {activeTab === 'SPEED' && (
                  <>
                    <button onClick={() => { setSelectedEntity(EntityType.PORTAL_SPEED_SLOW); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex flex-col items-center justify-center ${selectedEntity === EntityType.PORTAL_SPEED_SLOW ? 'border-orange-500 bg-orange-500/20' : 'border-slate-600'}`} title="Slow (0.8x)">
                        <div className="text-orange-500 font-bold text-xs">0.8x</div>
                        <div className="w-6 h-8 border-2 border-orange-500 mt-1"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.PORTAL_SPEED_NORMAL); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex flex-col items-center justify-center ${selectedEntity === EntityType.PORTAL_SPEED_NORMAL ? 'border-green-500 bg-green-500/20' : 'border-slate-600'}`} title="Normal (1x)">
                        <div className="text-green-500 font-bold text-xs">1.0x</div>
                        <div className="w-6 h-8 border-2 border-green-500 mt-1"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.PORTAL_SPEED_FAST); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex flex-col items-center justify-center ${selectedEntity === EntityType.PORTAL_SPEED_FAST ? 'border-pink-500 bg-pink-500/20' : 'border-slate-600'}`} title="Fast (1.2x)">
                        <div className="text-pink-500 font-bold text-xs">1.2x</div>
                        <div className="w-6 h-8 border-2 border-pink-500 mt-1"></div>
                    </button>
                    <button onClick={() => { setSelectedEntity(EntityType.PORTAL_SPEED_VERY_FAST); setToolMode('DRAW'); }} className={`w-16 h-16 border rounded flex flex-col items-center justify-center ${selectedEntity === EntityType.PORTAL_SPEED_VERY_FAST ? 'border-red-500 bg-red-500/20' : 'border-slate-600'}`} title="Very Fast (1.4x)">
                        <div className="text-red-500 font-bold text-xs">1.4x</div>
                        <div className="w-6 h-8 border-2 border-red-500 mt-1"></div>
                    </button>
                  </>
              )}
          </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="bg-slate-800 p-6 rounded-lg w-80 shadow-2xl border border-slate-700">
                  <h3 className="text-white font-bold mb-4 flex items-center"><Settings size={20} className="mr-2"/> Level Settings</h3>
                  <div className="mb-4 space-y-4">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1">Game Mode</label>
                        <select 
                            value={level.gameMode} 
                            onChange={(e) => onUpdateLevel({...level, gameMode: e.target.value as GameMode})}
                            className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        >
                            <option value={GameMode.CLASSIC}>Classic (Fixed Camera)</option>
                            <option value={GameMode.FREE}>Free Mode (Camera Y)</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                          <input 
                              type="checkbox" 
                              checked={showHitboxes} 
                              onChange={toggleHitboxes}
                              id="checkHitbox"
                              className="w-4 h-4 accent-blue-500"
                          />
                          <label htmlFor="checkHitbox" className="text-white text-sm select-none cursor-pointer">Show Hitboxes (Debug)</label>
                      </div>
                      
                      <div className="border-t border-slate-700 pt-4 mt-2">
                           <button 
                                onClick={() => setShowClearConfirm(true)}
                                className="w-full py-2 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white border border-red-800/50 hover:border-red-500 rounded flex items-center justify-center font-bold transition-all text-sm"
                           >
                                <Trash2 size={16} className="mr-2"/> CLEAR LEVEL
                           </button>
                      </div>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold">Close</button>
              </div>
          </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
             <div className="bg-slate-800 p-6 rounded-lg w-80 text-center border border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in zoom-in-95 duration-200">
                  <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">ARE YOU SURE?</h3>
                  <p className="text-slate-400 text-sm mb-6">This will delete all objects in the level. This action cannot be undone.</p>
                  <div className="flex space-x-3">
                      <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 font-bold">Cancel</button>
                      <button onClick={handleClearLevel} className="flex-1 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-500 shadow-lg shadow-red-900/50">YES, CLEAR</button>
                  </div>
             </div>
        </div>
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 p-6 rounded-xl w-full max-w-lg shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">AI Architect</h3>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe segment (e.g. 'Hard staircase with spikes')..." className="w-full h-32 bg-slate-900 rounded p-3 text-white mb-4" />
                <div className="flex justify-end space-x-3">
                    <button onClick={() => setShowAiModal(false)} className="text-slate-400">Cancel</button>
                    <button onClick={handleAiGenerate} disabled={isGenerating || !prompt} className="px-4 py-2 bg-purple-600 rounded text-white">{isGenerating ? 'Generating...' : 'Generate'}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default LevelEditor;