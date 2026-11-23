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

    /// IOS-WALK-2: empties [field] with the keyboard's own delete key (identifier "delete"), the cursor first put at the
    /// field's END by a tap at its trailing edge. Used only when a read-back shows the field holds the WRONG text: run
    /// 45088845825 retyped on top of a half-typed address and made it worse; this clears before it retypes.
    func clear(_ field: XCUIElement, count: Int) {
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.96, dy: 0.5)).tap()
        let keyboard = keyboards.firstMatch
        guard keyboard.waitForExistence(timeout: 8) else { return }
        let delete = keyboard.keys.matching(identifier: "delete").firstMatch
        guard delete.exists else { return }
        for _ in 0..<count { delete.tap() }
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
