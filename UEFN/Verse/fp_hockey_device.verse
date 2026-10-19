# ICE HOCKEY LAKE: FROZEN PAWS EDITION - HomelandAI Studios
# v0.4.0 UEFN adapter. Importable source, NOT an editor-compiled island.
# One human controls a simulated dog team. No custom Fortnite outfit is assumed.
using { /Fortnite.com/Devices }
using { /Fortnite.com/Characters }
using { /Fortnite.com/Playspaces }
using { /Verse.org/Simulation }
using { /Verse.org/Verse }
using { /UnrealEngine.com/Temporary/SpatialMath }

FPText<localizes>(S:string):message = "{S}"

fp_hockey_device := class(creative_device):
    # Explicit guard prevents a forgotten asset binding from launching a fake game.
    @editable SetupComplete:logic = false
    @editable LobbyButton:button_device = button_device{}
    @editable Shoot:input_trigger_device = input_trigger_device{}
    @editable QuickShot:input_trigger_device = input_trigger_device{}
    @editable Pass:input_trigger_device = input_trigger_device{}
    @editable Switch:input_trigger_device = input_trigger_device{}
    @editable Check:input_trigger_device = input_trigger_device{}
    @editable Sprint:input_trigger_device = input_trigger_device{}
    @editable AimModifier:input_trigger_device = input_trigger_device{}
    @editable MoveForward:input_trigger_device = input_trigger_device{}
    @editable MoveBack:input_trigger_device = input_trigger_device{}
    @editable MoveLeft:input_trigger_device = input_trigger_device{}
    @editable MoveRight:input_trigger_device = input_trigger_device{}
    @editable CameraCycle:input_trigger_device = input_trigger_device{}
    @editable MenuInput:input_trigger_device = input_trigger_device{}
    @editable ResetInput:input_trigger_device = input_trigger_device{}
    @editable AerialCamera:gameplay_camera_fixed_point_device = gameplay_camera_fixed_point_device{}
    @editable BehindCamera:gameplay_camera_fixed_point_device = gameplay_camera_fixed_point_device{}
    @editable FirstPersonCamera:gameplay_camera_fixed_point_device = gameplay_camera_fixed_point_device{}
    @editable ThirdPersonControls:gameplay_controls_third_person_device = gameplay_controls_third_person_device{}
    @editable HUD:hud_message_device = hud_message_device{}
    # Arrays are canonical roster order, NOT on-ice lineup order. See Data/asset_slots.csv.
    @editable HomeAssets:[]creative_prop_asset = array{}
    @editable AwayAssets:[]creative_prop_asset = array{}
    @editable HomeAlternateAssets:[]creative_prop_asset = array{}
    @editable AwayAlternateAssets:[]creative_prop_asset = array{}
    @editable ArenaAssets:[]creative_prop_asset = array{}
    @editable PuckAssets:[]creative_prop_asset = array{}
    @editable AimAssets:[]creative_prop_asset = array{}
    @editable RinkOrigin:vector3 = vector3{Z := 100.0}
    @editable HomeLineup:[]int = array{0, 4, 3, 2, 5, 1}
    @editable AwayLineup:[]int = array{6, 12, 7, 13, 9, 11}
    @editable PeriodSeconds:float = 120.0
    @editable AutoResetTraining:logic = true
    @editable TrainingResetDelay:float = 3.0
    @editable ShotSounds:[]audio_player_device = array{}
    @editable GoalSounds:[]audio_player_device = array{}
    @editable SaveSounds:[]audio_player_device = array{}

    var Game:fp_simulation = fp_simulation{}
    var Command:fp_command = fp_command{}
    var Owner:?agent = false
    var Running:logic = false
    var ActiveMenu:?fp_menu = false
    var MenuPlayer:?player = false
    var SelectedView:fp_view = fp_view.OverheadAerial
    var SelectedAthlete:int = 0
    var SelectedGoalie:int = 1
    var AlternateKits:logic = false
    var EmptyNet:logic = true
    var Difficulty:float = 0.6
    var Proxies:[]creative_prop = array{}
    var Arena:?creative_prop = false
    var PuckVisual:?creative_prop = false
    var AimVisual:?creative_prop = false
    var SavedVulnerable:logic = true
    var ShotPressedAt:float = 0.0
    var MissingReleaseTime:float = 0.0
    var AimX:float = 0.0
    var AimHeight:float = 0.65
    var ResultTime:float = 0.0
    var UIElapsed:float = 0.0
    var LastShot:int = 0
    var LastGoal:int = 0
    var LastSave:int = 0
    var Status:string = "Choose Standard Hockey or an FPV training drill."
    var Subscriptions:[]cancelable = array{}

    OnBegin<override>()<suspends>:void =
        set Subscriptions = array:
            LobbyButton.InteractedWithEvent.Subscribe(OpenMenu)
            Shoot.PressedEvent.Subscribe(OnShootPressed)
            Shoot.ReleasedEvent.Subscribe(OnShootReleased)
            QuickShot.PressedEvent.Subscribe(OnQuickShot)
            Pass.PressedEvent.Subscribe(OnPass)
            Switch.PressedEvent.Subscribe(OnSwitch)
            Check.PressedEvent.Subscribe(OnCheck)
            CameraCycle.PressedEvent.Subscribe(CycleCamera)
            MenuInput.PressedEvent.Subscribe(OpenMenu)
            ResetInput.PressedEvent.Subscribe(ResetAttempt)
            GetPlayspace().PlayerAddedEvent().Subscribe(PlayerAdded)
            GetPlayspace().PlayerRemovedEvent().Subscribe(PlayerRemoved)
        for (P : GetPlayspace().GetPlayers()):
            PlayerAdded(P)
        var Last:float = GetSimulationElapsedTime()
        loop:
            Sleep(0.0333333)
            Now := GetSimulationElapsedTime()
            Dt := FPClamp(Now - Last, 0.001, 0.05)
            set Last = Now
            if (Running?, A := Owner?):
                if (FC := A.GetFortCharacter[], FC.IsActive[]):
                    if (not Game.Paused?):
                        SampleInput(A, Dt)
                        Game.Step(Dt, Command)
                        Command.ClearEdges()
                        if (Game.Mode <> fp_mode.StandardHockey, Game.Phase = fp_phase.Result):
                            set ResultTime += Dt
                            if (AutoResetTraining?, ResultTime >= Max(1.0, TrainingResetDelay)):
                                Game.NextAttempt()
                                ClearInput()
                        else:
                            set ResultTime = 0.0
                        UpdateVisuals()
                        UpdateCamera(A)
                        EmitAudio(A)
                    set UIElapsed += Dt
                    if (UIElapsed >= 0.20):
                        set UIElapsed = 0.0
                        UpdateHUD(A)
                else:
                    StopSession(A)

    OnEnd<override>():void =
        CloseMenu()
        if (A := Owner?):
            StopSession(A)
        DisposeWorld()
        for (Subscription : Subscriptions):
            Subscription.Cancel()

    PlayerAdded(P:player):void =
        spawn{WaitForPlayer(P)}

    WaitForPlayer(P:player)<suspends>:void =
        for (Try := 0..39):
            if (FC := P.GetFortCharacter[], FC.IsActive[]):
                OpenMenu(P)
                return
            Sleep(0.25)

    PlayerRemoved(P:player):void =
        if (Owns(P)?):
            StopSession(P)
        if (M := MenuPlayer?, M = P):
            CloseMenu()

    Owns(A:agent)<transacts>:logic = logic{O := Owner?, O = A}
    Accepts(A:agent)<transacts>:logic = logic{Owns(A)?, Running?, not Game.Paused?, Game.Phase = fp_phase.Playing}

    Inputs()<transacts>:[]input_trigger_device =
        array{Shoot, QuickShot, Pass, Switch, Check, Sprint, AimModifier, MoveForward, MoveBack, MoveLeft, MoveRight, CameraCycle, MenuInput, ResetInput}

    OpenMenu(A:agent):void =
        if (Other := Owner?, Other <> A):
            HUD.Show(A, FPText("Single-human prototype. Another player is controlling this rink."), 5.0)
            return
        if (P := player[A]):
            CloseMenu()
            if (Running?):
                set Game.Paused = true
                ClearInput()
            M := fp_menu{Controller := Self, ForPlayer := P}
            set ActiveMenu = option{M}
            set MenuPlayer = option{P}
            M.Open()

    CloseMenu():void =
        if (M := ActiveMenu?):
            M.Close()
        set ActiveMenu = false
        set MenuPlayer = false

    Resume(A:agent):void =
        if (Owns(A)?, Running?):
            CloseMenu()
            ClearInput()
            set Game.Paused = false

    SetStatus(A:agent, S:string):void =
        set Status = S
        Print("FROZEN PAWS: {S}")
        HUD.Show(A, FPText(S), 6.0)
        if (M := ActiveMenu?):
            M.Refresh()

    StartFor(A:agent, Mode:fp_mode):void =
        if (Other := Owner?, Other <> A):
            return
        if (not SetupComplete?):
            SetStatus(A, "SETUP REQUIRED: finish Docs/UEFN_SETUP.md and enable SetupComplete on fp_hockey_device.")
            return
        Home := if (AlternateKits?) then HomeAlternateAssets else HomeAssets
        Away := if (AlternateKits?) then AwayAlternateAssets else AwayAssets
        if (Home.Length <> 15 or Away.Length <> 15 or ArenaAssets.Length <> 1 or PuckAssets.Length <> 1 or AimAssets.Length <> 1):
            SetStatus(A, "SETUP ERROR: selected kits need 15 assets per side; arena, puck and aim arrays need one each.")
            return
        Candidate := fp_simulation{Definitions := FPRoster(), Rules := fp_rules{PeriodSeconds := Max(15.0, PeriodSeconds), EmptyTrainingNet := EmptyNet, Difficulty := Difficulty, HomeLineup := HomeLineup, AwayLineup := AwayLineup}}
        Index := if (Mode = fp_mode.GoalieTraining) then SelectedGoalie else SelectedAthlete
        Candidate.Start(Mode, SelectedView, Index)
        if (Candidate.Phase = fp_phase.Finished or Candidate.Athletes.Length = 0):
            SetStatus(A, Candidate.Message)
            return
        if (FC := A.GetFortCharacter[], FC.IsActive[]):
            if (Running?):
                StopSession(A)
            set Game = Candidate
            SpawnWorld(Home, Away)
            if (Proxies.Length <> Game.Athletes.Length or not Arena? or not PuckVisual? or not AimVisual?):
                DisposeWorld()
                SetStatus(A, "SPAWN FAILED: check assigned prop assets and the UEFN Output Log.")
                OpenMenu(A)
                return
            set Owner = option{A}
            set SavedVulnerable = logic{FC.IsVulnerable[]}
            FC.PutInStasis(stasis_args{AllowTurning := false, AllowFalling := false, AllowEmotes := false})
            FC.Hide()
            FC.SetVulnerability(false)
            ThirdPersonControls.Enable()
            ThirdPersonControls.AddTo(A)
            for (Input : Inputs()):
                Input.Register(A)
                Input.Enable()
            set Running = true
            set LastShot = 0
            set LastGoal = 0
            set LastSave = 0
            set Status = "Game started. Open the menu to pause or change modes."
            CloseMenu()
            ClearInput()
            ApplyCamera(A)
            UpdateVisuals()
            UpdateCamera(A)
            UpdateHUD(A)
        else:
            SetStatus(A, "Wait for the Fortnite player to spawn, then start the mode again.")

    SpawnWorld(Home:[]creative_prop_asset, Away:[]creative_prop_asset):void =
        DisposeWorld()
        if (Asset := ArenaAssets[0]):
            Result := SpawnProp(Asset, RinkOrigin, MakeRotationFromYawPitchRollDegrees(0.0, 0.0, 0.0))
            set Arena = Result(0)
        if (Asset := PuckAssets[0]):
            Result := SpawnProp(Asset, World(fp_vec2{}, 0.12), MakeRotationFromYawPitchRollDegrees(0.0, 0.0, 0.0))
            set PuckVisual = Result(0)
        if (Asset := AimAssets[0]):
            Result := SpawnProp(Asset, World(fp_vec2{}, 1.0), MakeRotationFromYawPitchRollDegrees(0.0, 0.0, 0.0))
            set AimVisual = Result(0)
        for (Athlete : Game.Athletes):
            Assets := if (Athlete.Team = 0) then Home else Away
            if (Asset := Assets[Athlete.Definition.Index]):
                Result := SpawnProp(Asset, World(Athlete.Position, 0.0), MakeRotationFromYawPitchRollDegrees(0.0, 0.0, 0.0))
                if (P := Result(0)?):
                    set Proxies += array{P}
                else:
                    Print("FROZEN PAWS: failed to spawn {Athlete.Definition.Id}; aborting setup.")
                    return

    DisposeWorld():void =
        for (P : Proxies):
            if (P.IsValid[]):
                P.Dispose()
        set Proxies = array{}
        if (P := Arena?, P.IsValid[]):
            P.Dispose()
        if (P := PuckVisual?, P.IsValid[]):
            P.Dispose()
        if (P := AimVisual?, P.IsValid[]):
            P.Dispose()
        set Arena = false
        set PuckVisual = false
        set AimVisual = false

    StopSession(A:agent):void =
        if (not Owns(A)?):
            return
        set Running = false
        CloseMenu()
        ClearInput()
        AerialCamera.RemoveFrom(A)
        BehindCamera.RemoveFrom(A)
        FirstPersonCamera.RemoveFrom(A)
        ThirdPersonControls.RemoveFrom(A)
        for (Input : Inputs()):
            Input.Unregister(A)
        if (FC := A.GetFortCharacter[]):
            FC.Show()
            FC.SetVulnerability(SavedVulnerable)
            FC.ReleaseFromStasis()
        HUD.Hide()
        DisposeWorld()
        set Owner = false
        set Status = "Returned to lobby. Use the lobby button to play again."

    ResetAttempt(A:agent):void =
        if (Owns(A)?, Running?, not Game.Paused?):
            if (Game.Mode = fp_mode.StandardHockey):
                Game.Start(fp_mode.StandardHockey, Game.View, SelectedAthlete)
                set LastShot = 0
                set LastGoal = 0
                set LastSave = 0
            else:
                Game.NextAttempt()
            ClearInput()
            UpdateVisuals()
            ApplyCamera(A)

    ClearInput():void =
        set Command = fp_command{}
        set ShotPressedAt = 0.0
        set MissingReleaseTime = 0.0
        set ResultTime = 0.0
        set AimX = 0.0
        set AimHeight = 0.65
        Game.CancelCharge()

    CycleCamera(A:agent):void =
        set SelectedView = if (SelectedView = fp_view.OverheadAerial) then fp_view.BehindPlayer else if (SelectedView = fp_view.BehindPlayer) then fp_view.GoalieFPV else fp_view.OverheadAerial
        if (Owns(A)?, Running?, Game.Mode = fp_mode.StandardHockey):
            Game.SetView(SelectedView)
            ClearInput()
            ApplyCamera(A)
            UpdateVisuals()

    OnShootPressed(A:agent):void =
        if (Accepts(A)?, not Command.ShootHeld?):
            set Command.ShootDown = true
            set Command.ShootHeld = true
            set ShotPressedAt = GetSimulationElapsedTime()
            set MissingReleaseTime = 0.0

    OnShootReleased(E:tuple(agent, float)):void =
        if (Accepts(E(0))?, Command.ShootHeld?):
            # Ignore a stale long release delivered after a reset and a new press.
            Age := Max(0.0, GetSimulationElapsedTime() - ShotPressedAt)
            if (E(1) <= Age + 0.25):
                set Command.ShootHeld = false
                set Command.ShootUp = true
                set Command.ReleaseSeconds = FPClamp(E(1), 0.0, 3.0)

    OnQuickShot(A:agent):void =
        if (Accepts(A)?):
            set Command.QuickShot = true
    OnPass(A:agent):void =
        if (Accepts(A)?):
            set Command.Pass = true
    OnSwitch(A:agent):void =
        if (Accepts(A)?):
            set Command.Switch = true
    OnCheck(A:agent):void =
        if (Accepts(A)?):
            set Command.Check = true

    SampleInput(A:agent, Dt:float):void =
        X := (if (MoveRight.IsHeld[A]) then 1.0 else 0.0) - (if (MoveLeft.IsHeld[A]) then 1.0 else 0.0)
        Y := (if (MoveForward.IsHeld[A]) then 1.0 else 0.0) - (if (MoveBack.IsHeld[A]) then 1.0 else 0.0)
        set Command.Sprint = logic{Sprint.IsHeld[A]}
        if (AimModifier.IsHeld[A]):
            set AimX = FPClamp(AimX + X * Dt * 2.2, -2.4, 2.4)
            set AimHeight = FPClamp(AimHeight + Y * Dt, 0.12, 1.50)
            set Command.Move = fp_vec2{}
        else:
            S := Game.Sign(0)
            set Command.Move = if (Game.View = fp_view.OverheadAerial and Game.Mode = fp_mode.StandardHockey) then FPV(X, Y) else FPV(X * S, Y * S)
        if (Athlete := Game.Athletes[Game.Controlled]):
            set Command.Aim = FPNorm(FPSub(FPV(AimX, Game.Sign(0) * Game.Rules.GoalLine), Athlete.Position))
            set Command.AimHeight = AimHeight
        # Two-stage grace avoids treating a not-yet-updated device state as a release.
        if (Command.ShootHeld?, GetSimulationElapsedTime() - ShotPressedAt > 0.15):
            if (not Shoot.IsHeld[A]):
                set MissingReleaseTime += Dt
                if (MissingReleaseTime >= 0.10):
                    set Command.ShootHeld = false
                    set Command.ShootUp = true
            else:
                set MissingReleaseTime = 0.0

    World(P:fp_vec2, Height:float)<transacts>:vector3 =
        vector3{X := RinkOrigin.X + P.Y * 100.0, Y := RinkOrigin.Y + P.X * 100.0, Z := RinkOrigin.Z + Height * 100.0}

    FirstPerson()<transacts>:logic = logic{Game.Mode <> fp_mode.StandardHockey or Game.View = fp_view.GoalieFPV}

    UpdateVisuals():void =
        for (I -> Athlete : Game.Athletes):
            if (P := Proxies[I], P.IsValid[]):
                if (Athlete.Active?, not (I = Game.Controlled and FirstPerson()?)):
                    P.Show()
                    Yaw := ArcTan(Athlete.Facing.X, Athlete.Facing.Y) * 57.2957795
                    if (P.TeleportTo[World(Athlete.Position, 0.0), MakeRotationFromYawPitchRollDegrees(Yaw, 0.0, 0.0)]) {}
                else:
                    P.Hide()
        if (P := PuckVisual?, P.IsValid[]):
            if (P.TeleportTo[World(Game.Puck.Position, Game.Puck.Height), MakeRotationFromYawPitchRollDegrees(0.0, 0.0, 0.0)]) {}
        if (P := AimVisual?, P.IsValid[]):
            if (P.TeleportTo[World(FPV(AimX, Game.Sign(0) * Game.Rules.GoalLine), AimHeight), MakeRotationFromYawPitchRollDegrees(0.0, 0.0, 0.0)]) {}

    ApplyCamera(A:agent):void =
        AerialCamera.RemoveFrom(A)
        BehindCamera.RemoveFrom(A)
        FirstPersonCamera.RemoveFrom(A)
        if (FirstPerson()?):
            FirstPersonCamera.Enable()
            FirstPersonCamera.AddTo(A)
        else if (Game.View = fp_view.BehindPlayer):
            BehindCamera.Enable()
            BehindCamera.AddTo(A)
        else:
            AerialCamera.Enable()
            AerialCamera.AddTo(A)

    UpdateCamera(A:agent):void =
        if (Athlete := Game.Athletes[Game.Controlled]):
            S := Game.Sign(0)
            Yaw := if (S > 0.0) then 0.0 else 180.0
            if (FirstPerson()? ):
                if (FirstPersonCamera.TeleportTo[World(Athlete.Position, 1.65), MakeRotationFromYawPitchRollDegrees(Yaw, -12.0, 0.0)]) {}
            else if (Game.View = fp_view.BehindPlayer):
                P := FPSub(Athlete.Position, FPV(0.0, 6.2 * S))
                if (BehindCamera.TeleportTo[World(P, 3.5), MakeRotationFromYawPitchRollDegrees(Yaw, -15.0, 0.0)]) {}
            else:
                P := FPV(0.0, -28.0 + FPClamp(Game.Puck.Position.Y * 0.35, -6.0, 6.0))
                if (AerialCamera.TeleportTo[World(P, 54.0), MakeRotationFromYawPitchRollDegrees(0.0, -63.0, 0.0)]) {}

    EmitAudio(A:agent):void =
        if (Game.ShotSerial > LastShot):
            for (S : ShotSounds):
                S.Play(A)
        if (Game.GoalSerial > LastGoal):
            for (S : GoalSounds):
                S.Play(A)
        if (Game.SaveSerial > LastSave):
            for (S : SaveSounds):
                S.Play(A)
        set LastShot = Game.ShotSerial
        set LastGoal = Game.GoalSerial
        set LastSave = Game.SaveSerial

    UpdateHUD(A:agent):void =
        if (Athlete := Game.Athletes[Game.Controlled]):
            var Power:int = 0
            var Seconds:int = 0
            if (V := Int[Game.Charge * 100.0]):
                set Power = V
            if (V := Int[Game.Remaining]):
                set Seconds = V
            Info := if (Game.Mode = fp_mode.StandardHockey) then "P{Game.Period} {Seconds}s | IRON PAW {Game.HomeScore} : {Game.AwayScore} CRIMSON DRAFT" else "TRAINING | Attempts {Game.Attempts} | Goals {Game.Goals} | Saves {Game.Saves}"
            Label := if (Game.Paused?) then "PAUSED - MENU OPEN" else Game.Message
            HUD.Show(A, FPText("{Info}\n{Athlete.Definition.DisplayName} #{Athlete.Definition.Jersey} | POWER {Power}%\n{Label}"), 0.0)
