// ios/MonReleve/Sources/HostProbe.swift
//
// IOS-HOST R1212. THE HOST PROBE: WHAT AN AD-HOC-SIGNED SIMULATOR BUNDLE CAN DO, ONE POSITIVE SIGNAL EACH (R133).
//
// Runs ONLY on a launch with `-probe YES` (LaunchArguments); a normal launch never reaches this file. It writes
// key=value lines to Documents/ios-host-probe.txt in the app's data container, which the workflow reads back with
// `simctl get_app_container`. Each line is written (and synced) the moment it is known, so a crash in one check
// leaves every earlier result readable, and a missing key reads as NO RESULT - never as a pass.
//
//   (1) keychain      a FAKE token pair through KeychainTokenStore, saved, read back equal, cleared - via the
//                     Kotlin keychainRoundTrip (KeychainRoundTripResult.kt), which returns a refusal's OSStatus instead of
//                     letting a Kotlin exception end the process.
//   (2) notification  a local notification scheduled 2 s ahead and found in the DELIVERED list. Authorization is
//                     PROVISIONAL: it is granted without a prompt, and nobody can tap an alert on the runner.
//   (3) share         a UIActivityViewController presented over the pilot; the workflow screenshots it after
//                     share.result is written.
//   (4) bgtask        BGTaskScheduler.submit's answer as returned (or thrown, with its domain and code).
//
// NOTHING SECRET: no server, no sign-in, no real token. The fake pair's values are never written out - only whether
// they came back equal. The repository is public, and so are the run's logs and artifacts.

import BackgroundTasks
import Foundation
import Security
import Shared
import UIKit
import UserNotifications

@MainActor
final class HostProbe {
    static let shared = HostProbe()
    static let resultFileName = "ios-host-probe.txt"
    static let backgroundTaskIdentifier = "ch.monreleve.app.probe.refresh"
    private static var backgroundTaskRegistered = false

    private var started = false
    private let notificationDelegate = ProbeNotificationDelegate()

    /// Called from didFinishLaunching, before launch ends, as BGTaskScheduler requires.
    static func registerBackgroundTask() {
        backgroundTaskRegistered = BGTaskScheduler.shared.register(
            forTaskWithIdentifier: backgroundTaskIdentifier,
            using: nil
        ) { task in
            task.setTaskCompleted(success: false)
        }
    }

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
        bundleFacts(log)
        keychain(log)
        await backgroundTask(log)
        await notification(log)
        await share(log)
        log.line("probe.done", "true")
    }

    // MARK: - what the bundle carries

    private func bundleFacts(_ log: ProbeLog) {
        let bundle = Bundle.main
        log.line("info.bundleIdentifier", bundle.bundleIdentifier ?? "nil")
        let short = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "nil"
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "nil"
        log.line("info.version", "\(short) (\(build))")
        log.line("info.apiBaseUrl", bundle.object(forInfoDictionaryKey: "MonReleveApiBaseUrl") as? String ?? "nil")
        log.line("info.composeResources", composeResources())
    }

    private func composeResources() -> String {
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("compose-resources"),
              let walker = FileManager.default.enumerator(atPath: root.path)
        else { return "absent" }
        var glyphs = 0
        while let name = walker.nextObject() as? String {
            let file = (name as NSString).lastPathComponent
            if file.hasPrefix("ic_") && file.hasSuffix(".xml") { glyphs += 1 }
        }
        return "icXml=\(glyphs)"
    }

    // MARK: - (1) the Keychain, through KeychainTokenStore

    private func keychain(_ log: ProbeLog) {
        log.line("keychain.accessGroup", keychainAccessGroup())
        let store = KeychainTokenStore(service: "ch.monreleve.app.probe", account: "fake-pair")
        let fake = TokenPair(
            accessToken: "fake-access-not-a-token",
            refreshToken: "fake-refresh-not-a-token",
            accessExpiresAt: "2000-01-01T00:00:00Z",
            refreshExpiresAt: "2000-01-02T00:00:00Z"
        )
        let result = KeychainRoundTripResultKt.keychainRoundTrip(store: store, fake: fake)
        log.line("keychain.saveStatus", "\(result.saveStatus)")
        log.line("keychain.loadedEqual", "\(result.loadedEqual)")
        log.line("keychain.clearedToNull", "\(result.clearedToNull)")
        log.line("keychain.result", result.passed ? "PASS" : "FAIL")
    }

    /// Which access group the system files a new item under - the entitlement as the Keychain actually sees it.
    private func keychainAccessGroup() -> String {
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "ch.monreleve.app.probe.group",
            kSecAttrAccount as String: "fake",
        ]
        SecItemDelete(identity as CFDictionary)
        var add = identity
        add[kSecValueData as String] = Data("fake".utf8)
        add[kSecReturnAttributes as String] = true
        var attributes: CFTypeRef?
        let status = SecItemAdd(add as CFDictionary, &attributes)
        SecItemDelete(identity as CFDictionary)
        guard status == errSecSuccess else { return "addStatus=\(status)" }
        let group = (attributes as? [String: Any])?[kSecAttrAccessGroup as String] as? String
        return group ?? "none"
    }

    // MARK: - (4) BGTaskScheduler.submit

    private func backgroundTask(_ log: ProbeLog) async {
        let listed = Bundle.main.object(forInfoDictionaryKey: "BGTaskSchedulerPermittedIdentifiers") as? [String] ?? []
        log.line("bgtask.permittedInPlist", "\(listed.contains(HostProbe.backgroundTaskIdentifier))")
        log.line("bgtask.registered", "\(HostProbe.backgroundTaskRegistered)")
        let request = BGAppRefreshTaskRequest(identifier: HostProbe.backgroundTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
            log.line("bgtask.submit", "returned")
        } catch {
            let refusal = error as NSError
            log.line(
                "bgtask.submit",
                "threw domain=\(refusal.domain) code=\(refusal.code) description=\(refusal.localizedDescription)"
            )
        }
        let pending = await BGTaskScheduler.shared.pendingTaskRequests()
        log.line("bgtask.pendingAfterSubmit", "\(pending.count)")
        BGTaskScheduler.shared.cancelAllTaskRequests()
    }

    // MARK: - (2) a local notification, delivered

    private func notification(_ log: ProbeLog) async {
        let center = UNUserNotificationCenter.current()
        center.delegate = notificationDelegate
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .provisional])
            log.line("notification.granted", "\(granted)")
        } catch {
            log.line("notification.authorizationError", "\((error as NSError).domain) \((error as NSError).code)")
        }
        let settings = await center.notificationSettings()
        log.line("notification.authorizationStatus", statusName(settings.authorizationStatus))

        let identifier = "ios-host-probe-" + UUID().uuidString
        let content = UNMutableNotificationContent()
        content.title = "IOS-HOST probe"
        content.body = "A local notification from the simulator probe."
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
        do {
            try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
            log.line("notification.added", "true")
        } catch {
            log.line("notification.added", "threw \((error as NSError).domain) \((error as NSError).code)")
        }
        let pending = await center.pendingNotificationRequests()
        log.line("notification.pendingAfterAdd", "\(pending.contains { $0.identifier == identifier })")

        var delivered = false
        for _ in 0..<30 where !delivered {
            try? await Task.sleep(nanoseconds: 500_000_000)
            let list = await center.deliveredNotifications()
            delivered = list.contains { $0.request.identifier == identifier }
        }
        log.line("notification.willPresentCalled", "\(notificationDelegate.presented(identifier))")
        log.line("notification.delivered", "\(delivered)")
        log.line("notification.result", delivered ? "PASS" : "FAIL")
    }

    private func statusName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown(\(status.rawValue))"
        }
    }

    // MARK: - (3) the share sheet, on screen

    private func share(_ log: ProbeLog) async {
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("ios-host-probe-share.txt")
        do {
            try "IOS-HOST probe: a fake file to share, not a releve.\n".write(to: file, atomically: true, encoding: .utf8)
        } catch {
            log.line("share.fileError", "\((error as NSError).domain) \((error as NSError).code)")
        }
        guard let root = rootViewController() else {
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

/// Records which notifications reached willPresent, and asks for them to be listed (a foreground app's notification
/// is otherwise silenced).
final class ProbeNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    private let lock = NSLock()
    private var identifiers: [String] = []

    func presented(_ identifier: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return identifiers.contains(identifier)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        lock.lock()
        identifiers.append(notification.request.identifier)
        lock.unlock()
        completionHandler([.banner, .list])
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
