# Afterlight painted art brief

Image prompts for moving Afterlight to a painted look like the "concept art to playable world" post. Generate these with GPT Images (or similar), keep the same style line in every prompt, and drop the files into `afterlight/art/` using the names below.

**Style line (paste at the start of every prompt):**
> Cozy cel-shaded storybook illustration, high three-quarter top-down view from the south (camera tilted about 45°), warm golden late-afternoon light from the upper left, soft long shadows to the lower right, rich saturated greens and terracotta, clean dark outlines, gentle painterly texture, Mediterranean village, no text, no people.

## 1. Town backdrop (most important)

- **File:** `ground.png`, 2400 × 1700 px (or 4800 × 3400 for crisp zoom)
- **Prompt:** *[style line]* An empty village ground plan seen from above at a slight tilt: a round cobbled plaza in the center with a stone fountain, warm dirt and cobble paths branching out, grassy meadows with wildflowers, a stream on the right flowing from a small waterfall at the top right into a pond at the bottom right, a wooden bridge over the stream, rocky cliffs and hills along the top edge, old railway tracks running down the left side. Leave flat empty grass where buildings will go. No buildings, no trees in the middle of paths.
- Layout to match (in pixels from top left): plaza center (1150, 846), about 430 wide by 300 tall; pond center (1860, 1480); waterfall around (1990, 120–300); bridge (1990–2150, 918–966); rails at x 300–338 from y 560 to 1560; main road going straight down from the plaza to (1150, 1700).

## 2. Buildings (one image each, transparent background)

All buildings use the same camera as the backdrop and sit on a transparent background, with the bottom front edge of the walls along the bottom of the image.

| File | Size | Prompt (after the style line) |
|---|---|---|
| `store.png` | 280 × 260 | Small corner grocery store, cream plaster walls, red clay tile roof, green and white striped awning, crates of fruit outside, green door. |
| `juno.png` | 250 × 320 | Narrow two-storey apartment building, pink plaster, terracotta roof, small iron balcony, blue shutters. |
| `mara.png` | 260 × 240 | Cozy cottage, butter-yellow plaster, terracotta tile roof with chimney, teal shutters, arched door, window boxes. |
| `teo.png` | 250 × 230 | Older cottage, sandy stone walls, darker red roof, brown shutters, slightly weathered. |
| `garage.png` | 260 × 240 | Converted garage workshop, pale stone, corrugated metal roof, half-open orange roll-up door, workbench outside. |
| `depot.png` | 260 × 220 | Abandoned wooden rail depot, faded planks, boarded door, rusty roof. |

## 3. Things that change as you play

Each one needs a **before** and **after** version in the same frame, so the game can swap them:

- `greenhouse_lot_before.png` / `greenhouse_after.png` (300 × 200): overgrown lot with brambles, then a glass greenhouse full of plants.
- `solar_after.png` (420 × 240): rows of solar panels on a timber pergola with vines, in a meadow.
- `workshop_after.png` (260 × 180): small robot repair shed with a charging bay.
- `kitchen_before.png` / `kitchen_after.png` (300 × 200): cracked empty stone terrace, then an open-air community kitchen with a long table and string lights.

## 4. The grey start

The game starts in a tired, grey town and warms up as you play. You don't need to paint everything twice: the game can desaturate and haze the paintings itself at the start. If you'd like more control, generate a second `ground_tired.png` with the same prompt plus "overcast, faded, dry grass, muted colors".

## What happens next

Once the images are in `afterlight/art/`, I'll swap the code-drawn ground and buildings for them, line up collisions and doors, keep the characters, trees and effects drawn in code on top, and keep the warm-up color grade working over the paintings.
