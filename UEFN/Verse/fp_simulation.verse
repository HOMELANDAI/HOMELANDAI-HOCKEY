# HomelandAI Studios - Frozen Paws 0.4.0
# Engine-independent Verse rewrite. Not JavaScript/C# wrapped in a renamed file.
# Arcade exhibition: five skaters and one keeper on each team; local human + AI.
using { /Verse.org/Verse }

fp_simulation := class:
    Definitions:[]fp_definition = array{}
    Rules:fp_rules = fp_rules{}
    var Athletes:[]fp_athlete = array{}
    var Puck:fp_puck = fp_puck{}
    var Mode:fp_mode = fp_mode.StandardHockey
    var View:fp_view = fp_view.OverheadAerial
    var Phase:fp_phase = fp_phase.Faceoff
    var Controlled:int = 0
    var RememberedSkater:int = 0
    var HomeScore:int = 0
    var AwayScore:int = 0
    var HomeShots:int = 0
    var AwayShots:int = 0
    var HomeSaves:int = 0
    var AwaySaves:int = 0
    var Period:int = 1
    var Remaining:float = 120.0
    var PhaseTime:float = 0.0
    var Paused:logic = false
    var Charging:logic = false
    var Charge:float = 0.0
    var ChargeOwner:int = -1
    var ShotSerial:int = 0
    var GoalSerial:int = 0
    var SaveSerial:int = 0
    var ShotLive:logic = false
    var ShotAge:float = 0.0
    var ShotQualified:logic = false
    var RunReady:logic = false
    var RunDistance:float = 0.0
    var RunSeconds:float = 0.0
    var Attempts:int = 0
    var Goals:int = 0
    var Saves:int = 0
    var EarlyShots:int = 0
    var CompletedRuns:int = 0
    var FeedTime:float = 2.5
    var Delivered:logic = false
    var LastShotSpeed:float = 0.0
    var Message:string = "Ready"

    Sign(Team:int)<transacts>:float =
        Base := if (Team = 0) then 1.0 else -1.0
        if (Mode = fp_mode.StandardHockey, Period = 2):
            return -Base
        Base

    Add(DefinitionIndex:int, Team:int, Slot:int, Keeper:logic)<transacts>:void =
        if (D := Definitions[DefinitionIndex]):
            set Athletes += array{fp_athlete{Definition := D, Team := Team, Slot := Slot, Keeper := Keeper}}

    ValidLineups()<transacts>:logic =
        if (Rules.HomeLineup.Length <> 6 or Rules.AwayLineup.Length <> 6):
            return false
        All := Rules.HomeLineup + Rules.AwayLineup
        for (I -> Id : All):
            if (D := Definitions[Id]):
                KeeperSlot := logic{I = 5 or I = 11}
                if (KeeperSlot <> D.IsKeeper):
                    return false
            else:
                return false
            for (J -> Other : All):
                if (J > I, Other = Id):
                    return false
        true

    Start(NewMode:fp_mode, NewView:fp_view, TrainingIndex:int)<transacts>:void =
        set Mode = NewMode
        set View = NewView
        set Athletes = array{}
        set HomeScore = 0
        set AwayScore = 0
        set HomeShots = 0
        set AwayShots = 0
        set HomeSaves = 0
        set AwaySaves = 0
        set Period = 1
        set Remaining = Rules.PeriodSeconds
        set Attempts = 0
        set Goals = 0
        set Saves = 0
        set EarlyShots = 0
        set CompletedRuns = 0
        set Controlled = 0
        set RememberedSkater = 0
        set Paused = false
        set PhaseTime = 0.0
        set Puck = fp_puck{}
        CancelCharge()
        set RunReady = false
        set RunDistance = 0.0
        set RunSeconds = 0.0
        set ShotQualified = false
        set ShotLive = false
        set ShotAge = 0.0
        set Delivered = false
        set LastShotSpeed = 0.0
        set ShotSerial = 0
        set SaveSerial = 0
        set GoalSerial = 0
        if (Mode = fp_mode.StandardHockey):
            if (not ValidLineups()? ):
                set Phase = fp_phase.Finished
                set Message = "SETUP ERROR - INVALID OR DUPLICATE LINEUP"
                return
            for (Slot -> Id : Rules.HomeLineup):
                Add(Id, 0, Slot, logic{Slot = 5})
            for (Slot -> Id : Rules.AwayLineup):
                Add(Id, 1, Slot, logic{Slot = 5})
            if (View = fp_view.GoalieFPV):
                set Controlled = 5
            Faceoff()
        else if (Mode = fp_mode.GoalieTraining):
            KeeperIndex := if (TrainingIndex = 11) then 11 else 1
            Add(KeeperIndex, 0, 5, true)
            Add(7, 1, 0, false)
            NextAttempt()
        else:
            var Id:int = TrainingIndex
            if (Id = 1 or Id = 11 or Id < 0 or Id >= Definitions.Length):
                set Id = 0
            Add(Id, 0, 0, false)
            Add(11, 1, 5, true)
            if (Keeper := Athletes[1]):
                set Keeper.Active = logic{not Rules.EmptyTrainingNet?}
            NextAttempt()
        CancelCharge()

    CancelCharge()<transacts>:void =
        set Charging = false
        set Charge = 0.0
        set ChargeOwner = -1

    SetView(NewView:fp_view)<transacts>:void =
        if (Mode <> fp_mode.StandardHockey):
            return
        if (A := Athletes[Controlled], not A.Keeper?):
            set RememberedSkater = Controlled
        set View = NewView
        set Controlled = if (View = fp_view.GoalieFPV) then 5 else RememberedSkater
        CancelCharge()

    ResetActor(A:fp_athlete, P:fp_vec2)<transacts>:void =
        set A.Position = P
        set A.Home = P
        set A.Velocity = fp_vec2{}
        set A.Facing = FPV(0.0, Sign(A.Team))
        set A.Stamina = 1.0
        set A.Cooldown = 0.0
        set A.SaveTime = 0.0
        set A.Decision = 0.0

    ResetPuck(P:fp_vec2, Owner:int)<transacts>:void =
        set Puck = fp_puck{Position := P, Height := Rules.PuckRadius, Owner := Owner, LastTouch := Owner, PickupLock := 0.20}
        set ShotLive = false
        set ShotAge = 0.0

    Faceoff()<transacts>:void =
        for (A : Athletes):
            S := Sign(A.Team)
            var P:fp_vec2 = FPV(0.0, -S * 1.7)
            if (A.Keeper?):
                set P = FPV(0.0, -S * (Rules.GoalLine - 1.05))
            else if (A.Slot = 1 or A.Slot = 2):
                set P = FPV(if (A.Slot = 1) then -6.0 else 6.0, -S * 5.0)
            else if (A.Slot = 3 or A.Slot = 4):
                set P = FPV(if (A.Slot = 3) then -4.0 else 4.0, -S * 11.0)
            ResetActor(A, P)
        ResetPuck(fp_vec2{}, -1)
        set Phase = fp_phase.Faceoff
        set PhaseTime = 2.0
        set Message = "FACE-OFF"
        CancelCharge()

    NextAttempt()<transacts>:void =
        if (Mode = fp_mode.StandardHockey):
            return
        set RunReady = false
        set RunDistance = 0.0
        set RunSeconds = 0.0
        set ShotQualified = false
        set Delivered = false
        set FeedTime = 2.5
        set LastShotSpeed = 0.0
        set Paused = false
        if (A := Athletes[0], B := Athletes[1]):
            if (Mode = fp_mode.GoalieTraining):
                ResetActor(A, FPV(0.0, -Rules.GoalLine + 1.05))
                ResetActor(B, FPV(0.0, -Rules.GoalLine + 15.0))
                ResetPuck(B.Position, 1)
            else:
                StartY := if (Mode = fp_mode.FullRink) then Rules.TrainingStart else Rules.GoalLine - 12.0
                ResetActor(A, FPV(0.0, StartY))
                ResetActor(B, FPV(0.0, Rules.GoalLine - 1.05))
                ResetPuck(A.Position, 0)
        set Phase = fp_phase.Playing
        set Message = if (Mode = fp_mode.FullRink) then "SKATE THE FULL RINK, THEN RELEASE TO SHOOT" else "READY"
        CancelCharge()

    Step(Dt:float, C:fp_command)<transacts>:void =
        if (Paused? or Phase = fp_phase.Result or Phase = fp_phase.Finished or Dt <= 0.0 or Dt > 0.05):
            return
        if (Phase <> fp_phase.Playing):
            set PhaseTime -= Dt
            if (PhaseTime <= 0.0):
                if (Phase = fp_phase.Faceoff):
                    set Phase = fp_phase.Playing
                    set Message = "PLAY"
                else:
                    Faceoff()
            return
        if (C.Switch?, View <> fp_view.GoalieFPV, Mode = fp_mode.StandardHockey):
            SwitchSkater()
        Human(Dt, C)
        for (I -> A : Athletes):
            set A.Cooldown = Max(0.0, A.Cooldown - Dt)
            set A.SaveTime = Max(0.0, A.SaveTime - Dt)
            if (A.Active?):
                if (I <> Controlled):
                    AI(I, A, Dt)
                Integrate(I, A, Dt)
        SeparateAthletes()
        for (A : Athletes):
            ConstrainActor(A)
        StepPuck(Dt)
        if (Mode <> fp_mode.StandardHockey):
            set RunSeconds += Dt
        if (ShotLive?):
            set ShotAge += Dt
            if (Mode <> fp_mode.StandardHockey, ShotAge > 5.0):
                Resolve("MISS", false, false)
        if (Mode = fp_mode.GoalieTraining, not Delivered?):
            set FeedTime -= Dt
            if (FeedTime <= 0.0, Shooter := Athletes[1]):
                set Delivered = true
                # Predictable alternating placement is intentional for the first training slice.
                var Offset:float = 0.0
                if (Pattern := Mod[Attempts, 5]):
                    set Offset = if (Pattern = 0) then -0.95 else if (Pattern = 1) then 0.90 else if (Pattern = 2) then -0.55 else if (Pattern = 3) then 0.50 else 0.0
                Shoot(1, FPNorm(FPSub(FPV(Offset, -Rules.GoalLine), Shooter.Position)), 0.65, 0.45)
        if (Mode = fp_mode.StandardHockey, Phase = fp_phase.Playing):
            set Remaining = Max(0.0, Remaining - Dt)
            if (Remaining <= 0.0):
                set ShotLive = false
                CancelCharge()
                if (Period >= Rules.PeriodCount):
                    set Phase = fp_phase.Finished
                    set Message = if (HomeScore = AwayScore) then "FINAL - DRAW" else if (HomeScore > AwayScore) then "IRON PAW WINS" else "CRIMSON DRAFT WINS"
                else:
                    set Period += 1
                    set Remaining = Rules.PeriodSeconds
                    set Phase = fp_phase.Intermission
                    set PhaseTime = 3.0
                    set Message = "CHANGE ENDS - PERIOD {Period}"

    Human(Dt:float, C:fp_command)<transacts>:void =
        if (A := Athletes[Controlled]):
            Move := if (Mode = fp_mode.Stationary) then fp_vec2{} else FPLimit(C.Move)
            MoveActor(A, Move, C.Sprint, Dt)
            if (A.Keeper?):
                set A.Facing = FPV(0.0, Sign(A.Team))
                if (C.ShootDown? or C.QuickShot?, A.Cooldown <= 0.0):
                    set A.SaveTime = 0.42
                    set A.Cooldown = if (A.Definition.Id = "atlas") then 0.82 else 0.64
                    set Message = "SAVE ACTION"
                if (C.Pass?, Puck.Owner = Controlled):
                    PassPuck(Controlled)
                return
            if (C.Pass?, Mode = fp_mode.StandardHockey, Puck.Owner = Controlled):
                PassPuck(Controlled)
                CancelCharge()
            if (C.Check? or C.ShootDown?, Puck.Owner <> Controlled):
                CheckPuck(Controlled)
            if (C.QuickShot?, Puck.Owner = Controlled):
                Power := if (Charging?) then Charge else 0.48
                Shoot(Controlled, C.Aim, C.AimHeight, Power)
                CancelCharge()
                return
            if (Charging?, ChargeOwner <> Controlled or Puck.Owner <> ChargeOwner):
                CancelCharge()
            if (C.ShootDown?, Puck.Owner = Controlled):
                set Charging = true
                set ChargeOwner = Controlled
                set Charge = 0.0
            if (Charging?, C.ShootHeld?):
                set Charge = FPClamp(Charge + Dt / Rules.ChargeSeconds, 0.0, 1.0)
            # The duration provided by Input Trigger ReleasedEvent recovers short taps.
            if (C.ShootUp?, Charging?, ChargeOwner = Controlled, Puck.Owner = Controlled):
                set Charge = Max(Charge, FPClamp(C.ReleaseSeconds / Rules.ChargeSeconds, 0.0, 1.0))
            if (Charging?, C.ShootUp? or (not C.ShootHeld? and not C.ShootDown?)):
                Shoot(Controlled, C.Aim, C.AimHeight, Charge)
                CancelCharge()
            if (Puck.Owner <> Controlled):
                CancelCharge()

    MoveActor(A:fp_athlete, Direction:fp_vec2, Sprint:logic, Dt:float)<transacts>:void =
        D := A.Definition
        var Speed:float = 4.8 + D.SPD * 0.055
        if (A.Keeper?):
            set Speed = if (D.Id = "atlas") then 3.7 else 4.8
        if (Carrier := Athletes[Puck.Owner], Carrier.Definition.Id = D.Id):
            set Speed *= 0.91 + D.HND * 0.0006
        Boost := logic{Sprint?, A.Stamina > 0.12, not A.Keeper?, FPLen(Direction) > 0.25}
        if (Boost?):
            set Speed *= 1.20
        set Speed *= 0.65 + 0.35 * A.Stamina
        Acceleration := if (FPLen(Direction) < 0.08) then 6.0 else 3.0 + D.ACC * 0.12
        set A.Velocity = FPToward(A.Velocity, FPMul(Direction, Speed), Acceleration * Dt)
        if (FPLen(Direction) > 0.12, not A.Keeper?):
            Alpha := FPClamp(Dt * (2.0 + D.AGI * 0.045), 0.0, 1.0)
            Facing := FPNorm(FPAdd(FPMul(A.Facing, 1.0 - Alpha), FPMul(Direction, Alpha)))
            if (FPLen(Facing) > 0.01):
                set A.Facing = Facing
        Cost := if (Boost?) then -0.20 * (1.25 - D.STA * 0.006) else 0.075
        set A.Stamina = FPClamp(A.Stamina + Dt * Cost, 0.0, 1.0)

    Integrate(I:int, A:fp_athlete, Dt:float)<transacts>:void =
        Previous := A.Position
        P := FPAdd(A.Position, FPMul(A.Velocity, Dt))
        R := A.Radius()
        set A.Position = FPV(FPClamp(P.X, -Rules.HalfWidth + R, Rules.HalfWidth - R), FPClamp(P.Y, -Rules.HalfLength + R, Rules.HalfLength - R))
        if (A.Keeper?):
            S := Sign(A.Team)
            set A.Position = FPV(FPClamp(A.Position.X, -2.8, 2.8), FPClamp(A.Position.Y * S, -Rules.GoalLine + 0.35, -Rules.GoalLine + 3.1) * S)
        if (Mode = fp_mode.Stationary, I = Controlled):
            set A.Position = A.Home
            set A.Velocity = fp_vec2{}
        if (Mode = fp_mode.FullRink, I = Controlled, Puck.Owner = I):
            set A.Position = FPV(A.Position.X, Min(A.Position.Y, Rules.GoalLine - 2.1))
            set RunDistance += FPDist(Previous, A.Position)
            if (A.Position.Y >= Rules.TrainingFarLine, RunDistance >= Rules.TrainingFarLine - Rules.TrainingStart - 1.0):
                set RunReady = true
                set Message = "FULL RUN COMPLETE - RELEASE TO SHOOT"

    ConstrainActor(A:fp_athlete)<transacts>:void =
        R := A.Radius()
        P := A.Position
        set A.Position = FPV(FPClamp(P.X, -Rules.HalfWidth + R, Rules.HalfWidth - R), FPClamp(P.Y, -Rules.HalfLength + R, Rules.HalfLength - R))
        if (A.Keeper?):
            S := Sign(A.Team)
            set A.Position = FPV(FPClamp(A.Position.X, -2.8, 2.8), FPClamp(A.Position.Y * S, -Rules.GoalLine + 0.35, -Rules.GoalLine + 3.1) * S)
        if (A.Position.X <> P.X):
            set A.Velocity = FPV(0.0, A.Velocity.Y)
        if (A.Position.Y <> P.Y):
            set A.Velocity = FPV(A.Velocity.X, 0.0)

    Nearest(Team:int)<transacts>:int =
        var Best:int = -1
        var Distance:float = 100000.0
        for (I -> A : Athletes):
            if (A.Team = Team, not A.Keeper?, A.Active?):
                D := FPDist(A.Position, Puck.Position)
                if (D < Distance):
                    set Distance = D
                    set Best = I
        Best

    SwitchSkater()<transacts>:void =
        var Next:int = Nearest(0)
        if (Carrier := Athletes[Puck.Owner], Carrier.Team = 0, not Carrier.Keeper?):
            set Next = Puck.Owner
        if (Next = Controlled):
            set Next = if (Controlled >= 4) then 0 else Controlled + 1
        if (Next >= 0):
            set Controlled = Next
            set RememberedSkater = Next
            CancelCharge()

    AI(I:int, A:fp_athlete, Dt:float)<transacts>:void =
        S := Sign(A.Team)
        if (A.Keeper?):
            Target := FPV(FPClamp(Puck.Position.X * 0.22, -1.45, 1.45), -S * (Rules.GoalLine - 1.05))
            MoveActor(A, FPLimit(FPMul(FPSub(Target, A.Position), 1.8)), false, Dt)
            set A.Facing = FPV(0.0, S)
            if (ShotLive?, FPDist(Puck.Position, A.Position) < 7.0, A.Cooldown <= 0.0):
                set A.SaveTime = 0.35 + Rules.Difficulty * 0.20
                set A.Cooldown = 0.85
            if (Puck.Owner = I, Mode = fp_mode.StandardHockey, A.Cooldown <= 0.0):
                PassPuck(I)
            return
        if (Mode = fp_mode.GoalieTraining or Mode = fp_mode.Stationary or Mode = fp_mode.FullRink):
            return
        set A.Decision -= Dt
        var Target:fp_vec2 = A.Home
        if (Puck.Owner = I):
            set Target = FPV(FPClamp(A.Position.X * 0.75, -5.0, 5.0), S * (Rules.GoalLine - 4.0))
            if (A.Decision <= 0.0):
                set A.Decision = 0.8
                DistanceToGoal := Rules.GoalLine - A.Position.Y * S
                if (DistanceToGoal < 17.0):
                    Offset := if (A.Slot = 1 or A.Slot = 3) then -0.90 else 0.90
                    Shoot(I, FPNorm(FPSub(FPV(Offset, S * Rules.GoalLine), A.Position)), 0.70, 0.35 + A.Definition.SHT * 0.004)
                else if (A.Definition.IQ >= 85.0, FPDist(A.Position, Puck.Position) < 1.8):
                    if (Opponent := Athletes[Nearest(1 - A.Team)], FPDist(Opponent.Position, A.Position) < 2.5):
                        PassPuck(I)
        else if (I = Nearest(A.Team)):
            set Target = Puck.Position
            if (FPDist(A.Position, Puck.Position) < 1.65, A.Cooldown <= 0.0):
                CheckPuck(I)
        else:
            Lane := if (A.Slot = 1 or A.Slot = 3) then -5.0 else if (A.Slot = 2 or A.Slot = 4) then 5.0 else 0.0
            Offset := if (A.Slot >= 3) then -8.0 else 1.5
            set Target = FPV(Lane, FPClamp(Puck.Position.Y + Offset * S, -20.0, 20.0))
        MoveActor(A, FPLimit(FPSub(Target, A.Position)), false, Dt)

    SeparateAthletes()<transacts>:void =
        for (I -> A : Athletes, J -> B : Athletes):
            if (J > I, A.Active?, B.Active?):
                Delta := FPSub(B.Position, A.Position)
                D := FPLen(Delta)
                Required := A.Radius() + B.Radius()
                if (D < Required):
                    N := if (D < 0.0001) then FPV(1.0, 0.0) else FPNorm(Delta)
                    Overlap := Required - D
                    if (A.Keeper? or (Mode = fp_mode.Stationary and I = Controlled)):
                        set B.Position = FPAdd(B.Position, FPMul(N, Overlap))
                    else if (B.Keeper?):
                        set A.Position = FPSub(A.Position, FPMul(N, Overlap))
                    else:
                        set A.Position = FPSub(A.Position, FPMul(N, Overlap * 0.5))
                        set B.Position = FPAdd(B.Position, FPMul(N, Overlap * 0.5))

    CheckPuck(I:int)<transacts>:void =
        if (A := Athletes[I], A.Cooldown <= 0.0, FPDist(A.Position, Puck.Position) < 1.70, Puck.Height < 0.50):
            set A.Cooldown = 0.65
            if (Carrier := Athletes[Puck.Owner], Carrier.Team <> A.Team):
                set Puck.Owner = -1
                set Puck.Velocity = FPMul(A.Facing, 5.0)
                set Puck.PickupLock = 0.15
                set Message = "POKE CHECK"

    PassPuck(I:int)<transacts>:void =
        if (A := Athletes[I], Puck.Owner = I):
            var Best:int = -1
            var Distance:float = 100000.0
            for (J -> B : Athletes):
                if (J <> I, B.Team = A.Team, not B.Keeper?, B.Active?):
                    D := FPDist(A.Position, B.Position)
                    if (D < Distance, D > 1.5):
                        set Distance = D
                        set Best = J
            if (B := Athletes[Best]):
                Direction := FPNorm(FPSub(FPAdd(B.Position, FPMul(B.Velocity, 0.2)), A.Position))
                set Puck.Position = FPAdd(A.Position, FPMul(Direction, 1.0))
                set Puck.Velocity = FPMul(Direction, FPClamp(Distance * 1.35, 9.0, 18.0))
                set Puck.Height = Rules.PuckRadius
                set Puck.VerticalVelocity = 0.0
                set Puck.Owner = -1
                set Puck.LastTouch = I
                set Puck.PickupLock = 0.25
                set ShotLive = false
                set A.Cooldown = 0.3
                set Message = "PASS"

    Shoot(I:int, Aim:fp_vec2, Height:float, Power:float)<transacts>:void =
        if (A := Athletes[I], Puck.Owner = I):
            Direction := if (FPLen(Aim) > 0.01) then FPNorm(Aim) else FPV(0.0, Sign(A.Team))
            Speed := (13.0 + FPClamp(Power, 0.0, 1.0) * 18.0) * (0.85 + A.Definition.SHT * 0.003)
            set Puck.Position = FPAdd(A.Position, FPMul(Direction, 1.0))
            set Puck.Velocity = FPMul(Direction, Speed)
            set Puck.Height = Rules.PuckRadius
            Distance := Max(1.0, FPDist(Puck.Position, FPV(0.0, Sign(A.Team) * Rules.GoalLine)))
            Flight := FPClamp(Distance / Speed, 0.05, 3.5)
            set Puck.VerticalVelocity = FPClamp((FPClamp(Height, 0.12, 1.50) - Rules.PuckRadius + 4.905 * Flight * Flight) / Flight, 0.0, 15.0)
            set Puck.Owner = -1
            set Puck.LastTouch = I
            set Puck.PickupLock = 0.32
            set ShotLive = true
            set ShotAge = 0.0
            set LastShotSpeed = Speed
            set ShotSerial += 1
            set ShotQualified = logic{Mode <> fp_mode.FullRink or RunReady?}
            if (Mode = fp_mode.StandardHockey):
                if (A.Team = 0):
                    set HomeShots += 1
                else:
                    set AwayShots += 1
            else:
                set Attempts += 1
                if (not ShotQualified?):
                    set EarlyShots += 1
            set Message = if (ShotQualified?) then "SHOT RELEASED" else "EARLY SHOT - RUN NOT COMPLETE"

    StepPuck(Dt:float)<transacts>:void =
        set Puck.PickupLock = Max(0.0, Puck.PickupLock - Dt)
        if (A := Athletes[Puck.Owner]):
            Old := Puck.Position
            set Puck.Position = FPAdd(A.Position, FPMul(A.Facing, 0.95))
            set Puck.Height = Rules.PuckRadius
            set Puck.Velocity = A.Velocity
            set Puck.VerticalVelocity = 0.0
            if (Mode = fp_mode.StandardHockey):
                CheckGoal(Old, Rules.PuckRadius)
            return
        H := Dt / 5.0
        for (Substep := 0..4):
            if (Phase <> fp_phase.Playing):
                return
            Old := Puck.Position
            OldH := Puck.Height
            set Puck.Position = FPAdd(Puck.Position, FPMul(Puck.Velocity, H))
            set Puck.Height += Puck.VerticalVelocity * H - 4.905 * H * H
            set Puck.VerticalVelocity -= 9.81 * H
            if (Puck.Height < Rules.PuckRadius):
                set Puck.Height = Rules.PuckRadius
                set Puck.VerticalVelocity = if (Abs(Puck.VerticalVelocity) < 1.0) then 0.0 else Abs(Puck.VerticalVelocity) * 0.25
                set Puck.Velocity = FPMul(Puck.Velocity, Max(0.0, 1.0 - H * 0.13))
            HitPosts(Old, OldH)
            CollideAthletes(Old, OldH)
            if (Puck.Owner >= 0 or Phase <> fp_phase.Playing):
                return
            CheckGoal(Old, OldH)
            if (Phase <> fp_phase.Playing):
                return
            XLimit := Rules.HalfWidth - Rules.PuckRadius
            YLimit := Rules.HalfLength - Rules.PuckRadius
            if (Abs(Puck.Position.X) > XLimit):
                set Puck.Position = FPV(FPClamp(Puck.Position.X, -XLimit, XLimit), Puck.Position.Y)
                set Puck.Velocity = FPV(-Puck.Velocity.X * 0.78, Puck.Velocity.Y)
            if (Abs(Puck.Position.Y) > YLimit):
                set Puck.Position = FPV(Puck.Position.X, FPClamp(Puck.Position.Y, -YLimit, YLimit))
                set Puck.Velocity = FPV(Puck.Velocity.X, -Puck.Velocity.Y * 0.78)
                if (Mode <> fp_mode.StandardHockey, ShotLive?):
                    Resolve("MISS", false, false)

    HitPosts(Old:fp_vec2, OldHeight:float)<transacts>:void =
        for (S : array{-1.0, 1.0}, Side : array{-1.0, 1.0}):
            Post := FPV(Side * Rules.GoalHalfWidth, S * Rules.GoalLine)
            T := FPSegmentT(Old, Puck.Position, Post)
            Point := FPAdd(Old, FPMul(FPSub(Puck.Position, Old), T))
            H := OldHeight + (Puck.Height - OldHeight) * T
            if (FPDist(Point, Post) < Rules.PuckRadius + 0.07, H < Rules.GoalHeight + Rules.PuckRadius):
                N := if (FPDist(Old, Post) < 0.00001) then FPV(0.0, -S) else FPNorm(FPSub(Old, Post))
                set Puck.Position = FPAdd(Post, FPMul(N, Rules.PuckRadius + 0.075))
                Along := FPDot(Puck.Velocity, N)
                if (Along < 0.0):
                    set Puck.Velocity = FPSub(Puck.Velocity, FPMul(N, Along * 1.75))
        DeltaY := Puck.Position.Y - Old.Y
        if (Abs(DeltaY) > 0.000001):
            for (S : array{-1.0, 1.0}):
                T := (S * Rules.GoalLine - Old.Y) / DeltaY
                if (T >= 0.0, T <= 1.0):
                    H := OldHeight + (Puck.Height - OldHeight) * T
                    X := Old.X + (Puck.Position.X - Old.X) * T
                    if (Abs(X) <= Rules.GoalHalfWidth, Abs(H - Rules.GoalHeight) < Rules.PuckRadius + 0.07):
                        set Puck.Position = Old
                        set Puck.Velocity = FPV(Puck.Velocity.X, -Puck.Velocity.Y * 0.72)

    CollideAthletes(Old:fp_vec2, OldHeight:float)<transacts>:void =
        for (I -> A : Athletes):
            Skip := logic{not A.Active? or (I = Puck.LastTouch and Puck.PickupLock > 0.0)}
            if (not Skip?):
                Reach := A.Radius() + (if (A.Keeper?, A.SaveTime > 0.0) then 0.52 else 0.0)
                T := FPSegmentT(Old, Puck.Position, A.Position)
                Point := FPAdd(Old, FPMul(FPSub(Puck.Position, Old), T))
                H := OldHeight + (Puck.Height - OldHeight) * T
                MaxHeight := if (A.Keeper?) then (if (A.SaveTime > 0.0) then 1.50 else 1.0) else 0.70
                if (FPDist(Point, A.Position) <= Reach + Rules.PuckRadius, H <= MaxHeight):
                    PickupSpeed := if (A.Keeper?) then 4.2 else 13.0
                    if (FPLen(Puck.Velocity) < PickupSpeed, H < 0.42, Puck.PickupLock <= 0.0):
                        set Puck.Owner = I
                        set Puck.LastTouch = I
                        if (ShotLive?, A.Keeper?):
                            set SaveSerial += 1
                            if (A.Team = 0):
                                set HomeSaves += 1
                            else:
                                set AwaySaves += 1
                        if (Mode <> fp_mode.StandardHockey, ShotLive?):
                            Resolve("PUCK COVERED", false, A.Keeper)
                        else:
                            set ShotLive = false
                        return
                    N := if (FPDist(Old, A.Position) < 0.00001) then A.Facing else FPNorm(FPSub(Old, A.Position))
                    set Puck.Position = FPAdd(A.Position, FPMul(N, Reach + Rules.PuckRadius + 0.02))
                    Along := FPDot(Puck.Velocity, N)
                    if (Along < 0.0):
                        set Puck.Velocity = FPSub(Puck.Velocity, FPMul(N, Along * 1.55))
                    set Puck.Velocity = FPMul(Puck.Velocity, if (A.Keeper?) then 0.48 else 0.80)
                    set Puck.LastTouch = I
                    set Puck.PickupLock = 0.12
                    if (A.Keeper?, ShotLive?):
                        set SaveSerial += 1
                        if (Mode <> fp_mode.StandardHockey):
                            Resolve("SAVED", false, true)
                        else:
                            if (A.Team = 0):
                                set HomeSaves += 1
                            else:
                                set AwaySaves += 1
                            set ShotLive = false
                            set Message = "SAVE"
                    return

    CheckGoal(Old:fp_vec2, OldHeight:float)<transacts>:void =
        for (S : array{-1.0, 1.0}):
            if (FPValidGoal(Old, OldHeight, Puck.Position, Puck.Height, S, Rules)?):
                set GoalSerial += 1
                Team := if (S = Sign(0)) then 0 else 1
                if (Mode = fp_mode.StandardHockey):
                    if (Team = 0):
                        set HomeScore += 1
                    else:
                        set AwayScore += 1
                    set Puck.Velocity = fp_vec2{}
                    set ShotLive = false
                    set Phase = fp_phase.Goal
                    set PhaseTime = 3.0
                    set Message = "GOAL!"
                    CancelCharge()
                else:
                    Resolve(if (Team = 0) then "GOAL!" else "GOAL ALLOWED", true, false)
                return

    Resolve(Text:string, Goal:logic, Save:logic)<transacts>:void =
        if (Phase = fp_phase.Result or not ShotLive?):
            return
        set Phase = fp_phase.Result
        set ShotLive = false
        set Message = Text
        if (Mode = fp_mode.FullRink, not ShotQualified?):
            set Message = "EARLY SHOT - COMPLETE THE SKATE"
        else:
            if (Goal?):
                set Goals += 1
            if (Save?):
                set Saves += 1
            if (Mode = fp_mode.FullRink):
                set CompletedRuns += 1
        CancelCharge()
