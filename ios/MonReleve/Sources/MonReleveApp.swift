// ios/MonReleve/Sources/MonReleveApp.swift
//
// IOS-HOST R1211. THE iOS APP HOST: one SwiftUI window whose content is the PILOT view controller already in
// :shared's iosMain (pilot/AujourdhuiPilotViewController.kt) - the shared Aujourd'hui screen over an in-memory
// fixture: no server, no account, no sign-in. The shell (routes, session, stores) moves in iOS Ruling 3's later tasks.
//
// .ignoresSafeArea(): the shared screen owns its insets, as AppRoot does on Android (R1170).
//
// LAUNCH ARGUMENTS (read from the argument domain, never persisted):
//   -pilotScenario <NAME>   which state TODAY is in (PilotScenario's names); default UNANSWERED, the pilot's own.
//   -probe YES              also run the host probe (HostProbe.swift, R1212). A normal launch never does.
//   -probeNonce <TEXT>      written first into the probe's result file, so a reader can tell THIS launch's file.

import Shared
import SwiftUI

@main
struct MonReleveApp: App {
    @UIApplicationDelegateAdaptor(HostAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            PilotScreen(scenario: LaunchArguments.pilotScenario)
                .ignoresSafeArea()
                .onAppear {
                    if LaunchArguments.probe {
                        HostProbe.shared.start()
                    }
                }
        }
    }
}

final class HostAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // BGTaskScheduler requires every launch handler to be registered before launch finishes.
        if LaunchArguments.probe {
            HostProbe.registerBackgroundTask()
        }
        return true
    }
}

/// The pilot view controller from the Kotlin framework, as a SwiftUI view.
struct PilotScreen: UIViewControllerRepresentable {
    let scenario: PilotScenario

    func makeUIViewController(context: Context) -> UIViewController {
        AujourdhuiPilotViewControllerKt.aujourdhuiPilotViewController(scenario: scenario)
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

enum LaunchArguments {
    static var probe: Bool { UserDefaults.standard.bool(forKey: "probe") }

    static var probeNonce: String { UserDefaults.standard.string(forKey: "probeNonce") ?? "none" }

    static var pilotScenario: PilotScenario {
        switch UserDefaults.standard.string(forKey: "pilotScenario") {
        case "UNANSWERED_HALF_DAY": return .unansweredHalfDay
        case "ANSWERED_WHOLE": return .answeredWhole
        case "ANSWERED_HALVES": return .answeredHalves
        case "PENDING": return .pending
        case "REFUSED": return .refused
        default: return .unanswered
        }
    }
}
