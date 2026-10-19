# Editor and Fortnite acceptance - not run here

Record editor/Fortnite version, date, tester, platform, input mapping, ping, build log, and video of the results. A pass in the Python package checker is not a pass below.

1. Import the meshes with correct centimetre scale, colors, normals, no duplicate surfaces, and no unintended destructibility.
2. Build all six Verse files successfully in the same module. Place only the hockey device in the playing island.
3. Run fp_logic_tests in a separate island. Save its complete PASS/FAIL output; fix every failure.
4. Confirm menu appears, navigation works, and no input is trapped when starting/resuming/exiting.
5. Confirm Standard Hockey spawns exactly six per side, with unique identities, matching jerseys/helmets, and appropriate keeper gear.
6. Test moving, braking, turning, stamina, possession, pass, check, AI support/pursuit, saves, rebounds, and faceoffs.
7. Release shots at low/medium/full charge. Test a quick press/release and QuickShot. No shot may stay attached after a valid release.
8. Charge, lose possession, then release; no phantom shot. Charge, switch player/camera/role or reset, then release; no stale shot.
9. Switch overhead -> behind -> goalie -> overhead. Confirm control belongs to the intended athlete, no camera follows the hidden lobby pawn, and active camera is removed on exit.
10. Stationary drill: movement cannot move the shooter; empty net / AI net toggles work; results auto-reset once.
11. Full-rink drill: early shot launches but gets no full-run credit; manual skate reaches far zone; aim/charge/release/goal works; repeated attempts do not leave stale charge state.
12. Goalie drill: both keeper choices work, shots are fed, crease bounds hold, saves/allowed goals update, and next attempt starts.
13. The puck must fully cross a goal plane between posts and below the bar. Test wide/high shots, post/crossbar rebounds, own goals, and no duplicate scoring during stoppage.
14. Three periods, end changes, scoreboard, final winner/draw, pause/resume clock, and replaying a new match.
15. Test altered editor lineups: no duplicates, six per side, keeper slot valid. Character origin factions stay unchanged.
16. Try missing asset bindings and incomplete alternate kits: clear setup error, no partially running game, no stranded invisible player.
17. Repeatedly switch modes and exit/reenter 20 times; check for leaked props, cameras, widgets, registered inputs, or event subscriptions.
18. Confirm audio cues fire once when optional devices are assigned, and absent devices do not prevent play.
19. Test actual network latency and frame-time behavior. Input Trigger round-trip delays and 30 Hz prop updates may need architectural changes for production sports gameplay.
20. Check memory, materials/draw calls, world streaming, target platforms, accessibility, and Epic validation before any publication. No public release is authorized by this test checklist.
