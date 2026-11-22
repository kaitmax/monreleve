// ios/MonReleveWalkUITests/WalkUITests.swift
//
// IOS-WALK (I2) R1344. THE WALK, DRIVEN THROUGH THE REAL APP ON THE SIMULATOR (XCUITest) AGAINST THE RUNNER'S OWN
// THROWAWAY SERVER. The tests run in name order and share ONE app process: each continues where the last stopped
// (activate, never a relaunch, unless the step IS a relaunch). Every step writes a line to the result file through
// the helper; every screenshot is the real simulator screen (simctl), named in the result file.
//
// R1342 / R574: the code screen is NEVER photographed and NEVER dumped once a digit has been typed into it; the code
// itself is fetched from the helper (which has already masked it in the job log) and goes only into typeText.

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

    private func tapLabel(_ label: String, _ step: String, within seconds: TimeInterval = 20) {
        let element = app.labelled(label)
        guard element.waitForExistence(timeout: seconds) else {
            Walk.tree("missing-\(step)", app)
            Walk.note("FAIL \(step): no element labelled \"\(label)\" within \(Int(seconds)) s (tree missing-\(step))")
            XCTFail("no element labelled \(label)")
            return
        }
        element.tap()
    }

    // MARK: - 01 first launch (R1321's Keychain clear is the app's own first-launch path)

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

    // MARK: - 02 code sign-in (iOS Ruling 3 Q2)

    func test02_signIn() {
        foreground()
        signIn(Walk.accountA, step: "02")
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
        let keyboard = app.type(address, into: email)
        Walk.note("\(step) sign-in: e-mail typed (keyboard shown=\(keyboard))")
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
        guard let field = app.field(below: L.codeLabel) else {
            Walk.note("FAIL \(step): no code field below \"\(L.codeLabel)\"")
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
                     "retour"]
        let key = keyboard.buttons.matching(NSPredicate(format: "label IN %@", names)).firstMatch
        if key.exists {
            key.tap()
        } else {
            Walk.note("keyboard: no return key among \(keyboard.buttons.allElementsBoundByIndex.suffix(4).map { $0.label })")
        }
        Thread.sleep(forTimeInterval: 1)
    }

    // MARK: - 03 onboarding, manual-only, the native start-date picker opened (iOS Ruling 13 Q2)

    func test03_onboarding() {
        foreground()
        onboard("03", partYear: true)
    }

    private func onboard(_ step: String, partYear: Bool) {
        var seen: [String] = []
        var unknown = 0
        for round in 0..<20 {
            if unknown >= 4 { break }
            Thread.sleep(forTimeInterval: 1.5)
            if app.labelled(L.tabParametres).exists && app.labelled(L.tabCalendrier).exists {
                Walk.note("\(step) onboarding done after \(round) screen(s): \(seen.joined(separator: " > "))")
                return
            }
            if app.labelled(L.onbNameTitle).exists {
                seen.append("name")
                if let field = app.field(below: L.onbNameLabel, within: 5) {
                    _ = app.type("Camille Simulateur", into: field)
                    dismissKeyboard()
                } else {
                    Walk.note("\(step) name: no field below \"\(L.onbNameLabel)\"")
                }
                shotAndContinue("\(step)-name")
            } else if app.labelled(L.onbCantonTitle).exists {
                seen.append("canton")
                tapLabel(L.cantonGeneve, "\(step)-canton")
                shotAndContinue("\(step)-canton")
            } else if app.labelled(L.onbRateTitle).exists {
                seen.append("rate")
                tapLabel(L.onbRate100, "\(step)-rate")
                shotAndContinue("\(step)-rate")
            } else if app.labelled(L.onbMethodTitle).exists {
                seen.append("method")
                tapLabel(L.onbMethodSimplified, "\(step)-method")
                shotAndContinue("\(step)-method")
            } else if app.labelled(L.onbGranularityTitle).exists {
                seen.append("granularity")
                tapLabel(L.onbGranularityDay, "\(step)-granularity")
                shotAndContinue("\(step)-granularity")
            } else if app.labelled(L.onbPeriodTitle).exists {
                seen.append("period")
                if partYear {
                    tapLabel(L.onbPeriodPart, "\(step)-period")
                    datePicker()
                } else {
                    tapLabel(L.onbPeriodAll, "\(step)-period")
                }
                shotAndContinue("\(step)-period")
            } else if app.labelled(L.onbModeTitle).exists {
                seen.append("mode")
                tapLabel(L.onbModeManual, "\(step)-mode")
                shotAndContinue("\(step)-mode")
            } else if app.labelled(L.onbReminderTitle).exists {
                seen.append("reminder")
                Walk.shot("\(step)-reminder")
                tapLabel(L.onbReminderYes, "\(step)-reminder")
                notificationAlert(step)
            } else if app.labelled(L.onbReadyTitle).exists {
                seen.append("ready")
                shotAndContinue("\(step)-ready")
            } else {
                Walk.tree("\(step)-unknown-\(round)", app)
                Walk.shot("\(step)-unknown-\(round)")
                unknown += 1
                Walk.note("\(step) onboarding: round \(round) shows no known screen (tree \(step)-unknown-\(round))")
            }
        }
        Walk.note("FAIL \(step) onboarding did not reach the tabs: \(seen.joined(separator: " > "))")
        XCTFail("onboarding did not finish")
    }

    private func shotAndContinue(_ name: String) {
        Walk.tree(name, app)
        Walk.shot(name)
        tapLabel(L.onbContinue, name + "-continue")
    }

    /// DRIVER PROOF (c): the native UIDatePicker (UIKit inside Compose) found, its value read, OPENED, a date chosen.
    private func datePicker() {
        let picker = app.datePickers.firstMatch
        guard picker.waitForExistence(timeout: 10) else {
            Walk.tree("03-no-datepicker", app)
            Walk.note("FAIL 03 DRIVER PROOF (c): no UIDatePicker in the tree after choosing a start in the year")
            return
        }
        Walk.note("03 DRIVER PROOF (c): UIDatePicker found; value before=\"\(picker.value ?? "nil")\" "
            + "buttons=\(picker.buttons.allElementsBoundByIndex.map { $0.label })")
        picker.tap()
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("03-datepicker-open", app)
        Walk.shot("03-datepicker-open")
        let days = app.collectionViews.buttons.allElementsBoundByIndex.filter { $0.isEnabled }
        Walk.note("03 date picker opened: \(app.datePickers.count) picker(s) in the tree, \(days.count) day button(s)")
        if days.count > 1 {
            let chosen = days[1]
            Walk.note("03 date picker: choosing \"\(chosen.label)\"")
            chosen.tap()
            Thread.sleep(forTimeInterval: 1)
        }
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.06)).tap()
        Thread.sleep(forTimeInterval: 1)
        let after = app.datePickers.firstMatch
        Walk.note("03 DRIVER PROOF (c): value after=\"\(after.value ?? "nil")\" "
            + "buttons=\(after.buttons.allElementsBoundByIndex.map { $0.label })")
        Walk.tree("03-datepicker-after", app)
    }

    /// DRIVER PROOF (b): past the system notification-permission alert (SpringBoard's, not the app's).
    private func notificationAlert(_ step: String) {
        let alert = WalkUITests.springboard.alerts.firstMatch
        guard alert.waitForExistence(timeout: 15) else {
            Walk.note("\(step) no system alert within 15 s of \"\(L.onbReminderYes)\" (expected only on the FIRST ask)")
            Walk.notePending("\(step) after the reminder answer")
            return
        }
        let buttons = alert.buttons.allElementsBoundByIndex.map { $0.label }
        Walk.note("\(step) DRIVER PROOF (b): system alert \"\(alert.label)\" buttons=\(buttons)")
        Walk.shot("\(step)-notification-alert")
        let allow = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "Autoriser"])).firstMatch
        if allow.exists { allow.tap() } else { alert.buttons.element(boundBy: alert.buttons.count - 1).tap() }
        Thread.sleep(forTimeInterval: 2)
        Walk.notePending("\(step) after the alert")
    }

    // MARK: - 04 Aujourd'hui: today recorded while the server is unreachable, then a REAL background/foreground

    func test04_todayAndForeground() {
        foreground()
        tapLabel(L.tabAujourdhui, "04-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("04-aujourdhui", app)
        Walk.shot("04-aujourdhui")
        Walk.notePending("04 before recording today")
        Walk.call("/down")
        Walk.note("04 relay DOWN: the app's requests now answer 503")
        tapLabel(L.todaySuisse, "04-suisse")
        let pending = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", L.todayPending)).firstMatch
        let shownPending = pending.waitForExistence(timeout: 30)
        Walk.note("04 today recorded with the server unreachable: \"\(L.todayPending)\" shown=\(shownPending)")
        Walk.tree("04-today-pending", app)
        Walk.shot("04-today-pending")
        Walk.call("/up")
        let t0 = Date().timeIntervalSince1970
        Walk.note("04 relay UP; pressing Home (a REAL background)")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 4)
        Walk.note("04 app state in the background: \(app.state.rawValue) (1=notRunning 2=bgSuspended 3=bg 4=fg)")
        Walk.noteRequestsSince(t0, "04 while in the background")
        let t1 = Date().timeIntervalSince1970
        app.activate()
        var drained = false
        for _ in 0..<60 {
            if !pending.exists { drained = true; break }
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("04 foreground: \"\(L.todayPending)\" gone=\(drained); \"\(L.todaySynced)\" shown="
            + "\(app.labelled(L.todaySynced).exists)")
        Walk.noteRequestsSince(t1, "04 after the foreground (the drain)")
        Walk.notePending("04 after the foreground (the re-plan)")
        Walk.tree("04-today-synced", app)
        Walk.shot("04-today-synced")
    }

    // MARK: - 05 the other tabs, read (this increment dumps them for the steps that follow)

    func test05_tabs() {
        foreground()
        for (tab, name) in [(L.tabCalendrier, "05-calendrier"), (L.tabReleve, "05-releve"),
                            (L.tabParametres, "05-parametres")] {
            tapLabel(tab, name)
            Thread.sleep(forTimeInterval: 2)
            Walk.tree(name, app)
            Walk.shot(name)
        }
        for page in 1...3 {
            app.swipeUp()
            Thread.sleep(forTimeInterval: 1)
            Walk.tree("05-parametres-\(page)", app)
            Walk.shot("05-parametres-\(page)")
        }
        Walk.note("05 tabs dumped")
    }

    // MARK: - helpers for the rest of the walk

    /// The last element labelled [label] (a dialog's button sits after the row that opened it).
    private func lastLabelled(_ label: String) -> XCUIElement? {
        let all = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
            .allElementsBoundByIndex
        return all.last
    }

    private func waitMain(_ seconds: TimeInterval) -> Bool {
        app.labelled(L.tabParametres).waitForExistence(timeout: seconds) && app.labelled(L.tabCalendrier).exists
    }

    private func relaunch(_ extra: [String] = []) {
        app.terminate()
        app.launchArguments = ["-walkProbe", "YES"] + extra
        app.launch()
    }

    /// A working day of this month, before today and after the 3rd (the onboarding's start date is early in the
    /// month) - the "another day" the calendar records. Paris calendar, as every recorded day is.
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

    // MARK: - 06 the calendar: another day recorded, then changed

    func test06_calendar() {
        foreground()
        tapLabel(L.tabCalendrier, "06-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("06-calendrier", app)
        Walk.shot("06-calendrier")
        guard let day = WalkUITests.anotherDay() else {
            Walk.note("06 calendar: no working day between the 4th and yesterday this month - step NOT RUN")
            return
        }
        for (pass, choice) in [(1, L.todayDomicile), (2, L.todaySuisse)] {
            let cell = dayCell(day)
            guard cell.waitForExistence(timeout: 10) else {
                Walk.note("FAIL 06 calendar: no cell labelled \"Jour \(day), ...\"")
                Walk.tree("06-no-cell", app)
                XCTFail("no day cell")
                return
            }
            Walk.note("06 pass \(pass): day \(day) before: \"\(cell.label)\"")
            cell.tap()
            Thread.sleep(forTimeInterval: 1.5)
            Walk.tree("06-sheet-\(pass)", app)
            Walk.shot("06-sheet-\(pass)")
            guard app.labelled(L.sheetQuestion).waitForExistence(timeout: 5),
                  let option = lastLabelled(choice) else {
                Walk.note("FAIL 06 pass \(pass): no sheet \"\(L.sheetQuestion)\" with \"\(choice)\"")
                XCTFail("no sheet")
                return
            }
            option.tap()
            Thread.sleep(forTimeInterval: 0.5)
            if let save = lastLabelled(L.sheetSave) { save.tap() }
            Thread.sleep(forTimeInterval: 2.5)
            Walk.note("06 pass \(pass): chose \"\(choice)\"; day \(day) after: \"\(dayCell(day).label)\"")
            Walk.shot("06-after-\(pass)")
        }
    }

    // MARK: - 07 the server side: the year read back THROUGH THE API with the app's own session

    func test07_serverEntries() {
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        let (status, data) = Walk.call("/entries?year=\(year)&n=1")
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let entries = (object?["entries"] as? [[String: Any]]) ?? []
        Walk.note("07 server: GET /api/v1/entries?year=\(year) -> \(status), \(entries.count) entr(y/ies) "
            + "(saved as server-entries-1.json)")
        for entry in entries {
            let keys = entry.keys.sorted().filter { $0.lowercased().contains("at") || $0 == "date" || $0 == "kind" }
            Walk.note("07 server:   " + keys.map { "\($0)=\(entry[$0].map { "\($0)" } ?? "nil")" }.joined(separator: " "))
        }
    }

    // MARK: - 08 the releve: the export's share sheet; the employer comparison, its figure kept across a relaunch

    func test08_releveAndComparison() {
        foreground()
        tapLabel(L.tabReleve, "08-tab")
        Thread.sleep(forTimeInterval: 3)
        Walk.tree("08-releve", app)
        Walk.shot("08-releve")
        if app.labelled(L.exportPdf).waitForExistence(timeout: 10) {
            app.labelled(L.exportPdf).tap()
            Thread.sleep(forTimeInterval: 8)
            let sheet = app.descendants(matching: .any).matching(identifier: "ActivityListView").count > 0
            Walk.note("08 export: share sheet (ActivityListView) shown=\(sheet)")
            Walk.tree("08-share", app)
            Walk.shot("08-share-sheet")
            let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Fermer", "Cancel"])).firstMatch
            if close.exists { close.tap() } else { app.swipeDown(velocity: .fast) }
            Thread.sleep(forTimeInterval: 2)
        } else {
            Walk.note("FAIL 08 export: no \"\(L.exportPdf)\"")
        }
        let previous = Calendar(identifier: .gregorian).component(.year, from: Date()) - 1
        let chip = app.labelled("\(previous)")
        guard chip.waitForExistence(timeout: 5) else {
            Walk.note("FAIL 08 comparison: no \(previous) chip on the releve (tree 08-releve)")
            XCTFail("no previous-year chip")
            return
        }
        chip.tap()
        Thread.sleep(forTimeInterval: 3)
        tapLabel(L.compareEmployer, "08-compare")
        Thread.sleep(forTimeInterval: 2)
        Walk.tree("08-comparison", app)
        guard let field = app.field(below: L.comparisonTitle) else {
            Walk.note("FAIL 08 comparison: no employer field")
            XCTFail("no employer field")
            return
        }
        _ = app.type("40,5", into: field)
        dismissKeyboard()
        Thread.sleep(forTimeInterval: 1)
        Walk.note("08 comparison \(previous): employer figure typed \"40,5\"; \"40,50\" shown="
            + "\(app.containing("40,50").exists)")
        Walk.tree("08-comparison-set", app)
        Walk.shot("08-comparison-set")
        relaunch()
        _ = waitMain(60)
        tapLabel(L.tabReleve, "08-tab-again")
        Thread.sleep(forTimeInterval: 3)
        app.labelled("\(previous)").tap()
        Thread.sleep(forTimeInterval: 3)
        tapLabel(L.compareEmployer, "08-compare-again")
        Thread.sleep(forTimeInterval: 2)
        Walk.note("08 comparison after a RELAUNCH: \"40,50\" shown=\(app.containing("40,50").exists)")
        Walk.tree("08-comparison-relaunched", app)
        Walk.shot("08-comparison-relaunched")
        relaunch()
        _ = waitMain(60)
    }

    // MARK: - 09 Parametres: the evening switch present, the threshold alert ABSENT, a legal page opened

    func test09_parametres() {
        foreground()
        tapLabel(L.tabParametres, "09-tab")
        Thread.sleep(forTimeInterval: 2)
        let evening = app.labelled(L.eveningLabel)
        Walk.note("09 parametres: \"\(L.eveningLabel)\" PRESENT=\(evening.exists) value=\"\(evening.value ?? "nil")\"; "
            + "\"\(L.alertLabel)\" PRESENT=\(app.labelled(L.alertLabel).exists) (iOS Ruling 3 Q4: must be absent)")
        Walk.notePending("09 reminder opt-in on")
        Walk.tree("09-parametres", app)
        Walk.shot("09-parametres")
        let licences = app.labelled(L.licencesTitle)
        if licences.exists {
            licences.tap()
            Thread.sleep(forTimeInterval: 2)
            Walk.note("09 legal page opened IN THE APP: \"\(L.licencesTitle)\" "
                + "(the monreleve.ch legal rows are NOT tapped: they open the production site in Safari)")
            Walk.tree("09-licences", app)
            Walk.shot("09-licences")
            if let back = lastLabelled(L.licencesBack) { back.tap() }
            Thread.sleep(forTimeInterval: 1.5)
        } else {
            Walk.note("FAIL 09 no \"\(L.licencesTitle)\" row")
        }
    }

    // MARK: - 10 sign-out: the pending set before (> 0) and after (0); a relaunch reaches sign-in

    private func signOutHere(_ step: String) {
        tapLabel(L.tabParametres, "\(step)-tab")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.notePending("\(step) BEFORE sign-out")
        tapLabel(L.signOut, "\(step)-signout-row")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("\(step)-signout-dialog", app)
        Walk.shot("\(step)-signout-dialog")
        if let confirm = lastLabelled(L.signOut) { confirm.tap() }
        let out = app.labelled(L.welcomeStart).waitForExistence(timeout: 30)
            || app.labelled(L.signInSubmit).waitForExistence(timeout: 5)
        Walk.note("\(step) signed out: sign-in reached=\(out)")
        Walk.notePending("\(step) AFTER sign-out")
    }

    func test10_signOut() {
        foreground()
        signOutHere("10")
        relaunch()
        let signIn = app.labelled(L.welcomeStart).waitForExistence(timeout: 30)
            || app.labelled(L.signInSubmit).waitForExistence(timeout: 5)
        Walk.note("10 relaunch after sign-out reaches sign-in=\(signIn)")
        Walk.shot("10-relaunch-signed-out")
    }

    // MARK: - 11 the same account again: the year downloads; today's request absent (iOS Ruling 16 Q3)

    func test11_signInAgain() {
        foreground()
        if app.labelled(L.welcomeStart).exists { app.labelled(L.welcomeStart).tap() }
        signIn(Walk.accountA, step: "11")
        let main = waitMain(90)
        Walk.note("11 second sign-in: main reached=\(main) (no onboarding expected: the settings are the server's)")
        Thread.sleep(forTimeInterval: 8)
        tapLabel(L.tabAujourdhui, "11-tab")
        Thread.sleep(forTimeInterval: 2)
        Walk.note("11 Aujourd'hui after the download: \"\(L.todaySynced)\" shown=\(app.labelled(L.todaySynced).exists)")
        Walk.shot("11-aujourdhui-again")
        tapLabel(L.tabCalendrier, "11-cal")
        Thread.sleep(forTimeInterval: 2)
        if let day = WalkUITests.anotherDay() {
            Walk.note("11 calendar after the download: day \(day) \"\(dayCell(day).label)\"")
        }
        Walk.shot("11-calendrier-again")
        Walk.notePending("11 YEARS AND THE PLAN (today recorded before the sign-out)")
    }

    // MARK: - 12 THE TAP: a delivered reminder, tapped, opens Aujourd'hui (R1330)

    func test12_reminderTap() {
        relaunch(["-walkNearTap", "YES"])
        _ = waitMain(60)
        tapLabel(L.tabParametres, "12-tab")
        Thread.sleep(forTimeInterval: 1)
        let lines = Walk.freshProbe()
        Walk.note("12 near copy: \(Walk.probeValue("nearTap.added", lines) ?? "not yet")")
        XCUIDevice.shared.press(.home)
        let banner = WalkUITests.springboard.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", L.reminderTitle)).firstMatch
        let delivered = banner.waitForExistence(timeout: 30)
        Walk.note("12 banner with \"\(L.reminderTitle)\" delivered on the simulator=\(delivered)")
        Walk.shot("12-banner")
        guard delivered else { app.activate(); return }
        banner.tap()
        let opened = app.wait(for: .runningForeground, timeout: 15)
        Thread.sleep(forTimeInterval: 3)
        let onToday = app.labelled(L.todaySynced).exists || app.labelled(L.todayQuestion).exists
        Walk.note("12 THE TAP: app foreground=\(opened); Aujourd'hui shown=\(onToday) "
            + "(the tap was made from the Parametres tab)")
        Walk.tree("12-after-tap", app)
        Walk.shot("12-after-tap")
    }

    // MARK: - 13 M3 for account deletion, on a second @monreleve.test account

    func test13_accountDeletion() {
        foreground()
        signOutHere("13a")
        if app.labelled(L.welcomeStart).exists { app.labelled(L.welcomeStart).tap() }
        signIn(Walk.accountB, step: "13")
        onboard("13", partYear: false)
        Thread.sleep(forTimeInterval: 3)
        Walk.notePending("13 BEFORE deletion")
        tapLabel(L.tabParametres, "13-tab")
        tapLabel(L.deleteRow, "13-delete-row")
        Thread.sleep(forTimeInterval: 1.5)
        Walk.tree("13-delete", app)
        let prompt = app.containing(L.deleteWord)
        if let field = app.field(belowElement: prompt, within: 5) {
            _ = app.type(L.deleteWord, into: field)
            dismissKeyboard()
        } else {
            Walk.note("FAIL 13 no confirmation field")
        }
        Walk.shot("13-delete-confirm")
        tapLabel(L.deleteConfirm, "13-delete-confirm")
        let done = app.labelled(L.deleteDoneTitle).waitForExistence(timeout: 30)
        Walk.note("13 account deleted: \"\(L.deleteDoneTitle)\" shown=\(done)")
        Walk.shot("13-deleted")
        if let ack = lastLabelled(L.deleteDoneAck) { ack.tap() }
        Thread.sleep(forTimeInterval: 2)
        Walk.notePending("13 AFTER deletion")
    }

    // MARK: - 14 R1346: the mail's link requested by the runner FIRST, then the code typed (a third account)

    func test14_linkThenCode() {
        foreground()
        if app.labelled(L.welcomeStart).exists { app.labelled(L.welcomeStart).tap() }
        guard let email = app.field(below: L.emailLabel) else {
            Walk.note("FAIL 14 no e-mail field")
            XCTFail("no e-mail field")
            return
        }
        let before = Walk.mailCount(Walk.accountC)
        _ = app.type(Walk.accountC, into: email)
        dismissKeyboard()
        if app.labelled(L.signInSubmit).exists && !app.labelled(L.codeTitle).exists {
            app.labelled(L.signInSubmit).tap()
        }
        guard app.shows(L.codeTitle, within: 60), let code = Walk.code(Walk.accountC, after: before) else {
            Walk.note("FAIL 14 no code screen or no code (NO RESULT)")
            XCTFail("no code")
            return
        }
        let link = (Walk.json("/link?to=" + Walk.q(Walk.accountC)) as? [String: Any]) ?? [:]
        Walk.note("14 R1346 the link GET by the runner first: status=\(link["status"] ?? "?") "
            + "location=\(link["location"] ?? "?")")
        guard let field = app.field(below: L.codeLabel) else {
            Walk.note("FAIL 14 no code field")
            return
        }
        _ = app.type(code, into: field)
        dismissKeyboard()
        if app.labelled(L.codeSubmit).exists { app.labelled(L.codeSubmit).tap() }
        var left = false
        for _ in 0..<30 {
            if !app.labelled(L.codeTitle).exists { left = true; break }
            Thread.sleep(forTimeInterval: 1)
        }
        Walk.note("14 R1346 FINDING: after the link was opened, the code still signs in=\(left)")
        if left {
            Walk.shot("14-after-code")
        } else {
            let shown = app.descendants(matching: .any).allElementsBoundByIndex.map { $0.label }
                .filter { !$0.isEmpty && !$0.contains(code) && $0.count < 200 && $0 != "Mon Relevé" }
            Walk.note("14 code screen texts: \(shown.prefix(12).joined(separator: " | "))")
        }
    }
}
