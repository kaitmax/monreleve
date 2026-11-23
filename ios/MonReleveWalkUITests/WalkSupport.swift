// ios/MonReleveWalkUITests/WalkSupport.swift
//
// IOS-WALK (I2). THE WALK'S LINE TO THE RUNNER: the helper (.github/scripts/ios-walk-helper.py) on 127.0.0.1, reached
// from the UI-test process over plain http to a loopback address (the same path the ios-shared wire test takes).
// Everything the walk records goes through it: result lines, screenshots (simctl, the real screen), accessibility
// dumps, the app's walk-probe file, the relay's request list. The helper refuses a note or a dump that carries a code
// or a token it has seen (R1342), and the walk itself never dumps or photographs the code screen once a digit is typed.

import Foundation
import XCTest

enum Walk {
    static let env = ProcessInfo.processInfo.environment
    static let control = env["WALK_CONTROL"] ?? "http://127.0.0.1:3320"
    static let accountA = env["WALK_ACCOUNT_A"] ?? "walk-a@monreleve.test"
    static let accountB = env["WALK_ACCOUNT_B"] ?? "walk-b@monreleve.test"
    static let accountC = env["WALK_ACCOUNT_C"] ?? "walk-c@monreleve.test"
    // IOS-WALK-2: the NEW account of the onboarding track (R1382's diagnostic); A and B are made through the API first.
    static let accountN = env["WALK_ACCOUNT_N"] ?? "walk-n@monreleve.test"
    static let bundle = "ch.monreleve.app"

    /// A synchronous request to the helper. Never logs the answer.
    @discardableResult
    static func call(_ path: String, method: String = "GET", body: Data? = nil, timeout: TimeInterval = 150)
        -> (status: Int, data: Data) {
        guard let url = URL(string: control + path) else { return (-1, Data()) }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = method
        request.httpBody = body
        let done = DispatchSemaphore(value: 0)
        var result: (Int, Data) = (-1, Data())
        URLSession.shared.dataTask(with: request) { data, response, _ in
            result = ((response as? HTTPURLResponse)?.statusCode ?? -1, data ?? Data())
            done.signal()
        }.resume()
        _ = done.wait(timeout: .now() + timeout + 5)
        return result
    }

    static func q(_ text: String) -> String {
        text.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    }

    static func note(_ line: String) {
        call("/note?line=" + q(line))
    }

    static func shot(_ name: String) {
        call("/shot?name=" + q(name))
        note("SHOT " + name)
    }

    static func tree(_ name: String, _ app: XCUIApplication) {
        call("/tree?name=" + q(name), method: "POST", body: Data(app.debugDescription.utf8))
    }

    static func json(_ path: String) -> Any? {
        let (status, data) = call(path)
        guard status == 200 else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    static func mailCount(_ address: String) -> Int {
        (json("/mailcount?to=" + q(address)) as? [String: Any])?["count"] as? Int ?? -1
    }

    /// The six-digit code of the next mail to [address] - the helper masks it in the job log BEFORE answering.
    static func code(_ address: String, after: Int) -> String? {
        (json("/code?to=" + q(address) + "&after=\(after)") as? [String: Any])?["code"] as? String
    }

    /// The app's walk-probe file (WalkProbe.swift), as lines.
    static func probe() -> [String] {
        let (status, data) = call("/probe")
        guard status == 200 else { return [] }
        return String(decoding: data, as: UTF8.self).split(separator: "\n").map(String.init)
    }

    static func probeValue(_ key: String, _ lines: [String]) -> String? {
        lines.first { $0.hasPrefix(key + "=") }.map { String($0.dropFirst(key.count + 1)) }
    }

    static func pending(_ lines: [String]) -> [String] {
        lines.filter { $0.hasPrefix("pending=") }.map { String($0.dropFirst("pending=".count)) }
    }

    /// Waits until the probe file has been rewritten at least twice after now, so what it shows is current.
    static func freshProbe() -> [String] {
        let start = Int(probeValue("seq", probe()) ?? "0") ?? 0
        for _ in 0..<20 {
            let lines = probe()
            if let seq = Int(probeValue("seq", lines) ?? "0"), seq >= start + 2 { return lines }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return probe()
    }

    static func notePending(_ label: String) {
        let lines = freshProbe()
        let pending = pending(lines)
        note("\(label): authorization=\(probeValue("authorization", lines) ?? "?") "
            + "pending.count=\(pending.count) foregrounds=\(probeValue("foregrounds", lines) ?? "?")")
        for line in pending {
            note("\(label):   pending \(line)")
        }
    }

    /// The relay's forwarded requests, [t, method, path, status].
    static func requests() -> [[Any]] {
        (json("/requests") as? [[Any]]) ?? []
    }

    static func noteRequestsSince(_ t: Double, _ label: String) {
        let lines = requests().filter { (($0.first as? Double) ?? 0) >= t }
        note("\(label): \(lines.count) request(s) through the relay")
        for line in lines {
            note("\(label):   \(line.dropFirst().map { "\($0)" }.joined(separator: " "))")
        }
    }
}

extension XCUIApplication {
    /// The first element of any type whose label is exactly [label].
    func labelled(_ label: String) -> XCUIElement {
        descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func shows(_ label: String, within seconds: TimeInterval) -> Bool {
        labelled(label).waitForExistence(timeout: seconds)
    }

    /// The first element whose label CONTAINS [text].
    func containing(_ text: String) -> XCUIElement {
        descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    /// A Compose text field: run 45057577050 showed Compose 1.7.3 exposes an OutlinedTextField as an UNLABELLED
    /// Button (its label is drawn above it as a separate text). So the field is the nearest unlabelled, field-sized
    /// element BELOW the text [label] - found by geometry from the copy's own label, never by an index.
    func field(below label: String, within seconds: TimeInterval = 30) -> XCUIElement? {
        field(belowElement: labelled(label), within: seconds)
    }

    func field(belowElement anchor: XCUIElement, within seconds: TimeInterval = 30) -> XCUIElement? {
        guard anchor.waitForExistence(timeout: seconds) else { return nil }
        let top = anchor.frame.maxY - 1
        let candidates = descendants(matching: .any).allElementsBoundByIndex.filter { element in
            let frame = element.frame
            return element.label.isEmpty && frame.minY >= top && frame.height >= 36 && frame.height <= 120
                && frame.width >= 120 && [.button, .textField, .other].contains(element.elementType)
                && element.identifier.contains("SemanticsNode")
        }
        return candidates.min { $0.frame.minY < $1.frame.minY }
    }

    /// Taps [field], waits for the software keyboard, and types [text] (never logged by the walk).
    ///
    /// BY THE SOFTWARE KEYBOARD'S KEYS, not typeText: run 45059644071 showed the Compose field focused and the
    /// keyboard up, but typeText refused ("Neither element nor any descendant has keyboard focus") - Compose's text
    /// input view is not in the accessibility tree. The keys are UIKit's and are. Returns false (and types nothing
    /// more) at the first character no key could produce.
    func type(_ text: String, into field: XCUIElement) -> Bool {
        field.tap()
        let keyboard = keyboards.firstMatch
        guard keyboard.waitForExistence(timeout: 8) else { return false }
        let tip = buttons["Continue"]
        if tip.exists { tip.tap() }
        for character in text {
            if !typeKey(String(character), keyboard) { return false }
        }
        return true
    }

    /// IOS-WALK-2 (R1382): [text] put on the simulator's pasteboard by the helper (simctl pbcopy), then the field's own
    /// Paste - one action instead of one tap per key, so no key tap can be lost. Only for non-secret text: the helper
    /// refuses anything carrying a known secret or shaped like a code, so the sign-in code is never on the pasteboard
    /// (R574). Returns how far it got; the CALLER verifies by reading the field's label back.
    func paste(_ text: String, into field: XCUIElement) -> String {
        let (status, _) = Walk.call("/pbcopy", method: "POST", body: Data(text.utf8))
        guard status == 200 else { return "pbcopy answered \(status)" }
        field.tap()
        _ = keyboards.firstMatch.waitForExistence(timeout: 8)
        let tip = buttons["Continue"]
        if tip.exists { tip.tap() }
        let item = descendants(matching: .any).matching(NSPredicate(format: "label IN %@", ["Paste", "Coller"])).firstMatch
        var route = "one tap"
        if !item.waitForExistence(timeout: 1.5) {
            route = "a second tap"
            field.tap()
            if !item.waitForExistence(timeout: 2) {
                route = "a long press"
                field.press(forDuration: 1.2)
                _ = item.waitForExistence(timeout: 3)
            }
        }
        guard item.exists else { return "no Paste item after \(route)" }
        item.tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = NSPredicate(format: "label IN %@", ["Allow Paste", "Autoriser le collage"])
        for _ in 0..<6 {
            let inApp = descendants(matching: .any).matching(allow).firstMatch
            if inApp.exists {
                inApp.tap()
                return "Paste after \(route); the paste prompt allowed (in the app)"
            }
            let onBoard = springboard.descendants(matching: .any).matching(allow).firstMatch
            if onBoard.exists {
                onBoard.tap()
                return "Paste after \(route); the paste prompt allowed (SpringBoard)"
            }
            Thread.sleep(forTimeInterval: 0.5)
        }
        return "Paste after \(route); no paste prompt"
    }

    private func key(_ name: String, _ keyboard: XCUIElement) -> XCUIElement? {
        for candidate in [keyboard.keys[name], keyboard.buttons[name]] where candidate.exists && candidate.isHittable {
            return candidate
        }
        return nil
    }

    private func typeKey(_ character: String, _ keyboard: XCUIElement) -> Bool {
        let wanted = character == "," ? [",", "."] : [character]
        func attempt() -> Bool {
            for name in wanted {
                if let found = key(name, keyboard) { found.tap(); return true }
            }
            if character.uppercased() == character, character.lowercased() != character,
               let shift = key("shift", keyboard) {
                shift.tap()
                if let found = key(character, keyboard) ?? key(character.lowercased(), keyboard) {
                    found.tap()
                    return true
                }
            }
            return false
        }
        if attempt() { return true }
        // Another layer (letters <-> numbers <-> symbols): the layer key is identified "more" whatever its label.
        for _ in 0..<3 {
            let more = keyboard.keys.matching(identifier: "more").firstMatch
            guard more.exists else { break }
            more.tap()
            if attempt() { return true }
        }
        return false
    }
}
