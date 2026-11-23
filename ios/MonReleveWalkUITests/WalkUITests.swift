// ios/MonReleveWalkUITests/WalkUITests.swift
//
// IOS-WALK (I2) R1344, IOS-WALK-2 R1382-R1385. THE WALK, DRIVEN THROUGH THE REAL APP ON THE SIMULATOR (XCUITest)
// AGAINST THE RUNNER'S OWN THROWAWAY SERVER. TWO TRACKS, TWO xcodebuild INVOCATIONS (ios-walk.yml), the app uninstalled
// and reinstalled between them so each starts from a first launch:
//   TRACK 1 - THE NEW ACCOUNT (test01, test02, test03): sign-in and the whole onboarding. Run 45095829204 was R1382's
//             ONE diagnostic at the canton step (the visible set and a screenshot, ONE drag, both again); its finding
//             is the scrolling in reveal() below.
//   TRACK 2 - THE EXISTING ACCOUNT (test01, test21-test34): account A was made through the API by the helper (settings
//             by PATCH /api/v1/me, a prior-year and a current-year day by POST /api/v1/entries); the app signs in as A
//             and must resolve straight to the main shell (StartupDecider: a complete /me is Main), then walks R1344's
//             rest. R1383: a DEVIATION from R1344's single track, recorded in the report.
// Within one invocation the tests run in name order and share ONE app process: each continues where the last stopped
// (activate, never a relaunch, unless the step IS a relaunch). Every step writes a line to the result file through the
// helper; every screenshot is the real simulator screen (simctl), named in the result file.
//
// R1342 / R574: the code screen is NEVER photographed and NEVER dumped once a digit has been typed into it; the code
// itself is fetched from the helper (which has already masked it in the job log) and goes only into the keys; its boxes
// are never read back.

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

    /// Whether [element] is ON SCREEN: XCUITest calls it hittable, or it reports a real frame of its own. Compose clips a
    /// row's frame to the scroll viewport (zero when wholly outside it, partial at its edge - R1382's trees), so a real
    /// frame IS an on-screen frame. XCUITest's hittability alone is not enough: run 45099570712 had "Domicile" at
    /// {{100.7, 563.7}, {53, 33.3}} refused as not hittable, and Geneve never called hittable through 20 drags.
    private func onScreen(_ element: XCUIElement) -> Bool {
        guard element.exists else { return false }
        if element.isHittable { return true }
        let frame = element.frame
        return frame.width > 0 && frame.height >= 16
    }

    /// Brings [element] on screen, or records why not.
    ///
    /// R1382's DIAGNOSIS (run 45095829204): an off-viewport row reports a ZERO frame, and ONE slow drag from 70 % to 40 %
    /// of the window put Geneve mid-screen with a real frame at +1.5 s, unchanged at +5 s. So the tree is neither stale
    /// (c) nor unscrolled (a), and the row is on this screen (b does not hold): IOS-WALK's own loop was the fault. This is
    /// the diagnosed gesture with a 1.5 s settle, down the page first, then back up; ON SCREEN is judged by the element's
    /// own frame (onScreen), and each frame seen on the way is recorded.
    @discardableResult
    private func reveal(_ element: XCUIElement, _ label: String, _ step: String,
                        within seconds: TimeInterval = 20) -> Bool {
        guard element.waitForExistence(timeout: seconds) else {
            Walk.tree("missing-\(step)", app)
            Walk.note("FAIL \(step): no element labelled \"\(label)\" within \(Int(seconds)) s (tree missing-\(step))")
            XCTFail("no element labelled \(label)")
            return false
        }
        let low = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70))
        let high = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.40))
        var seen: [String] = []
        for pass in 0..<20 where !onScreen(element) {
            if pass < 9 {
                low.press(forDuration: 0.05, thenDragTo: high, withVelocity: .slow, thenHoldForDuration: 0.3)
            } else {
                high.press(forDuration: 0.05, thenDragTo: low, withVelocity: .slow, thenHoldForDuration: 0.3)
            }
            Thread.sleep(forTimeInterval: 1.5)
            seen.append(element.exists ? "\(Int(element.frame.minY))/\(Int(element.frame.height))" : "gone")
        }
        if !seen.isEmpty {
            Walk.note("\(step): \"\(label)\" after \(seen.count) drag(s): on screen=\(onScreen(element)); "
                + "y/height after each: \(seen.joined(separator: " "))")
        }
        guard onScreen(element) else {
            Walk.tree("unhittable-\(step)", app)
            Walk.shot("unhittable-\(step)")
            Walk.note("FAIL \(step): \"\(label)\" exists but never came on screen (tree unhittable-\(step))")
            XCTFail("not on screen: \(label)")
            return false
        }
        return true
    }

    /// Taps [element]: XCUITest's own tap when it calls the element hittable; otherwise a tap at the centre of the
    /// element's OWN reported frame (DEVIATION, IOS-WALK-2: XCUITest refuses on-screen Compose elements - onScreen).
    private func press(_ element: XCUIElement) {
        if element.exists && element.isHittable {
            element.tap()
            return
        }
        guard element.exists else {
            element.tap()
            return
        }
        let frame = element.frame
        guard frame.width > 0, frame.height > 0 else {
            element.tap()
            return
        }
        app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            .withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
    }

    /// The first element whose label is [label] or BEGINS with it (a merged row: headline + supporting text).
    private func starting(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
    }

    /// Taps the element labelled exactly [label] - or, when there is none, the one whose label BEGINS with it: a
    /// selectable ChoiceCard merges its title and description into one label (ChoiceCardText.kt), so the copy's title
    /// is the start of the card's label, not all of it.
    private func tapLabel(_ label: String, _ step: String, within seconds: TimeInterval = 20) {
        var element = app.labelled(label)
        if !element.waitForExistence(timeout: min(seconds, 5)) {
            let begins = starting(label)
            if begins.waitForExistence(timeout: seconds) { element = begins }
        }
        if reveal(element, label, step, within: 1) { press(element) }
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

    /// Enters [text] into [field] by the keyboard's keys and READS IT BACK (a Compose field's label is its text, F3) before
    /// anything is submitted. On a mismatch the field is emptied with the delete key and typed again - at most twice -
    /// never typed on top (run 45088845825). Run 45095829204 measured why: the field took "v" + the address, and the
    /// sign-in went to that address. PASTE IS NOT AVAILABLE: the same run found no Paste item after one tap, a second tap
    /// and a long press on an empty Compose field. Never used for the code (its boxes are never read back - R574).
    @discardableResult
    private func enter(_ text: String, into field: XCUIElement, _ step: String) -> Bool {
        for attempt in 1...3 {
            if attempt > 1 {
                app.clear(field, count: max(field.label.count, text.count) + 4)
                Thread.sleep(forTimeInterval: 0.5)
            }
            let typed = app.type(text, into: field)
            Thread.sleep(forTimeInterval: 0.5)
            let read = field.label
            if read == text || app.labelled(text).exists {
                Walk.note("\(step): typed by the keys (attempt \(attempt)) and read back exactly")
                return true
            }
            Walk.note("\(step): attempt \(attempt) read back \"\(read)\" (typed=\(typed)) - cleared and typed again")
        }
        Walk.note("FAIL \(step): three attempts, the field never read back the text - NOT submitted")
        XCTFail("typing never read back")
        return false
    }

    private func signIn(_ address: String, step: String) {
        guard let email = app.field(below: L.emailLabel) else {
            Walk.tree("\(step)-no-email-field", app)
            XCTFail("no e-mail field")
            return
        }
        Walk.tree("\(step)-signin", app)
        Walk.shot("\(step)-signin")
        let before = Walk.mailCount(address)
        guard enter(address, into: email, "\(step) sign-in e-mail") else { return }
        dismissKeyboard()
        if app.labelled(L.signInSubmit).exists && !app.labelled(L.codeTitle).exists {
            press(app.labelled(L.signInSubmit))
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
        if submit.exists { press(submit) }
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

    // MARK: - TRACK 1: the new account - 02 sign-in, 03 the whole onboarding (manual-only), its picker and its alert

    func test02_signInNew() {
        foreground()
        signIn(Walk.accountN, step: "02")
    }

    /// Onboarding, screen by screen, through the real wizard (R1344): the native start-date picker OPENED from the period
    /// step (iOS Ruling 13 Q2, DRIVER PROOF (c)) and the system alert from the reminder step (DRIVER PROOF (b)). The
    /// canton row is brought on screen by R1382's diagnosed gesture (reveal), its frame recorded before and after.
    func test03_onboarding() {
        foreground()
        var seen: [String] = []
        var unknown = 0
        for round in 0..<20 {
            if unknown >= 4 { break }
            Thread.sleep(forTimeInterval: 1.5)
            if app.labelled(L.tabParametres).exists && app.labelled(L.tabCalendrier).exists {
                Walk.note("03 onboarding done after \(round) screen(s): \(seen.joined(separator: " > "))")
                Walk.tree("03-main", app)
                Walk.shot("03-main")
                Walk.notePending("03 M4 after onboarding (opted in at the reminder step)")
                return
            }
            if app.labelled(L.onbNameTitle).exists {
                seen.append("name")
                if let field = app.field(below: L.onbNameLabel, within: 5) {
                    enter("Camille Simulateur", into: field, "03 name")
                    dismissKeyboard()
                } else {
                    Walk.note("03 name: no field below \"\(L.onbNameLabel)\"")
                }
                shotAndContinue("03-name")
            } else if app.labelled(L.onbCantonTitle).exists {
                seen.append("canton")
                let geneve = app.labelled(L.cantonGeneve)
                Walk.note("03 canton: \"\(L.cantonGeneve)\" frame before=\(geneve.exists ? "\(geneve.frame)" : "-")")
                tapLabel(L.cantonGeneve, "03-canton")
                Walk.note("03 canton: \"\(L.cantonGeneve)\" tapped at frame=\(geneve.exists ? "\(geneve.frame)" : "-")")
                shotAndContinue("03-canton")
            } else if app.labelled(L.onbRateTitle).exists {
                seen.append("rate")
                tapLabel(L.onbRate100, "03-rate")
                shotAndContinue("03-rate")
            } else if app.labelled(L.onbMethodTitle).exists {
                seen.append("method")
                tapLabel(L.onbMethodSimplified, "03-method")
                shotAndContinue("03-method")
            } else if app.labelled(L.onbGranularityTitle).exists {
                seen.append("granularity")
                tapLabel(L.onbGranularityDay, "03-granularity")
                shotAndContinue("03-granularity")
            } else if app.labelled(L.onbPeriodTitle).exists {
                seen.append("period")
                tapLabel(L.onbPeriodPart, "03-period")
                Thread.sleep(forTimeInterval: 1)
                if let start = app.field(below: L.onbPeriodStart, within: 5) {
                    press(start)
                    Thread.sleep(forTimeInterval: 2)
                    pickDate("03")
                } else {
                    Walk.tree("03-no-start-field", app)
                    Walk.note("FAIL 03 period: no start-date box below \"\(L.onbPeriodStart)\"")
                }
                shotAndContinue("03-period")
            } else if app.labelled(L.onbModeTitle).exists {
                seen.append("mode")
                tapLabel(L.onbModeManual, "03-mode")
                shotAndContinue("03-mode")
            } else if app.labelled(L.onbReminderTitle).exists {
                seen.append("reminder")
                Walk.shot("03-reminder")
                tapLabel(L.onbReminderYes, "03-reminder")
                notificationAlert("03")
            } else if app.labelled(L.onbReadyTitle).exists {
                seen.append("ready")
                shotAndContinue("03-ready")
            } else {
                Walk.tree("03-unknown-\(round)", app)
                Walk.shot("03-unknown-\(round)")
                unknown += 1
                Walk.note("03 onboarding: round \(round) shows no known screen (tree 03-unknown-\(round))")
            }
        }
        Walk.note("FAIL 03 onboarding did not reach the tabs: \(seen.joined(separator: " > "))")
        XCTFail("onboarding did not finish")
    }

    private func shotAndContinue(_ name: String) {
        Walk.tree(name, app)
        Walk.shot(name)
        tapLabel(L.onbContinue, name + "-continue")
    }

    /// DRIVER PROOF (c): the native UIDatePicker (UIKit inside Compose, IosStartDatePicker's dialog) found, its value read,
    /// a day chosen, the value read again, and the dialog confirmed with its "Continuer". Used by onboarding and Parametres.
    @discardableResult
    private func pickDate(_ step: String) -> Bool {
        let picker = app.datePickers.firstMatch
        guard picker.waitForExistence(timeout: 10) else {
            Walk.tree("\(step)-no-datepicker", app)
            Walk.shot("\(step)-no-datepicker")
            Walk.note("FAIL \(step) DRIVER PROOF (c): no UIDatePicker in the tree")
            return false
        }
        let days = picker.buttons.allElementsBoundByIndex.filter {
            $0.isEnabled && $0.label.rangeOfCharacter(from: .decimalDigits) != nil
                && !$0.label.contains("Month") && !$0.label.lowercased().contains("mois")
        }
        Walk.note("\(step) DRIVER PROOF (c): UIDatePicker found; value before=\"\(picker.value ?? "nil")\"; "
            + "\(days.count) day button(s), e.g. \(days.prefix(3).map { $0.label })")
        Walk.tree("\(step)-datepicker-open", app)
        Walk.shot("\(step)-datepicker-open")
        if days.count > 2 {
            Walk.note("\(step) date picker: choosing \"\(days[2].label)\"")
            press(days[2])
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("\(step) DRIVER PROOF (c): value after=\"\(app.datePickers.firstMatch.value ?? "nil")\"")
        if let confirm = lastLabelled(L.onbContinue) { press(confirm) }
        Thread.sleep(forTimeInterval: 1.5)
        return true
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
        signIn(Walk.accountA, step: "21")
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
        press(chip)
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
            press(cell)
            Thread.sleep(forTimeInterval: 1.5)
            Walk.tree("24-sheet-\(pass)", app)
            Walk.shot("24-sheet-\(pass)")
            guard app.labelled(L.sheetQuestion).waitForExistence(timeout: 5),
                  let option = lastLabelled(choice) else {
                Walk.note("FAIL 24 pass \(pass): no sheet \"\(L.sheetQuestion)\" with \"\(choice)\"")
                XCTFail("no sheet")
                return
            }
            press(option)
            Thread.sleep(forTimeInterval: 0.5)
            if let save = lastLabelled(L.sheetSave) { press(save) }
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
        press(chip)
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
        press(app.labelled("\(previous)"))
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
        press(row)
        Thread.sleep(forTimeInterval: 1.5)
        tapLabel(L.startDatePick, "28-pick")
        Thread.sleep(forTimeInterval: 2)
        guard pickDate("28") else {
            XCTFail("no date picker")
            return
        }
        Walk.tree("28-sheet-after-pick", app)
        Walk.shot("28-sheet-after-pick")
        // NOT SAVED: the account's period stays whole-year, so nothing later in the walk depends on this step.
        if let cancel = lastLabelled(L.sheetCancel) { press(cancel) }
        Thread.sleep(forTimeInterval: 1.5)
        Walk.note("28 the sheet cancelled (not saved); the row reads \"\(app.containing(L.startDateRow).label)\"")
    }

    // MARK: - 29 Parametres: the evening switch PRESENT and the alert switch ABSENT; the opt-in; DRIVER PROOF (b); M4

    func test29_evening() {
        foreground()
        tapLabel(L.tabParametres, "29-tab")
        Thread.sleep(forTimeInterval: 2)
        // Run 45099570712: the switch row is ONE merged element whose label BEGINS with the evening label (headline and
        // supporting text), so both rows are matched by BEGINSWITH - the absence check too, or it could not see a
        // merged alert row any more than the exact match saw the evening one (R169's corollary).
        let label = starting(L.eveningLabel)
        guard reveal(label, L.eveningLabel, "29-evening") else { return }
        Walk.note("29 parametres: \"\(L.eveningLabel)\" PRESENT=true (\"\(label.label)\"); \"\(L.alertLabel)\" PRESENT="
            + "\(starting(L.alertLabel).exists) (iOS Ruling 3 Q4: must be ABSENT)")
        Walk.notePending("29 BEFORE the opt-in")
        let row = label.frame
        let near = app.switches.allElementsBoundByIndex.filter { abs($0.frame.midY - row.midY) < 60 && $0.frame.width > 0 }
        if let toggle = near.first {
            Walk.note("29 the evening switch: value before=\"\(toggle.value ?? "nil")\"; tapped")
            press(toggle)
        } else {
            let window = app.windows.firstMatch.frame
            let y = row.height > 60 ? row.midY : row.midY + 12
            Walk.note("29 no switch element beside the label (\(app.switches.count) in the tree; the row "
                + "\(row)): a tap at the row's trailing edge, where the switch is drawn")
            app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
                .withOffset(CGVector(dx: window.width - 62, dy: y)).tap()
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
        if let back = lastLabelled(L.licencesBack) { press(back) }
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
        if let confirm = lastLabelled(L.signOut) { press(confirm) }
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
        if app.labelled(L.welcomeStart).exists { press(app.labelled(L.welcomeStart)) }
        signIn(Walk.accountA, step: "32")
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
        if app.labelled(L.welcomeStart).exists { press(app.labelled(L.welcomeStart)) }
        signIn(Walk.accountB, step: "34")
        _ = expectMainWithoutOnboarding("34")
        Thread.sleep(forTimeInterval: 5)
        Walk.notePending("34 M3 BEFORE deletion (B's reminder is ON on the server)")
        tapLabel(L.tabParametres, "34-tab")
        tapLabel(L.deleteRow, "34-delete-row")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("34-delete", app)
        let prompt = app.containing(L.deleteWord)
        if let field = app.field(belowElement: prompt, within: 5) {
            enter(L.deleteWord, into: field, "34 confirmation word")
            dismissKeyboard()
        } else {
            Walk.note("FAIL 34 no confirmation field")
        }
        Walk.shot("34-delete-confirm")
        tapLabel(L.deleteConfirm, "34-delete-confirm")
        let done = app.labelled(L.deleteDoneTitle).waitForExistence(timeout: 30)
        Walk.note("34 account deleted: \"\(L.deleteDoneTitle)\" shown=\(done)")
        Walk.shot("34-deleted")
        if let ack = lastLabelled(L.deleteDoneAck) { press(ack) }
        Thread.sleep(forTimeInterval: 2)
        Walk.notePending("34 M3 AFTER deletion")
    }
}
