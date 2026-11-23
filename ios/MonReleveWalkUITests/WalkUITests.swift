// ios/MonReleveWalkUITests/WalkUITests.swift
//
// IOS-WALK (I2) R1344, IOS-WALK-2 R1382-R1385. THE WALK, DRIVEN THROUGH THE REAL APP ON THE SIMULATOR (XCUITest)
// AGAINST THE RUNNER'S OWN THROWAWAY SERVER. TWO TRACKS, TWO xcodebuild INVOCATIONS (ios-walk.yml), the app uninstalled
// and reinstalled between them so each starts from a first launch:
//   TRACK 1 - THE NEW ACCOUNT (test01, test02, test03): sign-in, onboarding's name, and at the canton step R1382's ONE
//             diagnostic (the visible set and a screenshot, ONE drag, both again). It stops there by design.
//   TRACK 2 - THE EXISTING ACCOUNT (test01, test21-test34): account A was made through the API by the helper (settings
//             by PATCH /api/v1/me, a prior-year and a current-year day by POST /api/v1/entries); the app signs in as A
//             and must resolve straight to the main shell (StartupDecider: a complete /me is Main), then walks R1344's
//             rest. R1383: a DEVIATION from R1344's single track, recorded in the report.
// Within one invocation the tests run in name order and share ONE app process: each continues where the last stopped
// (activate, never a relaunch, unless the step IS a relaunch). Every step writes a line to the result file through the
// helper; every screenshot is the real simulator screen (simctl), named in the result file.
//
// R1342 / R574: the code screen is NEVER photographed and NEVER dumped once a digit has been typed into it; the code
// itself is fetched from the helper (which has already masked it in the job log), goes only into the keys, and is
// never put on the pasteboard (the helper refuses a code-shaped string).

import XCTest

final class WalkUITests: XCTestCase {
    static let app = XCUIApplication()
    static let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    var app: XCUIApplication { WalkUITests.app }

    override func setUp() {
        continueAfterFailure = false
    }

    private func foreground() {
        if app.state != .runningForeground { app.activate() }
    }

    /// Brings [element] on screen and hittable, or records why not. The scrolling is IOS-WALK's, UNCHANGED until R1382's
    /// diagnosis is read (IOS-WALK-2): back to the top, then short drags, one at a time.
    @discardableResult
    private func reveal(_ element: XCUIElement, _ label: String, _ step: String,
                        within seconds: TimeInterval = 20) -> Bool {
        guard element.waitForExistence(timeout: seconds) else {
            Walk.tree("missing-\(step)", app)
            Walk.note("FAIL \(step): no element labelled \"\(label)\" within \(Int(seconds)) s (tree missing-\(step))")
            XCTFail("no element labelled \(label)")
            return false
        }
        if !element.isHittable {
            for _ in 0..<4 { app.swipeDown(velocity: .fast) }
            Thread.sleep(forTimeInterval: 1)
        }
        for _ in 0..<14 where !element.isHittable {
            let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62))
            let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))
            from.press(forDuration: 0.05, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.3)
            Thread.sleep(forTimeInterval: 0.6)
        }
        guard element.isHittable else {
            Walk.tree("unhittable-\(step)", app)
            Walk.shot("unhittable-\(step)")
            Walk.note("FAIL \(step): \"\(label)\" exists but is not hittable after scrolling (tree unhittable-\(step))")
            XCTFail("not hittable: \(label)")
            return false
        }
        return true
    }

    private func tapLabel(_ label: String, _ step: String, within seconds: TimeInterval = 20) {
        let element = app.labelled(label)
        if reveal(element, label, step, within: seconds) { element.tap() }
    }

    // MARK: - 01 first launch (R1321's Keychain clear is the app's own first-launch path) - BOTH tracks

    func test01_firstLaunch() {
        app.launchArguments = ["-walkProbe", "YES"]
        let launched = Date()
        app.launch()
        let welcome = app.shows(L.welcomeStart, within: 60)
        Walk.note("01 first launch: welcome \"\(L.welcomeStart)\" shown=\(welcome) after "
            + "\(Int(Date().timeIntervalSince(launched) * 1000)) ms")
        Walk.tree("01-welcome", app)
        Walk.shot("01-welcome")
        let lines = Walk.freshProbe()
        Walk.note("01 FIRST ANSWER: status=\(Walk.probeValue("firstAnswer.status", lines) ?? "?") "
            + "msFromProcessStart=\(Walk.probeValue("firstAnswer.msFromProcessStart", lines) ?? "?") "
            + "msFromDidFinish=\(Walk.probeValue("firstAnswer.msFromDidFinish", lines) ?? "?") "
            + "didFinishAfterProcessStartMs=\(Walk.probeValue("launch.didFinishAfterProcessStartMs", lines) ?? "?") "
            + "timeZone=\(Walk.probeValue("timeZone", lines) ?? "?") "
            + "voiceOverRunning=\(Walk.probeValue("voiceOverRunning", lines) ?? "?")")
        XCTAssertTrue(welcome)
        // DRIVER PROOF (a): one Compose element found by its accessibility label and tapped.
        tapLabel(L.welcomeStart, "01-start")
        Walk.note("01 DRIVER PROOF (a): tapped the Compose element labelled \"\(L.welcomeStart)\"")
    }

    // MARK: - code sign-in (iOS Ruling 3 Q2)

    /// Enters [text] into [field]: by PASTE when [paste] (verified by reading the field's label back), by the keyboard's
    /// keys otherwise - and by keys after a paste ONLY when the field is verifiably empty (run 11's retype on top of a
    /// half-typed address is what made typing worse). Never used for the code.
    private func enter(_ text: String, into field: XCUIElement, _ step: String, paste: Bool) {
        if paste {
            let how = app.paste(text, into: field)
            if app.labelled(text).waitForExistence(timeout: 3) {
                Walk.note("\(step) entered by PASTE (\(how)); the field reads it back")
                return
            }
            let empty = field.exists && field.label.isEmpty
            Walk.note("\(step) the paste did not land (\(how)); the field is empty=\(empty)")
            guard empty else { return }
        }
        let typed = app.type(text, into: field)
        Walk.note("\(step) entered by the KEYS=\(typed)")
    }

    private func signIn(_ address: String, step: String, paste: Bool) {
        guard let email = app.field(below: L.emailLabel) else {
            Walk.tree("\(step)-no-email-field", app)
            XCTFail("no e-mail field")
            return
        }
        Walk.tree("\(step)-signin", app)
        Walk.shot("\(step)-signin")
        let before = Walk.mailCount(address)
        enter(address, into: email, "\(step) sign-in e-mail", paste: paste)
        dismissKeyboard()
        if app.labelled(L.signInSubmit).exists && !app.labelled(L.codeTitle).exists {
            app.labelled(L.signInSubmit).tap()
        }
        let codeScreen = app.shows(L.codeTitle, within: 60)
        Walk.note("\(step) sign-in: code screen shown=\(codeScreen) (mails to the account before: \(before))")
        guard codeScreen else {
            Walk.tree("\(step)-after-submit", app)
            XCTFail("no code screen")
            return
        }
        // The code screen BEFORE any digit is typed: dumped (it holds no code), never photographed (R574).
        Walk.tree("\(step)-code-empty", app)
        guard let code = Walk.code(address, after: before) else {
            Walk.note("FAIL \(step): no code reached the outbox (NO RESULT)")
            XCTFail("no code")
            return
        }
        let field = app.labelled(L.codeDigit1)
        guard field.waitForExistence(timeout: 10) else {
            Walk.note("FAIL \(step): no code box \"\(L.codeDigit1)\"")
            XCTFail("no code field")
            return
        }
        let typed = app.type(code, into: field)
        Walk.note("\(step) sign-in: the code typed by its keys=\(typed) (the code itself is never logged)")
        dismissKeyboard()
        let submit = app.labelled(L.codeSubmit)
        if submit.exists { submit.tap() }
        var left = false
        for _ in 0..<60 {
            if !app.labelled(L.codeTitle).exists { left = true; break }
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("\(step) sign-in: the code was typed (never logged); code screen left=\(left)")
        XCTAssertTrue(left)
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("\(step)-after-signin", app)
        Walk.shot("\(step)-after-signin")
    }

    /// The keyboard covers the bottom actions: its return key (whatever the field's IME action names it) closes it.
    private func dismissKeyboard() {
        let keyboard = app.keyboards.firstMatch
        guard keyboard.exists else { return }
        let names = ["Return", "return", "Done", "done", "Go", "Next", "Send", "OK", "Terminé", "Aller", "Suivant", "Envoyer",
                     "retour", "search", "Search", "Rechercher"]
        let key = keyboard.buttons.matching(NSPredicate(format: "label IN %@", names)).firstMatch
        if key.exists {
            key.tap()
        } else {
            Walk.note("keyboard: no return key among \(keyboard.buttons.allElementsBoundByIndex.suffix(4).map { $0.label })")
        }
        Thread.sleep(forTimeInterval: 1)
    }

    // MARK: - TRACK 1: 02 the new account signs in (keys, as in the three passing runs); 03 onboarding to the diagnostic

    func test02_signInNew() {
        foreground()
        signIn(Walk.accountN, step: "02", paste: false)
    }

    func test03_onboardingDiagnostic() {
        foreground()
        var seen: [String] = []
        for round in 0..<6 {
            Thread.sleep(forTimeInterval: 1.5)
            if app.labelled(L.onbNameTitle).exists {
                seen.append("name")
                if let field = app.field(below: L.onbNameLabel, within: 5) {
                    _ = app.type("Camille Simulateur", into: field)
                    dismissKeyboard()
                } else {
                    Walk.note("03 name: no field below \"\(L.onbNameLabel)\"")
                }
                Walk.tree("03-name", app)
                Walk.shot("03-name")
                tapLabel(L.onbContinue, "03-name-continue")
            } else if app.labelled(L.onbCantonTitle).exists {
                seen.append("canton")
                cantonDiagnostic()
                Walk.note("03 TRACK 1 STOPPED at the canton step after R1382's diagnostic (by design: no workaround "
                    + "before the diagnosis is read). Screens: \(seen.joined(separator: " > "))")
                return
            } else {
                Walk.tree("03-unknown-\(round)", app)
                Walk.shot("03-unknown-\(round)")
                Walk.note("03 onboarding: round \(round) shows no known screen (tree 03-unknown-\(round))")
            }
        }
        Walk.note("FAIL 03 the canton step was not reached: \(seen.joined(separator: " > "))")
        XCTFail("canton step not reached")
    }

    /// R1382: the labels of every element with a NON-ZERO frame and a screenshot (the trees carry every frame; no code
    /// is on this screen); ONE drag inside the list, sized to bring Geneve mid-screen; both again at about +1.5 s and
    /// +5 s with NO second drag. One note line per record with Geneve's exists / frame / hittable and the keyboards.
    private func cantonDiagnostic() {
        let geneve = app.labelled(L.cantonGeneve)
        func record(_ tag: String) {
            let exists = geneve.exists
            let frame = exists ? "\(geneve.frame)" : "-"
            let hittable = exists ? "\(geneve.isHittable)" : "-"
            Walk.note("03 R1382 \(tag): \"\(L.cantonGeneve)\" exists=\(exists) frame=\(frame) hittable=\(hittable) "
                + "keyboards=\(app.keyboards.count) (tree and shot 03-r1382-\(tag))")
            Walk.tree("03-r1382-\(tag)", app)
            Walk.shot("03-r1382-\(tag)")
        }
        record("before")
        let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70))
        let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.40))
        from.press(forDuration: 0.05, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.3)
        Walk.note("03 R1382: ONE drag, slow, from 70 % to 40 % of the window height (no inertia)")
        Thread.sleep(forTimeInterval: 1.5)
        record("after-1")
        Thread.sleep(forTimeInterval: 3.5)
        record("after-5")
    }

    // MARK: - TRACK 2: 21 the existing account signs in and must go straight to the main shell (R1383)

    private func waitMain(_ seconds: TimeInterval) -> Bool {
        app.labelled(L.tabParametres).waitForExistence(timeout: seconds) && app.labelled(L.tabCalendrier).exists
    }

    private func relaunch(_ extra: [String] = []) {
        app.terminate()
        app.launchArguments = ["-walkProbe", "YES"] + extra
        app.launch()
    }

    /// After a sign-in: wait for the main shell, noting whether any onboarding screen showed on the way.
    private func expectMainWithoutOnboarding(_ step: String) -> Bool {
        var onboarding = false
        var main = false
        for _ in 0..<90 {
            if app.labelled(L.onbNameTitle).exists || app.labelled(L.onbCantonTitle).exists { onboarding = true }
            if app.labelled(L.tabParametres).exists && app.labelled(L.tabCalendrier).exists { main = true; break }
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("\(step) R1383: the main shell reached=\(main); an onboarding screen shown on the way=\(onboarding) "
            + "(StartupDecider: a complete GET /api/v1/me resolves to Main)")
        Walk.tree("\(step)-main", app)
        Walk.shot("\(step)-main")
        return main && !onboarding
    }

    func test21_signInExisting() {
        foreground()
        signIn(Walk.accountA, step: "21", paste: true)
        XCTAssertTrue(expectMainWithoutOnboarding("21"))
    }

    // MARK: - 22 the years landed (R1371): the prior-year day on the phone

    func test22_yearsLanded() {
        foreground()
        Thread.sleep(forTimeInterval: 8)
        Walk.call("/phonedb?label=22-phone")
        tapLabel(L.tabReleve, "22-tab")
        Thread.sleep(forTimeInterval: 3)
        Walk.tree("22-releve-current", app)
        Walk.shot("22-releve-current")
        let previous = Calendar(identifier: .gregorian).component(.year, from: Date()) - 1
        let chip = app.labelled("\(previous)")
        guard chip.waitForExistence(timeout: 5) else {
            Walk.note("FAIL 22 no \(previous) chip on the releve (tree 22-releve-current)")
            XCTFail("no previous-year chip")
            return
        }
        chip.tap()
        Thread.sleep(forTimeInterval: 3)
        Walk.note("22 the releve for \(previous) opened (tree and shot 22-releve-previous: the prior-year day seeded "
            + "through the API must show there)")
        Walk.tree("22-releve-previous", app)
        Walk.shot("22-releve-previous")
    }

    // MARK: - 23 Aujourd'hui: today recorded while the server is unreachable, then a REAL background/foreground

    func test23_todayAndForeground() {
        foreground()
        tapLabel(L.tabAujourdhui, "23-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("23-aujourdhui", app)
        Walk.shot("23-aujourdhui")
        Walk.notePending("23 before recording today")
        Walk.call("/down")
        Walk.note("23 relay DOWN: the app's requests now answer 503")
        tapLabel(L.todaySuisse, "23-suisse")
        let pending = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", L.todayPending)).firstMatch
        let shownPending = pending.waitForExistence(timeout: 30)
        Walk.note("23 today recorded with the server unreachable: \"\(L.todayPending)\" shown=\(shownPending)")
        Walk.tree("23-today-pending", app)
        Walk.shot("23-today-pending")
        Walk.call("/up")
        let t0 = Date().timeIntervalSince1970
        Walk.note("23 relay UP; pressing Home (a REAL background)")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 4)
        Walk.note("23 app state in the background: \(app.state.rawValue) (1=notRunning 2=bgSuspended 3=bg 4=fg)")
        Walk.noteRequestsSince(t0, "23 while in the background")
        let t1 = Date().timeIntervalSince1970
        app.activate()
        var drained = false
        for _ in 0..<60 {
            if !pending.exists { drained = true; break }
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("23 foreground: \"\(L.todayPending)\" gone=\(drained); \"\(L.todaySynced)\" shown="
            + "\(app.labelled(L.todaySynced).exists)")
        Walk.noteRequestsSince(t1, "23 after the foreground (the drain)")
        Walk.notePending("23 after the foreground (the re-plan)")
        Walk.tree("23-today-synced", app)
        Walk.shot("23-today-synced")
    }

    // MARK: - helpers for the rest of the walk

    /// The last element labelled [label] (a dialog's button sits after the row that opened it).
    private func lastLabelled(_ label: String) -> XCUIElement? {
        let all = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
            .allElementsBoundByIndex
        return all.last
    }

    /// A working day of this month, before today and after the 3rd - the "another day" the calendar records. Paris
    /// calendar, as every recorded day is.
    static func anotherDay() -> Int? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Paris")!
        let today = calendar.component(.day, from: Date())
        var day = today - 1
        while day > 3 {
            var parts = calendar.dateComponents([.year, .month], from: Date())
            parts.day = day
            if let date = calendar.date(from: parts), !calendar.isDateInWeekend(date) { return day }
            day -= 1
        }
        return nil
    }

    private func dayCell(_ day: Int) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Jour \(day),")).firstMatch
    }

    // MARK: - 24 the calendar: another day recorded, then changed

    func test24_calendar() {
        foreground()
        tapLabel(L.tabCalendrier, "24-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("24-calendrier", app)
        Walk.shot("24-calendrier")
        guard let day = WalkUITests.anotherDay() else {
            Walk.note("24 calendar: no working day between the 4th and yesterday this month - step NOT RUN")
            return
        }
        for (pass, choice) in [(1, L.todayDomicile), (2, L.todaySuisse)] {
            let cell = dayCell(day)
            guard cell.waitForExistence(timeout: 10) else {
                Walk.note("FAIL 24 calendar: no cell labelled \"Jour \(day), ...\"")
                Walk.tree("24-no-cell", app)
                XCTFail("no day cell")
                return
            }
            Walk.note("24 pass \(pass): day \(day) before: \"\(cell.label)\"")
            cell.tap()
            Thread.sleep(forTimeInterval: 1.5)
            Walk.tree("24-sheet-\(pass)", app)
            Walk.shot("24-sheet-\(pass)")
            guard app.labelled(L.sheetQuestion).waitForExistence(timeout: 5),
                  let option = lastLabelled(choice) else {
                Walk.note("FAIL 24 pass \(pass): no sheet \"\(L.sheetQuestion)\" with \"\(choice)\"")
                XCTFail("no sheet")
                return
            }
            option.tap()
            Thread.sleep(forTimeInterval: 0.5)
            if let save = lastLabelled(L.sheetSave) { save.tap() }
            Thread.sleep(forTimeInterval: 2.5)
            Walk.note("24 pass \(pass): chose \"\(choice)\"; day \(day) after: \"\(dayCell(day).label)\"")
            Walk.shot("24-after-\(pass)")
        }
    }

    // MARK: - 25 the server side: the year read back THROUGH THE API with the app's own session

    func test25_serverEntries() {
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        let (status, data) = Walk.call("/entries?year=\(year)&n=1")
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let entries = (object?["entries"] as? [[String: Any]]) ?? []
        Walk.note("25 server: GET /api/v1/entries?year=\(year) -> \(status), \(entries.count) entr(y/ies) "
            + "(saved as server-entries-1.json)")
        for entry in entries {
            let keys = entry.keys.sorted().filter { $0.lowercased().contains("at") || $0 == "date" || $0 == "kind" }
            Walk.note("25 server:   " + keys.map { "\($0)=\(entry[$0].map { "\($0)" } ?? "nil")" }.joined(separator: " "))
        }
    }

    // MARK: - 26 the releve: the export's share sheet

    func test26_export() {
        foreground()
        tapLabel(L.tabReleve, "26-tab")
        Thread.sleep(forTimeInterval: 3)
        Walk.tree("26-releve", app)
        Walk.shot("26-releve")
        tapLabel(L.exportPdf, "26-export")
        Thread.sleep(forTimeInterval: 8)
        let sheet = app.descendants(matching: .any).matching(identifier: "ActivityListView").count > 0
        Walk.note("26 export: share sheet (ActivityListView) shown=\(sheet)")
        Walk.tree("26-share", app)
        Walk.shot("26-share-sheet")
        let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Fermer", "Cancel"])).firstMatch
        if close.exists { close.tap() } else { app.swipeDown(velocity: .fast) }
        Thread.sleep(forTimeInterval: 2)
    }

    // MARK: - 27 the employer comparison, its figure kept across a relaunch

    func test27_comparison() {
        foreground()
        tapLabel(L.tabReleve, "27-tab")
        Thread.sleep(forTimeInterval: 2)
        let previous = Calendar(identifier: .gregorian).component(.year, from: Date()) - 1
        let chip = app.labelled("\(previous)")
        guard chip.waitForExistence(timeout: 5) else {
            Walk.note("FAIL 27 comparison: no \(previous) chip on the releve")
            XCTFail("no previous-year chip")
            return
        }
        chip.tap()
        Thread.sleep(forTimeInterval: 3)
        tapLabel(L.compareEmployer, "27-compare")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("27-comparison", app)
        guard let field = app.field(below: L.comparisonTitle) else {
            Walk.note("FAIL 27 comparison: no employer field")
            XCTFail("no employer field")
            return
        }
        _ = app.type("40,5", into: field)
        dismissKeyboard()
        Thread.sleep(forTimeInterval: 1)
        Walk.note("27 comparison \(previous): employer figure typed \"40,5\"; \"40,50\" shown="
            + "\(app.containing("40,50").exists)")
        Walk.tree("27-comparison-set", app)
        Walk.shot("27-comparison-set")
        relaunch()
        _ = waitMain(60)
        tapLabel(L.tabReleve, "27-tab-again")
        Thread.sleep(forTimeInterval: 3)
        app.labelled("\(previous)").tap()
        Thread.sleep(forTimeInterval: 3)
        tapLabel(L.compareEmployer, "27-compare-again")
        Thread.sleep(forTimeInterval: 2)
        Walk.note("27 comparison after a RELAUNCH: \"40,50\" shown=\(app.containing("40,50").exists)")
        Walk.tree("27-comparison-relaunched", app)
        Walk.shot("27-comparison-relaunched")
        relaunch()
        _ = waitMain(60)
    }

    // MARK: - 28 Parametres: DRIVER PROOF (c), the native UIDatePicker from the start-date row (not saved)

    func test28_datePicker() {
        foreground()
        tapLabel(L.tabParametres, "28-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("28-parametres", app)
        Walk.shot("28-parametres")
        let row = app.containing(L.startDateRow)
        guard reveal(row, L.startDateRow, "28-row") else { return }
        Walk.note("28 start-date row: \"\(row.label)\"")
        row.tap()
        Thread.sleep(forTimeInterval: 1.5)
        tapLabel(L.startDatePick, "28-pick")
        Thread.sleep(forTimeInterval: 2)
        let picker = app.datePickers.firstMatch
        guard picker.waitForExistence(timeout: 10) else {
            Walk.tree("28-no-datepicker", app)
            Walk.shot("28-no-datepicker")
            Walk.note("FAIL 28 DRIVER PROOF (c): no UIDatePicker in the tree after \"\(L.startDatePick)\"")
            XCTFail("no date picker")
            return
        }
        let days = picker.buttons.allElementsBoundByIndex.filter {
            $0.isEnabled && $0.label.rangeOfCharacter(from: .decimalDigits) != nil
                && !$0.label.contains("Month") && !$0.label.lowercased().contains("mois")
        }
        Walk.note("28 DRIVER PROOF (c): UIDatePicker found; value before=\"\(picker.value ?? "nil")\"; "
            + "\(days.count) day button(s), e.g. \(days.prefix(3).map { $0.label })")
        Walk.tree("28-datepicker-open", app)
        Walk.shot("28-datepicker-open")
        if days.count > 2 {
            Walk.note("28 date picker: choosing \"\(days[2].label)\"")
            days[2].tap()
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("28 DRIVER PROOF (c): value after=\"\(app.datePickers.firstMatch.value ?? "nil")\"")
        if let confirm = lastLabelled(L.onbContinue) { confirm.tap() }
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("28-sheet-after-pick", app)
        Walk.shot("28-sheet-after-pick")
        // NOT SAVED: the account's period stays whole-year, so nothing later in the walk depends on this step.
        if let cancel = lastLabelled(L.sheetCancel) { cancel.tap() }
        Thread.sleep(forTimeInterval: 1.5)
        Walk.note("28 the sheet cancelled (not saved); the row reads \"\(app.containing(L.startDateRow).label)\"")
    }

    // MARK: - 29 Parametres: the evening switch PRESENT and the alert switch ABSENT; the opt-in; DRIVER PROOF (b); M4

    func test29_evening() {
        foreground()
        tapLabel(L.tabParametres, "29-tab")
        Thread.sleep(forTimeInterval: 2)
        let label = app.labelled(L.eveningLabel)
        guard reveal(label, L.eveningLabel, "29-evening") else { return }
        Walk.note("29 parametres: \"\(L.eveningLabel)\" PRESENT=true; \"\(L.alertLabel)\" PRESENT="
            + "\(app.labelled(L.alertLabel).exists) (iOS Ruling 3 Q4: must be ABSENT)")
        Walk.notePending("29 BEFORE the opt-in")
        let row = label.frame
        let near = app.switches.allElementsBoundByIndex.filter { abs($0.frame.midY - row.midY) < 60 && $0.frame.width > 0 }
        if let toggle = near.first {
            Walk.note("29 the evening switch: value before=\"\(toggle.value ?? "nil")\"; tapped")
            toggle.tap()
        } else {
            let window = app.windows.firstMatch.frame
            Walk.note("29 no switch element beside the label (\(app.switches.count) in the tree): a tap at the row's "
                + "trailing edge")
            app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
                .withOffset(CGVector(dx: window.width - 62, dy: row.midY + 12)).tap()
        }
        notificationAlert("29")
        let after = app.switches.allElementsBoundByIndex.filter { abs($0.frame.midY - row.midY) < 60 && $0.frame.width > 0 }
        Walk.note("29 the evening switch: value after=\"\(after.first.map { "\($0.value ?? "nil")" } ?? "no switch")\"")
        Walk.tree("29-evening-on", app)
        Walk.shot("29-evening-on")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 3)
        app.activate()
        Thread.sleep(forTimeInterval: 3)
        Walk.notePending("29 M4 after a background/foreground (the re-plan must not double)")
    }

    /// DRIVER PROOF (b): past the system notification-permission alert (SpringBoard's, not the app's).
    private func notificationAlert(_ step: String) {
        let alert = WalkUITests.springboard.alerts.firstMatch
        guard alert.waitForExistence(timeout: 15) else {
            Walk.note("\(step) no system alert within 15 s (expected only on the FIRST ask)")
            Walk.notePending("\(step) after the opt-in")
            return
        }
        let buttons = alert.buttons.allElementsBoundByIndex.map { $0.label }
        Walk.note("\(step) DRIVER PROOF (b): system alert \"\(alert.label)\" buttons=\(buttons)")
        Walk.shot("\(step)-notification-alert")
        let allow = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "Autoriser"])).firstMatch
        if allow.exists { allow.tap() } else { alert.buttons.element(boundBy: alert.buttons.count - 1).tap() }
        Thread.sleep(forTimeInterval: 2)
        Walk.notePending("\(step) M4 after the alert (today recorded earlier: today must be ABSENT)")
    }

    // MARK: - 30 Parametres: the legal page is the in-app Licences (R1386: never a link to production)

    func test30_licences() {
        foreground()
        tapLabel(L.tabParametres, "30-tab")
        Thread.sleep(forTimeInterval: 2)
        tapLabel(L.licencesTitle, "30-licences")
        Thread.sleep(forTimeInterval: 2)
        Walk.note("30 legal page opened IN THE APP: \"\(L.licencesTitle)\" (the rows that open the production site in "
            + "Safari are NOT tapped - R1386)")
        Walk.tree("30-licences", app)
        Walk.shot("30-licences")
        if let back = lastLabelled(L.licencesBack) { back.tap() }
        Thread.sleep(forTimeInterval: 1.5)
    }

    // MARK: - 31 sign-out: the pending set before (> 0) and after (0); a relaunch reaches sign-in (M3)

    private func signOutHere(_ step: String) {
        tapLabel(L.tabParametres, "\(step)-tab")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.notePending("\(step) M3 BEFORE sign-out")
        tapLabel(L.signOut, "\(step)-signout-row")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("\(step)-signout-dialog", app)
        Walk.shot("\(step)-signout-dialog")
        if let confirm = lastLabelled(L.signOut) { confirm.tap() }
        let out = app.labelled(L.welcomeStart).waitForExistence(timeout: 30)
            || app.labelled(L.signInSubmit).waitForExistence(timeout: 5)
        Walk.note("\(step) signed out: sign-in reached=\(out)")
        Walk.notePending("\(step) M3 AFTER sign-out")
    }

    func test31_signOut() {
        foreground()
        signOutHere("31")
        relaunch()
        let signIn = app.labelled(L.welcomeStart).waitForExistence(timeout: 30)
            || app.labelled(L.signInSubmit).waitForExistence(timeout: 5)
        Walk.note("31 relaunch after sign-out reaches sign-in=\(signIn)")
        Walk.shot("31-relaunch-signed-out")
    }

    // MARK: - 32 the same account again: the days are back; today's request absent (iOS Ruling 16 Q3)

    func test32_signInAgain() {
        foreground()
        if app.labelled(L.welcomeStart).exists { app.labelled(L.welcomeStart).tap() }
        signIn(Walk.accountA, step: "32", paste: true)
        _ = expectMainWithoutOnboarding("32")
        Thread.sleep(forTimeInterval: 8)
        Walk.call("/phonedb?label=32-phone")
        tapLabel(L.tabAujourdhui, "32-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.note("32 Aujourd'hui after the download: \"\(L.todaySynced)\" shown=\(app.labelled(L.todaySynced).exists)")
        Walk.shot("32-aujourdhui-again")
        tapLabel(L.tabCalendrier, "32-cal")
        Thread.sleep(forTimeInterval: 2)
        if let day = WalkUITests.anotherDay() {
            Walk.note("32 calendar after the download: day \(day) \"\(dayCell(day).label)\"")
        }
        Walk.tree("32-calendrier-again", app)
        Walk.shot("32-calendrier-again")
        Walk.notePending("32 YEARS AND THE PLAN (today recorded before the sign-out: today must be ABSENT)")
    }

    // MARK: - 33 THE TAP: a delivered reminder, tapped, opens Aujourd'hui (R1330)

    func test33_reminderTap() {
        relaunch(["-walkNearTap", "YES"])
        _ = waitMain(60)
        tapLabel(L.tabParametres, "33-tab")
        Thread.sleep(forTimeInterval: 1)
        let lines = Walk.freshProbe()
        Walk.note("33 near copy: \(Walk.probeValue("nearTap.added", lines) ?? "not yet")")
        XCUIDevice.shared.press(.home)
        let banner = WalkUITests.springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", L.reminderTitle)).firstMatch
        let delivered = banner.waitForExistence(timeout: 30)
        Walk.note("33 banner with \"\(L.reminderTitle)\" delivered on the simulator=\(delivered)")
        Walk.shot("33-banner")
        guard delivered else { app.activate(); return }
        banner.tap()
        let opened = app.wait(for: .runningForeground, timeout: 15)
        Thread.sleep(forTimeInterval: 3)
        let onToday = app.labelled(L.todaySynced).exists || app.labelled(L.todayQuestion).exists
        Walk.note("33 THE TAP: app foreground=\(opened); Aujourd'hui shown=\(onToday) "
            + "(the tap was made from the Parametres tab)")
        Walk.tree("33-after-tap", app)
        Walk.shot("33-after-tap")
    }

    // MARK: - 34 M3 for account deletion, on the second existing account B (made through the API, reminder ON)

    func test34_accountDeletion() {
        foreground()
        signOutHere("34a")
        if app.labelled(L.welcomeStart).exists { app.labelled(L.welcomeStart).tap() }
        signIn(Walk.accountB, step: "34", paste: true)
        _ = expectMainWithoutOnboarding("34")
        Thread.sleep(forTimeInterval: 5)
        Walk.notePending("34 M3 BEFORE deletion (B's reminder is ON on the server)")
        tapLabel(L.tabParametres, "34-tab")
        tapLabel(L.deleteRow, "34-delete-row")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("34-delete", app)
        let prompt = app.containing(L.deleteWord)
        if let field = app.field(belowElement: prompt, within: 5) {
            enter(L.deleteWord, into: field, "34 confirmation word", paste: true)
            dismissKeyboard()
        } else {
            Walk.note("FAIL 34 no confirmation field")
        }
        Walk.shot("34-delete-confirm")
        tapLabel(L.deleteConfirm, "34-delete-confirm")
        let done = app.labelled(L.deleteDoneTitle).waitForExistence(timeout: 30)
        Walk.note("34 account deleted: \"\(L.deleteDoneTitle)\" shown=\(done)")
        Walk.shot("34-deleted")
        if let ack = lastLabelled(L.deleteDoneAck) { ack.tap() }
        Thread.sleep(forTimeInterval: 2)
        Walk.notePending("34 M3 AFTER deletion")
    }
}
