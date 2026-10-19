# UEFN integration and first test

This is a source integration procedure, not evidence that these steps have already succeeded. Stop at the first compiler/import error and preserve the full error text. Never publish based only on the local verification report.

## 1. Existing island and source

Use your existing **desktop Unreal Editor for Fortnite** project, or create a blank island from UEFN. Save/check in first. Fortnite.com and Creator Portal are not the desktop editor.

Locate the actual project Content folder with the editor's Show in Explorer option. Folder layouts vary: use the Content folder belonging to the project/game-feature plugin, not an engine installation or an arbitrary new folder. Copy all six delivered Verse files into a single `Content/FrozenPaws` folder. Keep them together in one module; do not scatter them into subfolders. Remove/archive previous `fp_*.verse` copies outside Content to avoid duplicate definitions. Do not copy the `Data`, `Tools`, or `ReferenceArt` folders as executable Verse.

Optional checked copy (Python 3):

```sh
python Tools/install_verse.py "D:\YourActualProject\YourPlugin\Content"
python Tools/install_verse.py "D:\YourActualProject\YourPlugin\Content" --apply
```

The first command is a dry run. An existing modified file is only replaced with `--replace`; it is first backed up outside Content. The helper does not control the editor, compile Verse, import assets, or touch Epic credentials. The path above is an example, not a detected path on your computer.

Choose **Verse > Build Verse Code**. Successful compilation makes `fp_hockey_device` available as a placeable device. This has not been compiled here; resolve compiler diagnostics before proceeding. Do not place `fp_logic_tests` on the playing island.

## 2. Import the meshes

The full ZIP contains `ImportAssets/Models/` with 63 OBJ files and `FrozenPaws.mtl`. In a GitHub checkout without exported meshes, run `python UEFN/Tools/build_assets.py` first (requires Node.js).

Import all OBJ files with their MTL beside them. Use centimetres and scale 1; the exports are +X forward, +Y right, +Z up. Do not combine all files into a single mesh. Enable material import. Meshes have color-material assignments rather than downloaded textures. Verify a skater is roughly 2 metres tall, not 200 metres.

The opening configuration needs 15 `*_IronPawHome`, 15 `*_CrimsonAway`, `FrozenLake_Arena`, `Hockey_Puck`, and `Aim_Marker`. The other 30 character meshes are alternative kits.

Convert the imported meshes into Fortnite prop assets using **Scripted Asset Actions > Convert to Prop**. These are the Blueprint prop assets assigned to the Verse `creative_prop_asset` fields, not raw OBJ paths or static mesh objects. Turn off destructibility/resource drops. For athlete, puck, aim-marker and arena props, use **No Collision** because gameplay collision is handled by the Verse simulation. The lobby needs its own collidable floor/spawn pad. Do not enable native physics on the puck as well: that would compete with the custom simulation.

OBJ/MTL material behavior and coordinate conversion still require import verification. If an importer ignores MTL colors, inspect material slots and assign the included palette or re-export FBX through a modeling tool. Do not assume the concept art has been reconstructed as production meshes.

## 3. Place and bind the devices

Place one `fp_hockey_device`, one player spawn pad on a safe lobby floor, one lobby Button, one HUD Message device, one Third Person Controls device, three Fixed Point Camera devices, and fourteen Input Trigger devices. The game uses one human operator, so set island Max Players to **1** for this source slice.

On `fp_hockey_device`, bind the placed devices to matching fields. Bind all three cameras even if you plan to start overhead. `SetupComplete` must remain off until every mandatory field below has been checked.

Set asset arrays by **canonical character index** using `Data/asset_slots.csv`:

| Field | Elements | Assign |
|---|---:|---|
| HomeAssets | 15 | IronPawHome prop assets in canonical order |
| AwayAssets | 15 | CrimsonAway prop assets in canonical order |
| HomeAlternateAssets | 15 optional | IronPawAway in canonical order |
| AwayAlternateAssets | 15 optional | CrimsonHome in canonical order |
| ArenaAssets | 1 | FrozenLake_Arena prop |
| PuckAssets | 1 | Hockey_Puck prop |
| AimAssets | 1 | Aim_Marker prop |

These are references to assets; you do not manually place 30 skaters. The source spawns the active athletes. Do not add a second copy of the arena on the rink, or there will be overlapping surfaces.

`RinkOrigin` defaults to X=0, Y=0, Z=100 cm. Pick an unobstructed location. The visual environment extends approximately 130 metres in each horizontal direction; it is much larger than the playable rink. Keep lobby/spawn objects outside the camera's view. Use a Skylight/directional light appropriate to a blue-hour outdoor arena; the OBJ does not contain functional lights.

Default arrays for lineups use slots **C, LW, RW, LD, RD, G**:

- Home: `[0, 4, 3, 2, 5, 1]`.
- Away: `[6, 12, 7, 13, 9, 11]`.

Each side requires five skater-qualified identities and one keeper-qualified identity. Duplicate identities across the twelve slots are rejected. Canonical factions remain immutable. The supplied draft opponent legitimately uses Unaligned athletes in the active Crimson kit.

## 4. Camera settings

For all three Fixed Point Cameras: **Add to Players on Start Off**, **Look at Target No**, **Look at Focus Target on Activate Off**, **Camera Shake Off**, priority 10, transition in/out about 0.15 s. The script sets their transforms. Leaving Look at Target enabled may turn the view back toward the hidden Fortnite pawn in the lobby.

Start with perspective FOV 80 degrees for overhead, 75 for behind-player, 90 for FPV. These are authored tuning values, not tested production values. The FPV device is a Fixed Point Camera moved to the simulated athlete's eye position, not the native player First Person Camera, because the visible athlete is a prop and the Fortnite pawn is held in the lobby.

For Third Person Controls: Add to Players on Start Off, priority 10, enabled during gameplay, target assistance off. The script adds/removes it with the camera. It does not provide the dog locomotion; that remains the custom simulation.

## 5. Input settings

Use the exact `Data/device_mapping.json` bindings. All 14 Input Triggers use **Creative Input Action**, **Require Registered**, **Consume Input On**, selected team/class Any, Enabled At Game Start On. Only the controlling player is registered. Give each device a distinct editor name. Directional axes use two devices each (positive/negative), which is why twelve action IDs need fourteen devices.

| Verse field | Creative input | Axis | Suggested desktop binding |
|---|---|---|---|
| Shoot | Custom 1 (Fire) | - | Left mouse / hold then release |
| AimModifier | Custom 2 (Target) | - | Right mouse / hold + movement adjusts target |
| Check | Custom 3 (Crouch) | - | C |
| QuickShot | Custom 4 (Jump) | - | Space |
| Sprint | Custom 5 (Sprint) | - | Left Shift |
| Pass | Custom 6 (Interact) | - | E |
| MoveForward | Custom 7 (Forward/Back) | Positive | W |
| MoveBack | Custom 7 (Forward/Back) | Negative | S |
| MoveLeft | Custom 8 (Left/Right) | Negative | A |
| MoveRight | Custom 8 (Left/Right) | Positive | D |
| CameraCycle | Custom 9 (Previous Item) | - | V |
| MenuInput | Custom 10 (Next Item) | - | M |
| Switch | Custom 11 (Swap Quickbar) | - | Q |
| ResetInput | Custom 12 (Harvesting Tool) | - | R |

Key assignments are suggestions. Players configure Creative Input Actions in Fortnite settings; the source cannot silently rewrite global player mappings. Show action hints on the HUD, but avoid all 14 overlapping on mobile. This slice requires keyboard/controller mapping and platform UX tests before a mobile compatibility claim.

The menu pauses play. Mouse/controller UI focus is removed on Resume/Start. In gameplay, QuickShot also acts as the goalie save input. Shoot without possession performs a poke check. In goalie role use Pass to clear a covered puck. Reset restarts the match or starts the next training attempt; Menu pauses without discarding the match.

## 6. Optional audio and HUD

HUD Message: set display placement to top-center, persistent duration, a dedicated layer, no long intro/outro, so repeated score updates do not queue behind one another. In FPV, keep it clear of the puck.

ShotSounds, GoalSounds, SaveSounds can remain empty. To use them, place Audio Player devices configured for the instigating player and assign approved Fortnite/library audio. No audio recordings are bundled and no sound availability is assumed.

## 7. First session and acceptance

Enable `SetupComplete`, save, Build Verse Code again, then Launch Session. The menu should appear after the Fortnite player spawns. Use the lobby button to reopen it. Select Standard Hockey and confirm **12 athletes**, not 12 human clients.

First test the actual inputs: move, collect the puck, tap a quick shot, hold/release a charged shot, pass, switch, change camera, pause/resume, and stop. Repeat in each drill. In Full-Length Skate & Shoot, an early shot must visibly launch while reporting an incomplete run. Complete the full approach and shoot again; the goal must count. Check that returning to the lobby restores the normal player view and visibility.

Run `fp_logic_tests` on a separate empty test island and inspect its printed summary. The tests are authored but not executed in this delivery. Follow `Tests/UEFN_ACCEPTANCE.md` before judging the game playable or publishing. UEFN memory calculation, validation, content review, and release are separate later gates.

## Official references checked during preparation

- https://dev.epicgames.com/documentation/en-us/fortnite/user-interface-reference-for-unreal-editor-for-fortnite
- https://dev.epicgames.com/documentation/en-us/fortnite/importing-assets-in-unreal-editor-for-fortnite
- https://dev.epicgames.com/documentation/en-us/fortnite/converting-assets-into-props-in-unreal-editor-for-fortnite
- https://dev.epicgames.com/documentation/en-us/fortnite/using-input-trigger-devices-in-fortnite-creative
- https://dev.epicgames.com/documentation/en-us/fortnite/using-fixed-point-camera-devices-in-fortnite-creative
- https://dev.epicgames.com/documentation/en-us/fortnite/making-widgets-interactable-in-unreal-editor-for-fortnite

These references support the APIs/workflow, not a claim that this source compiles or performs correctly in your installed editor version.
