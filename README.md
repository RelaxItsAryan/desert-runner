# Desert Runner

Fast-paced 3D endless runner set in a harsh desert world. Drive as far as you can, dodge obstacles, collect resources, survive weather shifts, and make high-stakes choices at crossroads.

Live demo: https://desert-runner-still-loading.netlify.app/

## Overview

Desert Runner is a browser game built with React, TypeScript, and Three.js.

Core gameplay pillars:
- Endless driving with increasing pressure
- Resource management (fuel, health, money)
- Dynamic weather and day-night cycle
- Encounter and trading systems at crossroads
- Multiple difficulty presets with score multipliers
- Two control modes: keyboard and webcam hand gestures

## Features

- 3D environment rendered with Three.js and WebGL
- Procedural obstacle and pickup flow
- Encounter events with branching outcomes
- Trading posts with purchasable upgrades and recovery items
- Difficulty modes: Easy, Medium, Hard, Insane
- In-run HUD with speed, status, score, weather, and time-of-day
- Local leaderboard persisted in browser storage

## Controls

### Keyboard mode
- W or Up Arrow: accelerate
- S or Down Arrow: brake
- A or Left Arrow: steer left
- D or Right Arrow: steer right

### Gesture mode (webcam)
- Move hand left or right: steer
- Push hand forward: accelerate
- Pull hand backward: brake
- Closed fist: stop immediately
- Open palm: resume movement

Note: Gesture controls require webcam permission and internet access to load MediaPipe scripts from CDN.

## Difficulty presets

| Difficulty | Start Fuel | Start Health | Start Money | Score Multiplier |
|---|---:|---:|---:|---:|
| Easy | 100 | 100 | 100 | 0.5x |
| Medium | 100 | 100 | 50 | 1.0x |
| Hard | 90 | 100 | 30 | 1.5x |
| Insane | 80 | 80 | 10 | 2.5x |

## Tech stack

- React 18 + TypeScript
- Vite 5
- Three.js
- Tailwind CSS + Radix UI components
- React Router

## Getting started

### 1) Install dependencies

Using npm:

```bash
npm install
```

Using Bun:

```bash
bun install
```

### 2) Start development server

```bash
npm run dev
```

Open the local URL shown in your terminal (typically http://localhost:5173).

### 3) Build for production

```bash
npm run build
```

### 4) Preview production build

```bash
npm run preview
```

## Available scripts

- npm run dev: start Vite dev server
- npm run build: create production build
- npm run build:dev: build in development mode
- npm run preview: preview production build locally
- npm run lint: run ESLint

## Project structure

```text
src/
	components/
		game/
			CaravansGame.tsx      # Main game container and game loop integration
			StartScreen.tsx       # Difficulty/control selection and leaderboard UI
			GameHUD.tsx           # In-game status panels
			EncounterOverlay.tsx  # Encounter and trading interactions
	game/
		GameEngine.ts           # Three.js world, spawning, collisions, weather/day-night
		InputHandler.ts         # Keyboard input state
		GestureController.ts    # Webcam + MediaPipe gesture input
		SaveManager.ts          # Local leaderboard persistence
		types.ts                # Shared game types and difficulty configs
```

## Gameplay loop

1. Pick difficulty and control mode.
2. Survive while fuel drains and hazards increase.
3. Collect pickups (fuel, health, money, valuables).
4. Resolve random encounters and trade when available.
5. Keep pushing distance to set a high score.

## Persistence

Leaderboard entries are stored in localStorage under:
- caravans_leaderboard

Only top 10 entries are retained.

## Deployment

The project is compatible with static hosting platforms:
- Netlify
- Vercel
- GitHub Pages (with Vite base path config if needed)

Build output is generated in the dist folder.

## Troubleshooting

- Webcam/gesture not working:
	- Ensure camera permissions are allowed in the browser.
	- Use HTTPS or localhost (required by getUserMedia in most browsers).
	- Check network access to jsdelivr CDN for MediaPipe scripts.
- Performance issues:
	- Close heavy browser tabs.
	- Disable battery saver mode.
	- Lower browser zoom and avoid high-DPI scaling if FPS drops.

## Credits

Created by Aryan and SimplyDilisha during a game jam.

## License

This repository includes a License file. See LICENSE for terms.
