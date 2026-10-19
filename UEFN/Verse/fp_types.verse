# HomelandAI Studios - ICE HOCKEY LAKE: FROZEN PAWS EDITION
# UEFN / Verse source implementation 0.4.0. Source only; not compiled in UEFN here.
# Core coordinates are metres: X = across rink, Y = along rink. No engine objects.
using { /Verse.org/Verse }

fp_mode := enum{StandardHockey, Stationary, GoalieTraining, FullRink}
fp_view := enum{BehindPlayer, GoalieFPV, OverheadAerial}
fp_phase := enum{Faceoff, Playing, Goal, Intermission, Result, Finished}

fp_vec2 := struct<concrete>:
    X:float = 0.0
    Y:float = 0.0

FPV(X:float, Y:float)<transacts>:fp_vec2 = fp_vec2{X := X, Y := Y}
FPAdd(A:fp_vec2, B:fp_vec2)<transacts>:fp_vec2 = FPV(A.X + B.X, A.Y + B.Y)
FPSub(A:fp_vec2, B:fp_vec2)<transacts>:fp_vec2 = FPV(A.X - B.X, A.Y - B.Y)
FPMul(A:fp_vec2, S:float)<transacts>:fp_vec2 = FPV(A.X * S, A.Y * S)
FPDot(A:fp_vec2, B:fp_vec2)<transacts>:float = A.X * B.X + A.Y * B.Y
FPLen(A:fp_vec2)<transacts>:float = Sqrt(FPDot(A, A))
FPDist(A:fp_vec2, B:fp_vec2)<transacts>:float = FPLen(FPSub(A, B))
FPClamp(X:float, Lo:float, Hi:float)<transacts>:float = Max(Lo, Min(Hi, X))
FPNorm(A:fp_vec2)<transacts>:fp_vec2 =
    L := FPLen(A)
    if (L > 0.000001):
        return FPMul(A, 1.0 / L)
    FPV(0.0, 0.0)
FPLimit(A:fp_vec2)<transacts>:fp_vec2 =
    if (FPLen(A) > 1.0):
        return FPNorm(A)
    A
FPToward(A:fp_vec2, B:fp_vec2, D:float)<transacts>:fp_vec2 =
    if (FPDist(A, B) <= D):
        return B
    FPAdd(A, FPMul(FPNorm(FPSub(B, A)), D))
FPSegmentT(A:fp_vec2, B:fp_vec2, P:fp_vec2)<transacts>:float =
    Delta := FPSub(B, A)
    D := FPDot(Delta, Delta)
    if (D < 0.000001):
        return 0.0
    FPClamp(FPDot(FPSub(P, A), Delta) / D, 0.0, 1.0)

fp_definition := class<concrete>:
    Index:int = 0
    Id:string = "rocky"
    DisplayName:string = "Rocky"
    Breed:string = "Golden Retriever"
    OriginalFaction:string = "Iron Paw Alliance"
    HelmetFamily:string = "Radiant Captain"
    Jersey:int = 9
    ACC:float = 78.0
    SPD:float = 76.0
    AGI:float = 76.0
    PWR:float = 88.0
    STA:float = 85.0
    IQ:float = 91.0
    HND:float = 84.0
    SHT:float = 85.0
    IsKeeper:logic = false

fp_athlete := class<concrete>:
    Definition:fp_definition = fp_definition{}
    Team:int = 0
    Slot:int = 0
    Keeper:logic = false
    var Active:logic = true
    var Position:fp_vec2 = fp_vec2{}
    var Velocity:fp_vec2 = fp_vec2{}
    var Facing:fp_vec2 = fp_vec2{Y := 1.0}
    var Home:fp_vec2 = fp_vec2{}
    var Stamina:float = 1.0
    var Cooldown:float = 0.0
    var SaveTime:float = 0.0
    var Decision:float = 0.0
    Radius()<transacts>:float =
        if (Keeper?):
            return 0.60
        0.38 + 0.17 * Definition.PWR / 100.0

fp_command := class<concrete>:
    var Move:fp_vec2 = fp_vec2{}
    var Aim:fp_vec2 = fp_vec2{Y := 1.0}
    var AimHeight:float = 0.65
    var ShootDown:logic = false
    var ShootHeld:logic = false
    var ShootUp:logic = false
    var ReleaseSeconds:float = 0.0
    var QuickShot:logic = false
    var Pass:logic = false
    var Switch:logic = false
    var Check:logic = false
    var Sprint:logic = false
    ClearEdges()<transacts>:void =
        set ShootDown = false
        set ShootUp = false
        set ReleaseSeconds = 0.0
        set QuickShot = false
        set Pass = false
        set Switch = false
        set Check = false

fp_puck := class<concrete>:
    var Position:fp_vec2 = fp_vec2{}
    var Velocity:fp_vec2 = fp_vec2{}
    var Height:float = 0.12
    var VerticalVelocity:float = 0.0
    var Owner:int = -1
    var LastTouch:int = -1
    var PickupLock:float = 0.0

fp_rules := class<concrete>:
    HalfWidth:float = 14.5
    HalfLength:float = 29.0
    GoalLine:float = 25.0
    GoalHalfWidth:float = 1.9
    GoalHeight:float = 1.65
    PuckRadius:float = 0.12
    PeriodSeconds:float = 120.0
    PeriodCount:int = 3
    TrainingStart:float = -24.0
    TrainingFarLine:float = 18.0
    ChargeSeconds:float = 1.2
    EmptyTrainingNet:logic = true
    Difficulty:float = 0.6
    HomeLineup:[]int = array{0, 4, 3, 2, 5, 1}
    AwayLineup:[]int = array{6, 12, 7, 13, 9, 11}

FPValidGoal(From:fp_vec2, FromHeight:float, To:fp_vec2, ToHeight:float, Direction:float, R:fp_rules)<transacts>:logic =
    Plane := R.GoalLine + R.PuckRadius
    A := From.Y * Direction
    B := To.Y * Direction
    if (A > Plane or B <= Plane or B <= A):
        return false
    T := (Plane - A) / (B - A)
    X := From.X + (To.X - From.X) * T
    H := FromHeight + (ToHeight - FromHeight) * T
    if (Abs(X) <= R.GoalHalfWidth - R.PuckRadius, H >= R.PuckRadius - 0.00001, H + R.PuckRadius <= R.GoalHeight):
        return true
    false
