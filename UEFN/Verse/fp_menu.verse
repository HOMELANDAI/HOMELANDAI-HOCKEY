# Native Verse menu; no embedded browser or external web UI.
using { /Fortnite.com/UI }
using { /Verse.org/Simulation }
using { /Verse.org/Verse }
using { /Verse.org/Colors }
using { /UnrealEngine.com/Temporary/UI }
using { /UnrealEngine.com/Temporary/SpatialMath }

fp_menu := class:
    Controller:fp_hockey_device
    ForPlayer:player
    var Root:?canvas = false
    var Subscriptions:[]cancelable = array{}
    ViewButton:button_regular = button_regular{}
    AthleteButton:button_regular = button_regular{}
    GoalieButton:button_regular = button_regular{}
    KitButton:button_regular = button_regular{}
    NetButton:button_regular = button_regular{}
    DifficultyButton:button_regular = button_regular{}
    StatusText:text_block = text_block{DefaultTextSize := 18.0}

    Open():void =
        Standard := button_loud{DefaultText := FPText("STANDARD HOCKEY - 5 SKATERS + GOALIE PER TEAM")}
        Stationary := button_regular{DefaultText := FPText("FPV TRAINING - STATIONARY SHOOTING")}
        Goalie := button_regular{DefaultText := FPText("FPV TRAINING - GOALTENDING")}
        Full := button_regular{DefaultText := FPText("FPV TRAINING - FULL-LENGTH SKATE & SHOOT")}
        ResumeButton := button_quiet{DefaultText := FPText("RESUME CURRENT GAME")}
        ExitButton := button_quiet{DefaultText := FPText("RETURN TO LOBBY")}
        set Subscriptions = array:
            Standard.OnClick().Subscribe(StartStandard)
            Stationary.OnClick().Subscribe(StartStationary)
            Goalie.OnClick().Subscribe(StartGoalie)
            Full.OnClick().Subscribe(StartFull)
            ResumeButton.OnClick().Subscribe(Resume)
            ExitButton.OnClick().Subscribe(Exit)
            ViewButton.OnClick().Subscribe(ChangeView)
            AthleteButton.OnClick().Subscribe(ChangeAthlete)
            GoalieButton.OnClick().Subscribe(ChangeGoalie)
            KitButton.OnClick().Subscribe(ChangeKit)
            NetButton.OnClick().Subscribe(ChangeNet)
            DifficultyButton.OnClick().Subscribe(ChangeDifficulty)
        Refresh()
        Panel := stack_box:
            Orientation := orientation.Vertical
            Slots := array:
                stack_box_slot{Widget := text_block{DefaultText := FPText("ICE HOCKEY LAKE: FROZEN PAWS EDITION\nHomelandAI Studios | UEFN source prototype v0.4.0")}, Padding := margin{Bottom := 12.0}}
                stack_box_slot{Widget := Standard, Padding := margin{Bottom := 5.0}}
                stack_box_slot{Widget := Stationary, Padding := margin{Bottom := 5.0}}
                stack_box_slot{Widget := Goalie, Padding := margin{Bottom := 5.0}}
                stack_box_slot{Widget := Full, Padding := margin{Bottom := 10.0}}
                stack_box_slot{Widget := ViewButton}
                stack_box_slot{Widget := AthleteButton}
                stack_box_slot{Widget := GoalieButton}
                stack_box_slot{Widget := KitButton}
                stack_box_slot{Widget := NetButton}
                stack_box_slot{Widget := DifficultyButton}
                stack_box_slot{Widget := StatusText, Padding := margin{Top := 10.0, Bottom := 10.0}}
                stack_box_slot{Widget := ResumeButton}
                stack_box_slot{Widget := ExitButton}
        Background := color_block{DefaultColor := NamedColors.Black, DefaultOpacity := 0.92, DefaultDesiredSize := vector2{X := 980.0, Y := 820.0}}
        Content := overlay:
            Slots := array:
                overlay_slot{Widget := Background}
                overlay_slot{Widget := Panel, Padding := margin{Left := 22.0, Right := 22.0, Top := 18.0, Bottom := 18.0}}
        C := canvas:
            Slots := array:
                canvas_slot{Anchors := anchors{Minimum := vector2{X := 0.5, Y := 0.5}, Maximum := vector2{X := 0.5, Y := 0.5}}, Alignment := vector2{X := 0.5, Y := 0.5}, SizeToContent := true, Widget := Content}
        if (UI := GetPlayerUI[ForPlayer]):
            UI.AddWidget(C, player_ui_slot{InputMode := ui_input_mode.All})
            set Root = option{C}

    Close():void =
        if (C := Root?, UI := GetPlayerUI[ForPlayer]):
            UI.RemoveWidget(C)
        set Root = false
        for (S : Subscriptions):
            S.Cancel()
        set Subscriptions = array{}

    Refresh():void =
        V := if (Controller.SelectedView = fp_view.OverheadAerial) then "OVERHEAD AERIAL" else if (Controller.SelectedView = fp_view.BehindPlayer) then "BEHIND PLAYER" else "FPV GOALIE"
        ViewButton.SetText(FPText("MATCH CAMERA: {V} - CHANGE"))
        Definitions := FPRoster()
        if (D := Definitions[Controller.SelectedAthlete]):
            AthleteButton.SetText(FPText("SHOOTING DRILL ATHLETE: {D.DisplayName} - NEXT"))
        Keeper := if (Controller.SelectedGoalie = 1) then "ATLAS" else "MASTER SNIFF"
        GoalieButton.SetText(FPText("GOALIE DRILL ATHLETE: {Keeper} - CHANGE"))
        Kit := if (Controller.AlternateKits?) then "REVERSED (HOME WHITE / AWAY DARK)" else "STANDARD (HOME BLUE / AWAY WHITE)"
        KitButton.SetText(FPText("KITS: {Kit}"))
        Net := if (Controller.EmptyNet?) then "EMPTY NET" else "AI GOALKEEPER"
        NetButton.SetText(FPText("SHOOTING DRILLS: {Net} - CHANGE"))
        Level := if (Controller.Difficulty < 0.4) then "EASY" else if (Controller.Difficulty < 0.8) then "NORMAL" else "HARD"
        DifficultyButton.SetText(FPText("AI SAVE WINDOW: {Level} - CHANGE"))
        StatusText.SetText(FPText(Controller.Status))

    StartStandard(M:widget_message):void = Controller.StartFor(M.Player, fp_mode.StandardHockey)
    StartStationary(M:widget_message):void = Controller.StartFor(M.Player, fp_mode.Stationary)
    StartGoalie(M:widget_message):void = Controller.StartFor(M.Player, fp_mode.GoalieTraining)
    StartFull(M:widget_message):void = Controller.StartFor(M.Player, fp_mode.FullRink)
    Resume(M:widget_message):void = Controller.Resume(M.Player)
    Exit(M:widget_message):void =
        Controller.StopSession(M.Player)
        Controller.CloseMenu()
    ChangeView(M:widget_message):void =
        Controller.CycleCamera(M.Player)
        Refresh()
    ChangeAthlete(M:widget_message):void =
        var Next:int = Controller.SelectedAthlete + 1
        if (Next >= 15):
            set Next = 0
        if (Next = 1 or Next = 11):
            set Next += 1
        set Controller.SelectedAthlete = Next
        Refresh()
    ChangeGoalie(M:widget_message):void =
        set Controller.SelectedGoalie = if (Controller.SelectedGoalie = 1) then 11 else 1
        Refresh()
    ChangeKit(M:widget_message):void =
        set Controller.AlternateKits = logic{not Controller.AlternateKits?}
        Refresh()
    ChangeNet(M:widget_message):void =
        set Controller.EmptyNet = logic{not Controller.EmptyNet?}
        Refresh()
    ChangeDifficulty(M:widget_message):void =
        set Controller.Difficulty = if (Controller.Difficulty < 0.4) then 0.6 else if (Controller.Difficulty < 0.8) then 0.95 else 0.25
        Refresh()
