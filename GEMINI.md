# Gemini development handoff

## Existing project

**ICE HOCKEY LAKE: FROZEN PAWS EDITION**  
**HomelandAI Studios | Browser prototype v0.3.0**

Use the existing game implementation in this repository. This is not a request to replace it with a design brief, dashboard mockup, verification report, or unrelated game.

## Start here

- `Source/simulation.js`: deterministic hockey simulation, AI, possession, shots, scoring, training.
- `Source/input.js`: ordered shot press/release buffering.
- `Source/renderer.js`: WebGL rendering, procedural canine athletes, uniforms, helmets, frozen rink.
- `Source/app.js`: application state, controls, camera modes, menus, audio, experimental WebXR.
- `Source/head.html`: game markup and responsive CSS.
- `Source/roster.json`: original character definitions, including unresolved identities.
- `index.html`: repository launcher; fetches local source pieces and starts the original game.
- `tools/package_viverse.py`: produces a self-contained HTML runtime and clean upload ZIP.

Serve the complete repository with `python -m http.server 8000` and open `http://localhost:8000`. Alternatively, run `python tools/package_viverse.py` and preview `dist/index.html`.

Do not supply only this launcher HTML to a single-file preview without the `Source` directory. For a single-file Canvas handoff, use the assembled `dist/index.html` instead. A preview environment may need different project wiring; make only necessary compatibility changes and report them.

## Preserve these requirements

1. Exact title: **ICE HOCKEY LAKE: FROZEN PAWS EDITION**. Studio: **HomelandAI Studios**. Do not use the legacy title in archival roster metadata as the current title.
2. Standard Hockey: five skaters plus one goalkeeper per team, twelve athletes on the ice. This prototype is one human against AI, not twelve-human multiplayer.
3. Match perspectives: Behind Player, FPV Goalie, Overhead Aerial.
4. First-person training: Stationary Shooting, Goalie Training, Full-Length Skate & Shoot.
5. Full-Length Skate & Shoot means carrying the puck while skating the full rink in first person, then shooting at the far goal.
6. Releasing a charged shot must launch the puck. Early shots can fail the full-run qualification, but must not remain silently attached to the stick. Preserve the quick-shot fallback and input edge buffering.
7. Preserve character identities, factions, uniforms, helmet identities, and the frozen-lake setting. Do not invent the four unresolved athletes or resolve Pixy's breed and Slash's size without the creator's direction.
8. Keep paused camera changes separate from changing the controlled skater/goalie role. Avoid forced camera rolls or abrupt first-person transitions.

## First task in Gemini

Read the source and attempt to run the existing game. Identify actual preview errors before editing. Preserve the gameplay and art identity. After changes, test a standard match, all three views, stationary shooting, goalie training, and a full-rink carry followed by charge, release, and a moving puck. Distinguish observed test results from assumptions.

## Packaging

For the unmodified baseline:

```sh
python tools/package_viverse.py
```

For deliberately edited source after reviewing and testing changes:

```sh
python tools/package_viverse.py --allow-modified
```

Upload only the resulting ZIP in `dist` to VIVERSE. It contains only `index.html` at root. Do not include Python scripts, test folders, or the full GitHub repository ZIP in the VIVERSE upload.

`Source/build.py` is the original assembly script and overwrites the root `index.html` when run. Prefer the `tools/package_viverse.py` helper, which leaves the repository launcher intact.

## What this is not

This repository upload does not establish Gemini compatibility, physical VIVE Flow/controller validation, live VIVERSE approval, or a finished commercial game. The character visuals remain procedural prototypes. Advanced hockey rules, production rigs, online multiplayer and full customization remain unfinished.

The Fortnite direction is **Unreal Editor for Fortnite / Verse**, not Unity. Its previously delivered source package is separate and is not included in this browser-source upload. Do not describe this JavaScript runtime as a compiled Fortnite island or native headset APK.
