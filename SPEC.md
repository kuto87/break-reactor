# Break Reactor Specification

## Goal

Create a polished endless brick-breaker that stays readable and debuggable through very high waves, currently planned up to wave 10000.

## Core Loop

1. Move the paddle to return balls.
2. Break enough blocks to advance the wave.
3. Collect coins and temporary items.
4. Spend coins on in-run upgrades.
5. Survive boss waves every 5 waves.
6. Complete optional missions for coin and score bonuses.

## Difficulty Scaling

- Normal waves grow by row count and fill rate.
- Block toughness is probability-based instead of forcing every block to harden at once.
- Wood starts appearing after early waves.
- Stone appears later and at a lower rate.
- Metal appears in late waves and remains capped.
- Ball speed has a cap so wave 10000 remains playable.
- HUD numbers abbreviate large scores to prevent overflow.

## Blocks

- Glass: default blue block with glossy highlights.
- Wood: 2-hit block with wood grain and knots.
- Stone: 3-hit block with cracked texture.
- Metal: 4-hit block with panel lines and rivets.
- Special types can drop coins, items, or explode.

## Bosses

- Boss waves occur every 5 waves.
- Small bosses are mostly static.
- Mid and large bosses move horizontally with wave-scaled amplitude and speed.
- Boss hits pulse the background so the playfield reacts to the target.
- Boss collision uses the same push-out reflection as blocks to avoid the ball being swallowed.

## Missions

One mission is active per wave:

- Break blocks
- Collect coins
- Reach a combo count
- Break special blocks
- Defeat the boss

Rewards grant coins and score. Mission progress is shown under the HUD.

## Debugging

Development controls are intentionally built in:

- `Shift+W`: prompt and jump to a wave
- `Shift+C`: add coins
- URL parameters: `?debug=1&wave=50&coins=200`
- Console API: `BreakReactorDebug`

These helpers should remain available in static hosting builds because they do not require a build pipeline.

## Known Constraints

- The game is canvas-rendered and tuned for a 420 x 720 logical viewport.
- There is no asset pipeline; visual polish is drawn procedurally in `main.js`.
- No external libraries are used.
