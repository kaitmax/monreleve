// ios/MonReleve/Sources/WalkProbe.swift
//
// IOS-WALK (I2) R1345. THE WALK'S READ-ONLY WINDOW ONTO THE REAL NOTIFICATION CENTRE. A UI test cannot read another
// app's notification centre, so the app itself reads it - the SYSTEM centre, never a recording one - and writes what it
// holds to Documents/walk-probe.txt, which the workflow's helper reads back with simctl (as HostProbe's file is read).
//
// INERT ON A PERSON'S LAUNCH: it runs ONLY on a launch with `-walkProbe YES` (the XCUITest walk passes it), exactly as
// `-probe YES` gates HostProbe. It is NOT a pilot launch: the real app (AppRoot) runs underneath, unchanged. It never
// schedules, removes or answers anything the app does, with ONE exception asked for by name: `-walkNearTap YES` adds ONE
// copy of the app's first pending evening reminder, same content, firing in 8 s - the "trigger moved near" of R1345's
// tap measurement - so a delivered reminder can be tapped on the simulator.
//
// WHAT IT WRITES, every second (the whole file, atomically):
//   firstAnswer.*      THE FIRST ANSWER (iOS Ruling 16 Q1): this probe asks the centre "may this app notify" at
//                      didFinishLaunching - the moment startIosShell asks it - and records when the answer came,
//                      measured from the PROCESS's start (sysctl) and from didFinishLaunching.
//   foregrounds        willEnterForeground count, with the last one's time (the walk's background/foreground proof).
//   authorization      the centre's current status.
//   pending.*          every pending request: identifier, hour, minute, the trigger's time zone, repeats, next fire.
//   delivered.count    the delivered list's size.
//
// IOS-AUDIT R1350: KEPT, DEBUG ONLY. The walk (.github/workflows/ios-walk.yml) still needs it - IOS-AUDIT R1390/R1391
// dispatch it again - so the whole file is compiled only when DEBUG is defined (ios/project.yml: the Debug configuration
// alone). A Release build carries none of it; R1353 checks the built Release binary for its names.

#if DEBUG

import Foundation
import Shared
import UIKit
import UserNotifications

final class WalkProbe {
    static let shared = WalkProbe()

    static var enabled: Bool { UserDefaults.standard.bool(forKey: "walkProbe") }
    private static var nearTap: Bool { UserDefaults.standard.bool(forKey: "walkNearTap") }

    private let center = UNUserNotificationCenter.current()
    private let lock = NSLock()
    private var facts: [String: String] = [:]
    private var foregrounds = 0
    private var seq = 0
    private var didFinish = Date()
    private var timer: Timer?

    /// Called from didFinishLaunching, only when [enabled].
    func start() {
        didFinish = Date()
        let processStart = WalkProbe.processStart()
        set("launch.processStart", WalkProbe.iso(processStart))
        set("launch.didFinishAfterProcessStartMs", "\(Int(didFinish.timeIntervalSince(processStart) * 1000))")
        set("timeZone", TimeZone.current.identifier)
        // Compose 1.7.3 syncs its semantics tree to UIAccessibility only while this is true (its default
        // AccessibilitySyncOptions.WhenRequiredByAccessibilityServices) - what the XCUITest driver can see depends on it.
        set("voiceOverRunning", "\(UIAccessibility.isVoiceOverRunning)")
        center.getNotificationSettings { settings in
            let answered = Date()
            self.set("firstAnswer.status", WalkProbe.statusName(settings.authorizationStatus))
            self.set("firstAnswer.msFromProcessStart", "\(Int(answered.timeIntervalSince(processStart) * 1000))")
            self.set("firstAnswer.msFromDidFinish", "\(Int(answered.timeIntervalSince(self.didFinish) * 1000))")
        }
        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main
        ) { _ in
            self.lock.lock()
            self.foregrounds += 1
            let count = self.foregrounds
            self.lock.unlock()
            self.set("foregrounds", "\(count)")
            self.set("foregrounds.last", WalkProbe.iso(Date()))
        }
        set("foregrounds", "0")
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in self.write() }
        if WalkProbe.nearTap {
            Task { await self.addNearCopy() }
        }
    }

    private func set(_ key: String, _ value: String) {
        lock.lock()
        facts[key] = value
        lock.unlock()
    }

    private func write() {
        Task {
            let settings = await center.notificationSettings()
            let pending = await center.pendingNotificationRequests().sorted { $0.identifier < $1.identifier }
            let delivered = await center.deliveredNotifications()
            lock.lock()
            seq += 1
            var lines = ["seq=\(seq)", "now=\(WalkProbe.iso(Date()))"]
            lines += facts.keys.sorted().map { "\($0)=\(facts[$0] ?? "")" }
            lock.unlock()
            lines.append("authorization=\(WalkProbe.statusName(settings.authorizationStatus))")
            lines.append("pending.count=\(pending.count)")
            for request in pending {
                lines.append("pending=\(WalkProbe.describe(request))")
            }
            lines.append("delivered.count=\(delivered.count)")
            for note in delivered {
                lines.append("delivered=\(note.request.identifier)")
            }
            lines.append("probe.done=true")
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let url = documents.appendingPathComponent("walk-probe.txt")
            try? (lines.joined(separator: "\n") + "\n").write(to: url, atomically: true, encoding: .utf8)
        }
    }

    /// R1345 THE TAP: one copy of the first pending evening reminder, same content, 8 s from now.
    private func addNearCopy() async {
        for _ in 0..<30 {
            let pending = await center.pendingNotificationRequests()
                .filter { $0.identifier.hasPrefix(IosEveningRemindersKt.EVENING_REMINDER_ID_PREFIX) }
                .sorted { $0.identifier < $1.identifier }
            if let first = pending.first {
                let identifier = IosEveningRemindersKt.EVENING_REMINDER_ID_PREFIX + "walk-near"
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 8, repeats: false)
                do {
                    try await center.add(UNNotificationRequest(identifier: identifier, content: first.content,
                                                               trigger: trigger))
                    set("nearTap.added", "\(identifier) copyOf=\(first.identifier) at=\(WalkProbe.iso(Date()))")
                } catch {
                    set("nearTap.added", "threw \((error as NSError).domain) \((error as NSError).code)")
                }
                return
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        set("nearTap.added", "none: no pending evening reminder within 15 s")
    }

    private static func describe(_ request: UNNotificationRequest) -> String {
        guard let trigger = request.trigger as? UNCalendarNotificationTrigger else {
            return "\(request.identifier)|trigger=\(String(describing: request.trigger.map { type(of: $0) }))"
        }
        let parts = trigger.dateComponents
        let next = trigger.nextTriggerDate().map { iso($0) } ?? "nil"
        return "\(request.identifier)|y=\(parts.year ?? -1)|m=\(parts.month ?? -1)|d=\(parts.day ?? -1)"
            + "|hour=\(parts.hour ?? -1)|minute=\(parts.minute ?? -1)|tz=\(parts.timeZone?.identifier ?? "nil")"
            + "|repeats=\(trigger.repeats)|next=\(next)"
    }

    private static func statusName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown(\(status.rawValue))"
        }
    }

    private static func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    /// When the kernel started this process - the "launch" the first-answer time is measured from.
    private static func processStart() -> Date {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        guard sysctl(&mib, u_int(mib.count), &info, &size, nil, 0) == 0 else { return Date() }
        let start = info.kp_proc.p_un.__p_starttime
        return Date(timeIntervalSince1970: TimeInterval(start.tv_sec) + TimeInterval(start.tv_usec) / 1_000_000)
    }
}

#endif
