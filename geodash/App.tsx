import React, { useState } from 'react';
import GameRunner from './components/GameRunner';
import LevelEditor from './components/LevelEditor';
import { GameState, LevelData, Vector2 } from './types';
import { DEFAULT_LEVEL } from './constants';
import { Play, Edit, RotateCcw, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [levelData, setLevelData] = useState<LevelData>(DEFAULT_LEVEL);
  const [key, setKey] = useState(0); 
  
  // Editor Testing State
  const [testTrail, setTestTrail] = useState<Vector2[]>([]);
  const [deathPos, setDeathPos] = useState<Vector2 | null>(null);

  const startProcedural = () => {
    setGameState(GameState.PLAYING);
    setKey(prev => prev + 1);
  };

  const startEditorTest = () => {
      // Clear previous test data when starting new test
      setTestTrail([]);
      setDeathPos(null);
      setGameState(GameState.TESTING);
      setKey(prev => prev + 1);
  }

  const handleDie = () => {
    // Standard game over for procedural mode
    if (gameState === GameState.PLAYING) {
        setGameState(GameState.GAME_OVER);
    }
  };

  const handleWin = () => {
    // Standard win for procedural mode
    if (gameState === GameState.PLAYING) {
        setGameState(GameState.WON);
    }
  };

  const handleTestComplete = (trail: Vector2[], deathPosition: Vector2 | null) => {
      setTestTrail(trail);
      setDeathPos(deathPosition);
      setGameState(GameState.EDITOR); // Instant return to editor
  };

  const retry = (targetState: GameState) => {
      setGameState(targetState);
      setKey(prev => prev + 1);
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden select-none">
      
      <div className="relative w-full max-w-[1200px] aspect-[16/9] bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
        
        {/* Game Render Layer */}
        {(gameState === GameState.PLAYING || gameState === GameState.TESTING || gameState === GameState.GAME_OVER || gameState === GameState.WON) && (
             <div className="absolute inset-0">
                {(gameState === GameState.PLAYING || gameState === GameState.TESTING) && (
                    <GameRunner 
                        key={key} 
                        level={levelData} 
                        isActive={true} 
                        isProcedural={gameState === GameState.PLAYING}
                        isTestMode={gameState === GameState.TESTING}
                        showHitboxes={gameState === GameState.TESTING ? levelData.showHitboxes : false} // Pass setting if implemented in LevelData, or we can use a prop
                        onDie={handleDie}
                        onWin={handleWin}
                        onTestComplete={handleTestComplete}
                    />
                )}
             </div>
        )}

        {/* Editor Layer */}
        {gameState === GameState.EDITOR && (
            <div className="absolute inset-0">
                <LevelEditor 
                    level={levelData} 
                    onUpdateLevel={setLevelData} 
                    onPlay={startEditorTest} 
                    onExit={() => setGameState(GameState.MENU)}
                    testTrail={testTrail}
                    deathPos={deathPos}
                />
            </div>
        )}

        {/* Main Menu */}
        {gameState === GameState.MENU && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[url('https://picsum.photos/1200/800?blur=5')] bg-cover bg-center">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
                <div className="relative z-10 text-center animate-fade-in-up">
                    <h1 className="text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-8 drop-shadow-2xl">
                        GEODASH
                    </h1>
                    
                    <div className="flex space-x-6 justify-center">
                        <button onClick={startProcedural} className="group relative px-8 py-4 bg-green-500 hover:bg-green-400 rounded-lg font-black text-2xl shadow-[0_6px_0_rgb(21,128,61)] transition-all active:translate-y-2 active:shadow-none">
                            <span className="flex items-center text-slate-900"><Play size={32} className="mr-3 fill-current" /> PLAY</span>
                        </button>

                        <button onClick={() => setGameState(GameState.EDITOR)} className="group relative px-8 py-4 bg-blue-500 hover:bg-blue-400 rounded-lg font-black text-2xl shadow-[0_6px_0_rgb(29,78,216)] transition-all active:translate-y-2 active:shadow-none">
                            <span className="flex items-center text-white"><Edit size={32} className="mr-3" /> EDITOR</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Game Over Screen (Only for Procedural) */}
        {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                 <div className="text-center">
                     <AlertTriangle size={80} className="mx-auto text-red-500 mb-4 animate-bounce" />
                     <h2 className="text-5xl font-black text-white mb-2">CRASHED!</h2>
                     <div className="flex space-x-4 justify-center mt-8">
                        <button onClick={() => retry(GameState.PLAYING)} className="px-6 py-3 bg-green-600 rounded font-bold hover:scale-105 transition-transform">Retry Procedural</button>
                        <button onClick={() => setGameState(GameState.MENU)} className="px-6 py-3 bg-slate-800 rounded font-bold hover:scale-105 transition-transform">Menu</button>
                     </div>
                 </div>
            </div>
        )}

        {/* Win Screen (Only for Procedural) */}
        {gameState === GameState.WON && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-900/90 backdrop-blur-md z-50">
                 <div className="text-center">
                     <h2 className="text-6xl font-black text-yellow-400 mb-6">COMPLETE!</h2>
                     <button onClick={() => setGameState(GameState.MENU)} className="px-8 py-3 bg-white text-black font-bold rounded hover:scale-105 transition-transform">Menu</button>
                 </div>
            </div>
        )}

        {/* In-Game Exit */}
        {(gameState === GameState.PLAYING || gameState === GameState.TESTING) && (
            <button onClick={() => setGameState(GameState.MENU)} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-red-600 rounded text-white z-40">EXIT</button>
        )}

      </div>
      <div className="mt-4 text-slate-500 text-sm">Use Editor to generate levels with AI • Supports Music Upload</div>
    </div>
  );
};

export default App;