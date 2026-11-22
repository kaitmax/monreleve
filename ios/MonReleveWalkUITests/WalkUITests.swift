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
            + "timeZone=\(Walk.probeValue("timeZone", lines) ?? "?")")
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
        let email = app.textFields.firstMatch
        guard email.waitForExistence(timeout: 30) else {
            Walk.tree("\(step)-no-email-field", app)
            XCTFail("no e-mail field")
            return
        }
        Walk.tree("\(step)-signin", app)
        Walk.shot("\(step)-signin")
        email.tap()
        email.typeText(address)
        let before = Walk.mailCount(address)
        tapLabel(L.signInSubmit, "\(step)-submit")
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
        let field = app.textFields.firstMatch
        field.tap()
        field.typeText(code)
        let submit = app.labelled(L.codeSubmit)
        if submit.exists && submit.isHittable { submit.tap() }
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

    // MARK: - 03 onboarding, manual-only, the native start-date picker opened (iOS Ruling 13 Q2)

    func test03_onboarding() {
        foreground()
        var seen: [String] = []
        for round in 0..<20 {
            Thread.sleep(forTimeInterval: 1.5)
            if app.labelled(L.tabParametres).exists && app.labelled(L.tabCalendrier).exists {
                Walk.note("03 onboarding done after \(round) screen(s): \(seen.joined(separator: " > "))")
                return
            }
            if app.labelled(L.onbNameTitle).exists {
                seen.append("name")
                let field = app.textFields.firstMatch
                field.tap()
                field.typeText("Camille Simulateur")
                shotAndContinue("03-name")
            } else if app.labelled(L.onbCantonTitle).exists {
                seen.append("canton")
                tapLabel(L.cantonGeneve, "03-canton")
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
                datePicker()
                shotAndContinue("03-period")
            } else if app.labelled(L.onbModeTitle).exists {
                seen.append("mode")
                tapLabel(L.onbModeManual, "03-mode")
                shotAndContinue("03-mode")
            } else if app.labelled(L.onbReminderTitle).exists {
                seen.append("reminder")
                Walk.shot("03-reminder")
                tapLabel(L.onbReminderYes, "03-reminder")
                notificationAlert()
            } else if app.labelled(L.onbReadyTitle).exists {
                seen.append("ready")
                shotAndContinue("03-ready")
            } else {
                Walk.tree("03-unknown-\(round)", app)
                Walk.shot("03-unknown-\(round)")
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
    private func notificationAlert() {
        let alert = WalkUITests.springboard.alerts.firstMatch
        guard alert.waitForExistence(timeout: 15) else {
            Walk.note("FAIL 03 DRIVER PROOF (b): no system alert within 15 s of \"\(L.onbReminderYes)\"")
            return
        }
        let buttons = alert.buttons.allElementsBoundByIndex.map { $0.label }
        Walk.note("03 DRIVER PROOF (b): system alert \"\(alert.label)\" buttons=\(buttons)")
        Walk.shot("03-notification-alert")
        let allow = alert.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "Autoriser"])).firstMatch
        if allow.exists { allow.tap() } else { alert.buttons.element(boundBy: alert.buttons.count - 1).tap() }
        Thread.sleep(forTimeInterval: 2)
        Walk.notePending("03 after the alert")
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
}
