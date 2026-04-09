import { useEffect, useRef, useState, useCallback } from "react";
import { GameEngine } from "@/game/GameEngine";
import { InputHandler } from "@/game/InputHandler";
import { AudioManager } from "@/game/AudioManager";
import { SaveManager } from "@/game/SaveManager";
import { GestureController } from "@/game/GestureController";
import { GameState, Choice, ENCOUNTERS, WeatherType, TRADING_POSTS, DifficultyLevel, DIFFICULTY_CONFIGS, DifficultyConfig } from "@/game/types";
import { GameHUD } from "./GameHUD";
import { EncounterOverlay } from "./EncounterOverlay";
import { ControlsGuide } from "./ControlsGuide";
import { GameOverScreen } from "./GameOverScreen";
import { StartScreen } from "./StartScreen";

const INITIAL_STATE: GameState = {
  supplies: 100,
  maxSupplies: 100,
  health: 100,
  maxHealth: 100,
  distance: 0,
  speed: 0,
  maxSpeed: 2.5,
  money: 50,
  isPaused: true,
  isGameOver: false,
  isEncounterActive: false,
  currentEncounter: null,
  timeOfDay: 8,
  weather: 'clear',
  weatherIntensity: 0,
  isTrading: false,
  tradingPost: null,
};

const WEATHER_CYCLE: WeatherType[] = ['clear', 'clear', 'dusty', 'clear', 'windy', 'clear', 'sandstorm', 'clear'];

export const CaravansGame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputHandler | null>(null);
  const gestureRef = useRef<GestureController | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const scoreUiTickRef = useRef<number>(0);
  const smoothedInputRef = useRef({
    steering: 0,
    throttle: 0,
    brake: 0,
    handDetected: false,
    motionStopped: false,
    handGraceTimer: 0,
  });
  const encounterCooldownRef = useRef<number>(0);
  const weatherCooldownRef = useRef<number>(0);
  const tradingCooldownRef = useRef<number>(0);
  const hasStartedRef = useRef<boolean>(false);
  const isGameOverRef = useRef<boolean>(false);
  const gameStateRef = useRef<GameState>(INITIAL_STATE);

  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [hasStarted, setHasStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<"supplies" | "health">("supplies");
  const [showPickupEffect, setShowPickupEffect] = useState<{ type: string; value: number } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGo, setShowGo] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [score, setScore] = useState(0);
  const [gestureStatus, setGestureStatus] = useState("Allow webcam access to enable hand controls.");
  const [handDetected, setHandDetected] = useState(false);
  const [gestureFps, setGestureFps] = useState(0);
  const [movementStatus, setMovementStatus] = useState<"Moving" | "Stopped">("Moving");
  const difficultyConfigRef = useRef<DifficultyConfig>(DIFFICULTY_CONFIGS.medium);

  // Keep refs in sync with state
  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const getRandomEncounter = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * ENCOUNTERS.length);
    return ENCOUNTERS[randomIndex];
  }, []);

  const getRandomTradingPost = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * TRADING_POSTS.length);
    return TRADING_POSTS[randomIndex];
  }, []);

  const handleCrossroadReached = useCallback(() => {
    if (encounterCooldownRef.current > 0) return;

    encounterCooldownRef.current = 5;

    // 25% chance of trading post, 75% chance of encounter
    if (Math.random() < 0.25 && tradingCooldownRef.current <= 0) {
      tradingCooldownRef.current = 30;
      setGameState((prev) => ({
        ...prev,
        isPaused: true,
        isTrading: true,
        tradingPost: getRandomTradingPost(),
      }));
    } else {
      setGameState((prev) => ({
        ...prev,
        isPaused: true,
        isEncounterActive: true,
        currentEncounter: getRandomEncounter(),
      }));
    }
  }, [getRandomEncounter, getRandomTradingPost]);

  const handleChoice = useCallback((choice: Choice) => {
    setGameState((prev) => {
      const newSupplies = Math.max(0, Math.min(prev.maxSupplies, prev.supplies + choice.outcome.suppliesChange));
      const newHealth = Math.max(0, Math.min(prev.maxHealth, prev.health + choice.outcome.healthChange));
      const newMoney = Math.max(0, prev.money + (choice.outcome.moneyChange || 0));

      return {
        ...prev,
        supplies: newSupplies,
        health: newHealth,
        money: newMoney,
        isPaused: false,
        isEncounterActive: false,
        currentEncounter: null,
      };
    });
  }, []);

  const handleTrade = useCallback((itemId: string, cost: number, type: string, value: number) => {
    setGameState((prev) => {
      if (prev.money < cost) return prev;

      let newSupplies = prev.supplies;
      let newHealth = prev.health;

      if (type === 'supplies') {
        newSupplies = Math.min(prev.maxSupplies, prev.supplies + value);
      } else if (type === 'health') {
        newHealth = Math.min(prev.maxHealth, prev.health + value);
      }

      audioRef.current?.playPickupSound();

      return {
        ...prev,
        supplies: newSupplies,
        health: newHealth,
        money: prev.money - cost,
      };
    });
  }, []);

  const handleCloseTrading = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      isPaused: false,
      isTrading: false,
      tradingPost: null,
    }));
  }, []);

  const handleStart = useCallback((selectedDifficulty: DifficultyLevel) => {
    const config = DIFFICULTY_CONFIGS[selectedDifficulty];
    setDifficulty(selectedDifficulty);
    difficultyConfigRef.current = config;
    
    // Set initial state based on difficulty
    setGameState((prev) => ({
      ...prev,
      supplies: config.startingFuel,
      health: config.startingHealth,
      money: config.startingMoney,
    }));
    
    // Apply difficulty to engine
    if (engineRef.current) {
      engineRef.current.setDifficulty(config);
    }
    
    setHasStarted(true);
    setMovementStatus("Moving");
    audioRef.current?.initialize();
    
    // Start countdown sequence
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowGo(true);
          setGameState((prevState) => ({ ...prevState, isPaused: false }));
          setTimeout(() => setShowGo(false), 800);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleRestart = useCallback(() => {
    setGameState(INITIAL_STATE);
    setIsGameOver(false);
    setHasStarted(false);
    setDifficulty('medium');
    setScore(0);
    scoreRef.current = 0;
    scoreUiTickRef.current = 0;
    setMovementStatus("Moving");
    encounterCooldownRef.current = 0;
    weatherCooldownRef.current = 0;
    tradingCooldownRef.current = 0;
    
    // Reset engine difficulty
    if (engineRef.current) {
      engineRef.current.reset();
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    engineRef.current = new GameEngine(containerRef.current);
    inputRef.current = new InputHandler(true);
    audioRef.current = new AudioManager();

    if (webcamVideoRef.current && webcamOverlayRef.current) {
      gestureRef.current = new GestureController(
        webcamVideoRef.current,
        webcamOverlayRef.current,
        (frame) => {
          inputRef.current?.setGestureState({
            steering: frame.steering,
            throttle: frame.throttle,
            brake: frame.brake,
            handDetected: frame.handDetected,
            motionStopped: frame.motionStopped,
          });
          setHandDetected(frame.handDetected);
          setMovementStatus(frame.motionStopped ? "Stopped" : "Moving");
        },
        (statusMessage) => setGestureStatus(statusMessage),
        (fps) => setGestureFps(fps),
      );

      gestureRef.current.initialize().catch((error) => {
        setGestureStatus(`Camera error: ${error instanceof Error ? error.message : "unable to start hand tracking"}`);
      });
    }

    engineRef.current.onCrossroadReached = handleCrossroadReached;
    
    engineRef.current.onObstacleHit = (damage: number) => {
      audioRef.current?.playCollisionSound();
      setGameState((prev) => ({
        ...prev,
        health: Math.max(0, prev.health - damage),
      }));
    };

    engineRef.current.onSupplyCollected = (type: string, value: number) => {
      // Play appropriate sound based on collectible type
      switch (type) {
        case 'coin':
        case 'goldCoin':
          audioRef.current?.playCoinSound();
          break;
        case 'diamond':
        case 'gem':
        case 'ruby':
        case 'emerald':
          audioRef.current?.playGemSound();
          break;
        default:
          audioRef.current?.playPickupSound();
      }
      
      setShowPickupEffect({ type, value });
      setTimeout(() => setShowPickupEffect(null), 1000);
      
      setGameState((prev) => {
        let newState = { ...prev };
        switch (type) {
          case 'fuel':
          case 'supplies':
            newState.supplies = Math.min(prev.maxSupplies, prev.supplies + value);
            break;
          case 'health':
            newState.health = Math.min(prev.maxHealth, prev.health + value);
            break;
          case 'money':
          case 'coin':
          case 'goldCoin':
          case 'diamond':
          case 'gem':
          case 'ruby':
          case 'emerald':
            newState.money = prev.money + value;
            break;
        }
        return newState;
      });
    };

    const gameLoop = (currentTime: number) => {
      if (!engineRef.current || !inputRef.current) return;

      const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = currentTime;

      const clampedDelta = Math.min(deltaTime, 0.1);

      // Use ref values for current state
      const currentGameState = gameStateRef.current;
      const started = hasStartedRef.current;

      if (currentGameState.isPaused || !started) {
        engineRef.current?.update(clampedDelta, 0, 0, true);
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const input = inputRef.current!.getState();
      const smooth = smoothedInputRef.current;

      const steeringAlpha = 1 - Math.exp(-clampedDelta * 12);
      const throttleAlpha = 1 - Math.exp(-clampedDelta * 10);
      const brakeAlpha = 1 - Math.exp(-clampedDelta * 14);

      smooth.motionStopped = input.motionStopped;
      if (input.handDetected) {
        smooth.handDetected = true;
        smooth.handGraceTimer = 0;
        smooth.steering += (input.steering - smooth.steering) * steeringAlpha;
        smooth.throttle += (input.throttle - smooth.throttle) * throttleAlpha;
        smooth.brake += (input.brake - smooth.brake) * brakeAlpha;
      } else if (smooth.handDetected && smooth.handGraceTimer < 0.2) {
        // Keep controls briefly when tracking flickers to avoid jerky speed/steering.
        smooth.handGraceTimer += clampedDelta;
        smooth.steering *= 0.95;
        smooth.throttle *= 0.97;
        smooth.brake *= 0.9;
      } else {
        smooth.handDetected = false;
        smooth.handGraceTimer = 0;
        smooth.steering += (input.steering - smooth.steering) * steeringAlpha;
        smooth.throttle += (input.throttle - smooth.throttle) * throttleAlpha;
        smooth.brake += (input.brake - smooth.brake) * brakeAlpha;
      }

      // Calculate base speed (without weather effects)
      let baseSpeed = currentGameState.speed;
      if (smooth.motionStopped) {
        baseSpeed = Math.max(0, baseSpeed - clampedDelta * 3);
      } else {
        const minCruiseThrottle = smooth.handDetected ? 0.12 : 0;
        const effectiveThrottle = Math.max(minCruiseThrottle, smooth.throttle);
        baseSpeed = Math.min(currentGameState.maxSpeed, baseSpeed + clampedDelta * 1.3 * effectiveThrottle);
        baseSpeed = Math.max(0, baseSpeed - clampedDelta * 1.8 * smooth.brake);
        if (smooth.handDetected && smooth.throttle <= 0.01 && smooth.brake <= 0.01) {
          baseSpeed = Math.max(currentGameState.maxSpeed * 0.22, baseSpeed);
        }
        baseSpeed = Math.max(0, baseSpeed - clampedDelta * 0.25);
      }

      // Apply weather effects to effective speed (don't save this to state!)
      let effectiveSpeed = baseSpeed;
      if (currentGameState.weather === 'sandstorm') {
        effectiveSpeed *= 0.7;
      } else if (currentGameState.weather === 'windy') {
        effectiveSpeed *= 0.9;
      }

      let steering = smooth.steering;
      if (input.left) steering = -1;
      else if (input.right) steering = 1;

      const result = engineRef.current!.update(clampedDelta, effectiveSpeed, steering, false);

      // Update audio
      audioRef.current?.updateSpeed(effectiveSpeed, currentGameState.maxSpeed);
      audioRef.current?.updateWeather(currentGameState.weather, currentGameState.weatherIntensity);

      // Update supplies drain (based on speed and weather)
      let drainMultiplier = 1;
      if (currentGameState.weather === 'sandstorm') drainMultiplier = 1.5;
      else if (currentGameState.weather === 'dusty') drainMultiplier = 1.2;
      
      // Apply difficulty fuel consumption multiplier
      const fuelConsumptionMultiplier = difficultyConfigRef.current.fuelConsumption;
      const suppliesDrain = clampedDelta * (0.5 + effectiveSpeed * 2) * drainMultiplier * fuelConsumptionMultiplier;
      const newSupplies = Math.max(0, currentGameState.supplies - suppliesDrain);

      // Update time of day
      let newTimeOfDay = currentGameState.timeOfDay + clampedDelta * 0.1;
      if (newTimeOfDay >= 24) newTimeOfDay -= 24;
      engineRef.current?.updateTimeOfDay(newTimeOfDay);

      // Update weather periodically
      let newWeather = currentGameState.weather;
      let newWeatherIntensity = currentGameState.weatherIntensity;
      weatherCooldownRef.current -= result.movement;
      
      if (weatherCooldownRef.current <= 0) {
        const weatherIndex = Math.floor(Math.random() * WEATHER_CYCLE.length);
        newWeather = WEATHER_CYCLE[weatherIndex];
        newWeatherIntensity = 0.3 + Math.random() * 0.7;
        weatherCooldownRef.current = 200 + Math.random() * 300;
        engineRef.current?.updateWeather(newWeather, newWeatherIntensity);
      }

      // Update cooldowns
      if (encounterCooldownRef.current > 0) {
        encounterCooldownRef.current -= result.movement;
      }
      if (tradingCooldownRef.current > 0) {
        tradingCooldownRef.current -= result.movement;
      }

      if (!input.motionStopped && baseSpeed > 0.05) {
        scoreRef.current += clampedDelta * 12 * difficultyConfigRef.current.scoreMultiplier;
      }
      scoreUiTickRef.current += clampedDelta;
      if (scoreUiTickRef.current >= 0.2) {
        setScore(Math.round(scoreRef.current));
        scoreUiTickRef.current = 0;
      }

      // Check game over conditions
      if (newSupplies <= 0 && !isGameOverRef.current) {
        setIsGameOver(true);
        setGameOverReason("supplies");
        audioRef.current?.playGameOverSound();
        SaveManager.saveScore("Player", currentGameState.distance + result.movement * 0.1, currentGameState.money);
      }
      if (currentGameState.health <= 0 && !isGameOverRef.current) {
        setIsGameOver(true);
        setGameOverReason("health");
        audioRef.current?.playGameOverSound();
        SaveManager.saveScore("Player", currentGameState.distance + result.movement * 0.1, currentGameState.money);
      }

      setGameState((prev) => ({
        ...prev,
        speed: baseSpeed,  // Save base speed, not weather-affected speed
        supplies: newSupplies,
        distance: prev.distance + result.movement * 0.1,
        timeOfDay: newTimeOfDay,
        weather: newWeather,
        weatherIntensity: newWeatherIntensity,
      }));

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
      gestureRef.current?.dispose();
      engineRef.current?.dispose();
      inputRef.current?.dispose();
      audioRef.current?.dispose();
    };
  }, [handleCrossroadReached]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Pickup Effect */}
      {showPickupEffect && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none animate-bounce">
          <div className={`text-2xl font-bold px-4 py-2 rounded-lg ${
            showPickupEffect.type === 'health' ? 'bg-red-500/80 text-white' :
            showPickupEffect.type === 'money' ? 'bg-green-500/80 text-white' :
            'bg-blue-500/80 text-white'
          }`}>
            +{showPickupEffect.value} {showPickupEffect.type.charAt(0).toUpperCase() + showPickupEffect.type.slice(1)}
          </div>
        </div>
      )}

      {/* Weather Overlay */}
      {gameState.weather === 'sandstorm' && hasStarted && (
        <div 
          className="absolute inset-0 pointer-events-none z-5"
          style={{
            background: `rgba(180, 140, 100, ${0.1 + gameState.weatherIntensity * 0.2})`,
          }}
        />
      )}

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div 
            key={countdown}
            className="text-9xl font-display font-bold text-white animate-pulse"
            style={{
              textShadow: '0 0 40px rgba(255, 200, 100, 0.8), 0 0 80px rgba(255, 150, 50, 0.5)',
              animation: 'countdown-pop 0.5s ease-out'
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* GO! Overlay */}
      {showGo && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div 
            className="text-9xl font-display font-bold text-green-400"
            style={{
              textShadow: '0 0 40px rgba(100, 255, 100, 0.8), 0 0 80px rgba(50, 255, 50, 0.5)',
              animation: 'countdown-pop 0.5s ease-out'
            }}
          >
            GO!
          </div>
        </div>
      )}

      {/* Start Screen */}
      {!hasStarted && !isGameOver && <StartScreen onStart={handleStart} />}

      {/* Game HUD */}
      {hasStarted && !isGameOver && (
        <GameHUD
          gameState={gameState}
          difficulty={difficulty}
          score={score}
          status={gameState.isPaused ? "Stopped" : movementStatus}
        />
      )}

      {/* Controls Guide */}
      {hasStarted && !gameState.isEncounterActive && !gameState.isTrading && !isGameOver && <ControlsGuide />}

      <div className="absolute right-5 bottom-5 z-20 w-64 rounded-xl border border-border bg-card/85 backdrop-blur-sm shadow-xl p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Webcam Hand Tracking</span>
          <span>{gestureFps > 0 ? `${gestureFps} FPS` : "..."}</span>
        </div>
        <div className="relative w-full aspect-[4/3] bg-black/70 rounded-md overflow-hidden">
          <video ref={webcamVideoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" muted playsInline />
          <canvas ref={webcamOverlayRef} className="absolute inset-0 w-full h-full scale-x-[-1]" />
        </div>
        <div className="mt-2 text-xs">
          <div className={handDetected ? "text-green-400" : "text-yellow-400"}>
            {handDetected ? "Hand detected" : "No hand detected"}
          </div>
          <div className={movementStatus === "Moving" ? "text-green-400" : "text-red-400"}>
            {movementStatus}
          </div>
          <div className="text-muted-foreground truncate">{gestureStatus}</div>
        </div>
      </div>

      {/* Encounter Overlay */}
      {gameState.isEncounterActive && gameState.currentEncounter && (
        <EncounterOverlay
          encounter={gameState.currentEncounter}
          onChoice={handleChoice}
        />
      )}

      {/* Trading Overlay */}
      {gameState.isTrading && gameState.tradingPost && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20 animate-fade-in">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-6 shadow-xl">
            <h2 className="font-display text-2xl text-primary mb-2">{gameState.tradingPost.name}</h2>
            <p className="text-muted-foreground mb-4">Your money: ${gameState.money}</p>
            
            <div className="space-y-3 mb-6">
              {gameState.tradingPost.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-secondary/50 p-3 rounded-lg">
                  <div>
                    <div className="font-semibold text-foreground">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  <button
                    onClick={() => handleTrade(item.id, item.cost, item.type, item.value)}
                    disabled={gameState.money < item.cost}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      gameState.money >= item.cost
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    ${item.cost}
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleCloseTrading}
              className="w-full py-3 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-all"
            >
              Continue Journey
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {isGameOver && (
        <GameOverScreen
          distance={gameState.distance}
          reason={gameOverReason}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
};
