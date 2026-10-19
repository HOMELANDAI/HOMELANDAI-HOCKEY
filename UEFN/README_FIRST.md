# ICE HOCKEY LAKE: FROZEN PAWS EDITION
## HomelandAI Studios | UEFN source prototype v0.4.0

**This is real Verse gameplay source and importable prototype geometry. It is NOT a compiled Fortnite island, an APK, a Unity project, or a VIVERSE upload.** The UEFN editor must import the meshes, bind devices, compile Verse, and run a Fortnite session. None of those editor steps has been executed by ChatGPT. Opening Fortnite.com in a browser does not connect the desktop editor to this conversation.

## Start in the editor you already have open

1. Save/check in the current island. Find its project/plugin **Content** folder, not the Fortnite installation folder.
2. Copy the six files from `Verse/` into `Content/FrozenPaws/`. Do not keep an earlier `fp_*.verse` module elsewhere under Content. The optional `Tools/install_verse.py` checks the target, previews changes, and backs up conflicting files before replacing them.
3. Follow **[Docs/UEFN_SETUP.md](Docs/UEFN_SETUP.md)** to import the provided geometry and bind the devices. Compile with **Verse > Build Verse Code**. Place `fp_hockey_device`, complete its settings, then **Launch Session**.

No editor-generated `.uefnproject`, `.umap`, `.uasset`, or publish code is included. Do not rename these source files to those extensions. Use your editor-created project.

## Implemented in source

- Standard Hockey: ten skaters plus two keepers; one human controls a home athlete, with AI for all other active athletes. Home lineup is C Rocky, LW Kefla, RW Crash, LD Billy, RD Koda, G Atlas.
- Opponent lineup is a **Crimson draft**, not a rewrite of the athletes' canonical factions: Crimson Emperor, Nova, Razor, Penny, Slash, Master Sniff.
- Match views: Behind Player, FPV Goalie, Overhead Aerial. Selecting FPV Goalie changes the controlled role to the keeper; leaving restores the remembered skater.
- FPV stationary shooting, goalie training, and full-length skate-and-shoot. Shooting early still releases a real simulated puck; the attempt simply cannot earn full-run credit.
- Possession, charged and quick shots, passing, poke checks, skating momentum, stamina, AI pursuit/support, goalie saves, swept goal-line checks and puck substeps, scores, faceoffs, three periods, changing ends, pause and results.
- Native Verse menu for modes, match camera, shooting athlete, goalie athlete, kits, empty-net practice, and AI save-window difficulty.
- Runtime prop spawning, guarded spawn failures, cleanup, player visibility/vulnerability restoration, optional sound-device events, training auto-reset.

## What changed since the previous UEFN source

The previous source required 30 manually placed dog props and physical buttons for each mode. This version uses a native menu and spawns the active roster from asset references. It adds explicit roster validation, charge-owner tracking, stale-release protection, short-tap support, delayed lost-release recovery, goalie-cover counting, boundary correction, and automatic training reset. The existing browser game is unchanged.

## Honest limits

This is an **arcade exhibition implementation**, not a complete hockey rules simulator. Offsides, icing, penalties, line changes, seasons, online human multiplayer, special powers, replay, manual drafting UI, and cosmetic persistence are not implemented. Editor-editable lineups are not a finished draft screen. AI difficulty currently changes the save window only.

The 63 OBJ meshes are the previously authored static prototypes: 60 character/kit combinations plus arena, puck, and aim marker. They have materials and equipment geometry, but no skeletons or animation clips. The controlled dog is hidden for unobstructed first-person views; there are no independently animated first-person arms or stick yet. Imported dog props are not Fortnite Locker outfits.

Camera movement and input feel require real Fortnite testing. Epic documents that Input Trigger response depends on client/server round-trip latency; this implementation makes no low-latency or competitive-readiness claim. FPV means a screen-based first-person perspective here, not VIVE Flow VR support.

## Verification

See `Tests/LOCAL_VERIFICATION.json` for checks actually executed. See `Verse/fp_logic_tests.verse` for the additional engine tests that must run in a separate UEFN test island. Source/geometry/installer checks are not Verse compilation or gameplay validation.

## GitHub layout

On the `uefn/frozen-paws-v0.4.0` branch, the source is under `UEFN/`. The existing root browser game is preserved. The branch can regenerate the mesh exports with:

```sh
python UEFN/Tools/build_assets.py
```

Node.js is needed for regeneration. The complete downloadable source ZIP already contains the pre-exported OBJ files and reference art, so this step is unnecessary when using that ZIP.

The correct game title is **ICE HOCKEY LAKE: FROZEN PAWS EDITION**. Original roster/reference files retain the legacy title for provenance. Their 15 documented characters and four unassigned slots have not been altered or invented.
