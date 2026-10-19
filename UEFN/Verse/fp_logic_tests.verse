# Editor-run acceptance tests. AUTHORED, NOT EXECUTED in this chat environment.
# Build Verse, place one test device in a separate test island and Launch Session.
# Inspect the UEFN output log. Remove this device from the playable island.
using { /Fortnite.com/Devices }
using { /Verse.org/Simulation }
using { /Verse.org/Verse }

fp_logic_tests := class(creative_device):
    var Passed:int = 0
    var Failed:int = 0

    Expect(Name:string, Condition:logic):void =
        if (Condition?):
            set Passed += 1
            Print("PASS: {Name}")
        else:
            set Failed += 1
            Print("FAIL: {Name}")

    Fresh(Mode:fp_mode)<transacts>:fp_simulation =
        S := fp_simulation{Definitions := FPRoster(), Rules := fp_rules{EmptyTrainingNet := true}}
        S.Start(Mode, fp_view.OverheadAerial, 0)
        S

    OnBegin<override>()<suspends>:void =
        R := fp_rules{}
        Standard := Fresh(fp_mode.StandardHockey)
        Expect("Standard match has 12 athletes", logic{Standard.Athletes.Length = 12})
        var Skaters:int = 0
        var Keepers:int = 0
        for (A : Standard.Athletes):
            if (A.Keeper?):
                set Keepers += 1
            else:
                set Skaters += 1
        Expect("Ten skaters and two keepers", logic{Skaters = 10, Keepers = 2})
        var Unique:logic = true
        for (I -> A : Standard.Athletes, J -> B : Standard.Athletes):
            if (I <> J, A.Definition.Id = B.Definition.Id):
                set Unique = false
        Expect("No duplicate athlete identities", Unique)
        Standard.SetView(fp_view.GoalieFPV)
        Expect("FPV goalie controls home goalie", logic{Standard.Controlled = 5})
        Standard.SetView(fp_view.BehindPlayer)
        Expect("Behind-player restores skater", logic{Standard.Controlled = 0})

        Early := Fresh(fp_mode.FullRink)
        C := fp_command{ShootDown := true, ShootHeld := true}
        Early.Step(0.0166667, C)
        C.ClearEdges()
        for (I := 0..35):
            Early.Step(0.0166667, C)
        set C.ShootHeld = false
        set C.ShootUp = true
        Early.Step(0.0166667, C)
        Expect("Early full-rink release launches puck", logic{Early.Puck.Owner = -1, Early.Attempts = 1, Early.LastShotSpeed > 10.0})
        Expect("Early shot not qualified", logic{not Early.ShotQualified?, Early.EarlyShots = 1})
        Early.Resolve("GOAL!", true, false)
        Expect("Early shot gets no completion or goal credit", logic{Early.Goals = 0, Early.CompletedRuns = 0})
        Early.NextAttempt()
        Expect("Next attempt resets possession/readiness", logic{Early.Puck.Owner = 0, not Early.RunReady?})

        Full := Fresh(fp_mode.FullRink)
        Travel := fp_command{Move := FPV(0.0, 1.0)}
        for (I := 0..599):
            Full.Step(0.0166667, Travel)
        Expect("Manual skate qualifies full rink", logic{Full.RunReady?, Full.RunDistance >= 41.0})
        Travel.ClearEdges()
        set Travel.Move = fp_vec2{}
        set Travel.QuickShot = true
        Full.Step(0.0166667, Travel)
        Expect("Qualified run quick shot launches", logic{Full.Puck.Owner = -1, Full.ShotQualified?, Full.Attempts = 1})

        Stationary := Fresh(fp_mode.Stationary)
        for (I := 0..59):
            Stationary.Step(0.0166667, fp_command{Move := FPV(0.0, 1.0)})
        var Fixed:logic = false
        if (A := Stationary.Athletes[0]):
            set Fixed = logic{Abs(A.Position.Y - 13.0) < 0.001}
        Expect("Stationary drill cannot skate", Fixed)
        Stationary.Step(0.0166667, fp_command{ShootDown := true, ShootHeld := true})
        Stationary.Step(0.0166667, fp_command{})
        Expect("Missing release edge falls back to held state", logic{Stationary.Puck.Owner = -1})

        Expect("Puck must fully cross goal plane", logic{not FPValidGoal(FPV(0.0, 24.9), 0.12, FPV(0.0, 25.10), 0.12, 1.0, R)?})
        Expect("Clean crossing is a goal", FPValidGoal(FPV(0.0, 24.9), 0.12, FPV(0.0, 25.20), 0.12, 1.0, R))
        Expect("High shot is not a goal", logic{not FPValidGoal(FPV(0.0, 24.9), 2.0, FPV(0.0, 25.20), 2.0, 1.0, R)?})
        Expect("Wide shot is not a goal", logic{not FPValidGoal(FPV(3.0, 24.9), 0.12, FPV(3.0, 25.20), 0.12, 1.0, R)?})
        Expect("Reverse goal plane works", FPValidGoal(FPV(0.0, -24.9), 0.12, FPV(0.0, -25.20), 0.12, -1.0, R))
        set Standard.Period = 2
        Expect("Teams switch ends for second period", logic{Standard.Sign(0) = -1.0, Standard.Sign(1) = 1.0})
        set Standard.Paused = true
        T := Standard.Remaining
        Standard.Step(0.033333, fp_command{})
        Expect("Pause preserves clock", logic{Standard.Remaining = T})
        Tap := Fresh(fp_mode.Stationary)
        Tap.Step(0.0166667, fp_command{ShootDown := true, ShootUp := true, ReleaseSeconds := 0.02})
        Expect("Press and release within one update fires exactly once", logic{Tap.Attempts = 1, Tap.Puck.Owner = -1, Tap.ShotSerial = 1})
        Tap.Step(0.0166667, fp_command{ShootUp := true})
        Expect("Duplicate release cannot produce a second shot", logic{Tap.Attempts = 1})
        Tap.NextAttempt()
        Tap.Step(0.0166667, fp_command{ShootUp := true})
        Expect("Unarmed stale release after reset is ignored", logic{Tap.Puck.Owner = 0, not Tap.Charging?})
        Tap.Step(0.0166667, fp_command{QuickShot := true})
        Expect("Fresh quick shot after reset works", logic{Tap.Puck.Owner = -1, Tap.Attempts = 2})

        Turnover := Fresh(fp_mode.StandardHockey)
        set Turnover.Phase = fp_phase.Playing
        set Turnover.Puck.Owner = 0
        Turnover.Human(0.02, fp_command{ShootDown := true, ShootHeld := true})
        set Turnover.Puck.Owner = 1
        Turnover.Human(0.02, fp_command{ShootUp := true})
        Expect("Losing possession cancels charge without firing", logic{not Turnover.Charging?, Turnover.ShotSerial = 0})
        set Turnover.Puck.Owner = Turnover.Controlled
        Turnover.Human(0.02, fp_command{ShootDown := true, ShootHeld := true})
        Turnover.SetView(fp_view.GoalieFPV)
        Expect("Role switch cancels the previous player's charge", logic{not Turnover.Charging?, Turnover.ChargeOwner = -1})

        Broken := fp_simulation{Definitions := FPRoster(), Rules := fp_rules{AwayLineup := array{0, 12, 7, 13, 9, 11}}}
        Broken.Start(fp_mode.StandardHockey, fp_view.OverheadAerial, 0)
        Expect("Duplicate cross-team draft is rejected", logic{Broken.Phase = fp_phase.Finished, Broken.Athletes.Length = 0})
        WrongKeeper := fp_simulation{Definitions := FPRoster(), Rules := fp_rules{HomeLineup := array{0, 4, 3, 2, 5, 8}}}
        Expect("Skater in goalkeeper slot is rejected", logic{not WrongKeeper.ValidLineups()?})
        Short := fp_simulation{Definitions := FPRoster(), Rules := fp_rules{HomeLineup := array{0, 4, 3}}}
        Expect("Undersized lineup is rejected", logic{not Short.ValidLineups()?})

        KeeperDrill := Fresh(fp_mode.GoalieTraining)
        for (I := 0..180):
            KeeperDrill.Step(0.0166667, fp_command{})
        Expect("Goalie drill actually feeds a shot", logic{KeeperDrill.Attempts = 1, KeeperDrill.Delivered?})
        if (Keeper := KeeperDrill.Athletes[0]):
            set Keeper.Position = FPV(100.0, 100.0)
            KeeperDrill.ConstrainActor(Keeper)
            Expect("Goalie remains in crease after overlap correction", logic{Abs(Keeper.Position.X) <= 2.8, Keeper.Position.Y <= -21.9})

        Clock := Fresh(fp_mode.StandardHockey)
        set Clock.Phase = fp_phase.Playing
        set Clock.Remaining = 0.001
        Clock.Step(0.02, fp_command{})
        Expect("Period expiry advances period and enters intermission", logic{Clock.Period = 2, Clock.Phase = fp_phase.Intermission})
        set Clock.Phase = fp_phase.Playing
        set Clock.Period = 3
        set Clock.Remaining = 0.001
        Clock.Step(0.02, fp_command{})
        Expect("Third period ends the match", logic{Clock.Phase = fp_phase.Finished})

        Print("FROZEN PAWS VERSE CORE TESTS: {Passed} passed / {Failed} failed. This log is not a headset or publishing test.")
