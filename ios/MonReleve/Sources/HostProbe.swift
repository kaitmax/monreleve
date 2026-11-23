// ios/MonReleve/Sources/HostProbe.swift
//
// IOS-HOST R1212. THE HOST PROBE: WHAT AN AD-HOC-SIGNED SIMULATOR BUNDLE CAN DO, ONE POSITIVE SIGNAL EACH (R133).
//
// DEBUG ONLY (IOS-AUDIT R1350, iOS Rulings 3 Q3 and 10 Q6): the whole file is compiled only when DEBUG is defined
// (ios/project.yml sets it for the Debug configuration alone), so the Release build carries none of it - R1353 proves
// that on the built Release binary, with this file's symbols as the positive control on Debug.
//
// Runs ONLY on a launch with `-probe YES` (LaunchArguments); a normal launch never reaches this file. It writes
// key=value lines to Documents/ios-host-probe.txt in the app's data container, which the workflow reads back with
// `simctl get_app_container`. Each line is written (and synced) the moment it is known, so a crash in one check
// leaves every earlier result readable, and a missing key reads as NO RESULT - never as a pass.
//
// WHAT IS LEFT, AND WHY (R1350's census, in REPORT-IOS-AUDIT.txt with the walk line for each removal):
//   (3) share         a UIActivityViewController presented over the app's own root view controller; the workflow
//                     screenshots it after share.result is written. KEPT: the walk never reached the export's share
//                     sheet (iOS Ruling 18), so this is still the one run that presents one.
//   (8) mail          IOS-SHELL-2 R1333: a MEASUREMENT, not a check - whether this phone can open the Mail app's
//                     scheme (message://), asked through the shell's own function (canOpenMailApp), which decides
//                     whether the code screen shows its mail button. It opens nothing. KEPT: the walk does not read it.
// REMOVED, each because the walk now measures the same observable on the REAL app (iOS Ruling 18, run 45125804130):
//   (1) keychain - the session's own Keychain store saves at sign-in, is read back on every authenticated request
//       (SessionManager reads the store each attempt) and is cleared at sign-out ("31 relaunch after sign-out reaches
//       sign-in=true"); its Kotlin helper moved to iosTest, where it still runs against the real Keychain.
//   (2) notification - the real evening reminder delivered on the simulator (runs 16 and 17) after the real alert.
//   (4) bgtask - nothing in the shipped app registers a task (PARK-IF1 stays device-only); its plist keys went too.
//   (5) reminder - M4 and M3 on the real centre (run 18: 4 pending at 19:00 after the opt-in, still 4 after a real
//       background/foreground, 0 after sign-out).
//   (6) firstLaunch - its Kotlin helper moved to iosTest and runs there over the real Keychain and UserDefaults.
//   (7) ats - the Debug app's plain-http requests to the walk's runner-local relay answered (run 18: "POST
//       /api/v1/entries 200"); and R1353 asserts the Release Info.plist carries no ATS key at all.
//   info.* - R1353 reads both configurations' Info.plist directly.
// The pilot view controller the probe used to run over is gone (R1350): the probe now runs over the real app.
//
// NOTHING SECRET: no server, no sign-in, no token. The repository is public, and so are the run's logs and artifacts.

#if DEBUG

import Foundation
import Shared
import UIKit

@MainActor
final class HostProbe {
    static let shared = HostProbe()
    static let resultFileName = "ios-host-probe.txt"

    private var started = false

    func start() {
        guard !started else { return }
        started = true
        Task { @MainActor in
            await self.run()
        }
    }

    private func run() async {
        let log = ProbeLog(fileName: HostProbe.resultFileName)
        log.line("probe.nonce", LaunchArguments.probeNonce)
        await share(log)
        mailApp(log)
        log.line("probe.done", "true")
    }

    // MARK: - (8) the Mail app's scheme (IOS-SHELL-2 R1333)

    /// R1333: MEASURE what this phone answers for message:// - through the shell's own function, so the answer is the
    /// one the code screen acts on - and whether Info.plist lists the scheme (canOpenURL answers only for a listed one).
    private func mailApp(_ log: ProbeLog) {
        let listed = Bundle.main.object(forInfoDictionaryKey: "LSApplicationQueriesSchemes") as? [String] ?? []
        log.line("mail.schemeListed", "\(listed.contains("message"))")
        log.line("mail.canOpenMessageScheme", "\(IosUrlOpenerKt.canOpenMailApp())")
    }

    // MARK: - (3) the share sheet, on screen

    private func share(_ log: ProbeLog) async {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("ios-host-probe-share.txt")
        do {
            try "IOS-HOST probe: a fake file to share.\n".write(to: file, atomically: true, encoding: .utf8)
        } catch {
            log.line("share.fileError", "\((error as NSError).domain) \((error as NSError).code)")
        }
        // The app's root view controller may still be appearing when the probe starts: wait for it, bounded.
        var root = rootViewController()
        for _ in 0..<20 where root == nil {
            try? await Task.sleep(nanoseconds: 250_000_000)
            root = rootViewController()
        }
        guard let root = root else {
            log.line("share.result", "FAIL no root view controller")
            return
        }
        var top = root
        while let next = top.presentedViewController { top = next }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            top.present(sheet, animated: true) { done.resume() }
        }
        let presented = top.presentedViewController
        log.line("share.presentedClass", presented.map { String(describing: type(of: $0)) } ?? "nil")
        log.line("share.inWindow", "\(sheet.view.window != nil)")
        log.line("share.result", presented === sheet && sheet.view.window != nil ? "PASS" : "FAIL")
    }

    private func rootViewController() -> UIViewController? {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
        return (windows.first { $0.isKeyWindow } ?? windows.first)?.rootViewController
    }
}

/// key=value lines in Documents/<fileName>, each appended and synced as it is written, and echoed to the system log.
final class ProbeLog {
    private let url: URL

    init(fileName: String) {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        url = documents.appendingPathComponent(fileName)
        try? FileManager.default.removeItem(at: url)
        FileManager.default.createFile(atPath: url.path, contents: nil)
    }

    func line(_ key: String, _ value: String) {
        let text = "\(key)=\(value)\n"
        NSLog("IOS-HOST-PROBE %@", text)
        guard let handle = try? FileHandle(forWritingTo: url) else { return }
        handle.seekToEndOfFile()
        handle.write(Data(text.utf8))
        try? handle.synchronize()
        try? handle.close()
    }
}

#endif
