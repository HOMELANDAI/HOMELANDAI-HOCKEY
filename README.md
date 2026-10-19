# ICE HOCKEY LAKE: FROZEN PAWS EDITION

**HomelandAI Studios | Browser prototype v0.3.0**

This repository contains the browser-game implementation, not just a design brief or verification report. It is the browser version discussed for VIVERSE and for continued development with Gemini. The Fortnite/UEFN implementation is a separate project; this browser game is not a compiled Fortnite island or a native VIVE Flow APK.

## Run the game

Download or clone the repository. From the project directory, run:

```sh
python -m http.server 8000
```

Open `http://localhost:8000` in a WebGL-capable browser. Serving the complete directory keeps the game's local JavaScript files available.

## Included gameplay

- Standard Hockey: five skaters and one goalkeeper per team, with AI controlling the other athletes.
- Match views: Behind Player, FPV Goalie, and Overhead Aerial.
- First-person training: Stationary Shooting, Goalie Training, and Full-Length Skate & Shoot.
- Prototype uniforms, helmets, player switching, passing, charged shooting, scoring, faceoffs, and periods.

This remains a development prototype with simplified procedural visuals. It does not include production character rigs, online human multiplayer, offsides, icing, penalties, or line changes. Immersive WebXR and dedicated VIVE Flow controller support still require physical-device validation.

## VIVERSE upload

Do **not** upload GitHub's full repository ZIP to VIVERSE. The repository includes development files that VIVERSE may reject.

Run:

```sh
python tools/package_viverse.py
```

Upload only the resulting `dist/Ice_Hockey_Lake_Frozen_Paws_VIVERSE_WEB_UPLOAD_v0_3_0_CLEAN.zip`. The packaging tool includes only a self-contained `index.html` at the ZIP root and verifies that it matches the previously delivered v0.3.0 runtime.

## Continue in Gemini

Use this repository's game code as the starting point, not a delivery-verification JSON report. See [GEMINI.md](GEMINI.md) for the project requirements and handoff prompt. Gemini-specific preview and immersive-VR behavior have not been validated.

## Status and provenance

The original self-contained browser runtime has SHA-256:

```text
2392227d201f9542410b0c033b8198487b623a93f75be8618af186e97b38b540
```

Repository packaging separates the existing HTML and JavaScript for editing. No gameplay redesign is intended. The packaging command reconstructs the original single-file runtime rather than converting this into a different game.

The earlier v0.3.0 delivery reported local browser and logic checks. Those reports do not establish live VIVERSE acceptance, physical headset testing, Gemini compatibility, or Fortnite compilation. Repository upload is not deployment or platform certification.

The approved title is **ICE HOCKEY LAKE: FROZEN PAWS EDITION**. Do not revert it to the legacy project title found in archival roster metadata.
