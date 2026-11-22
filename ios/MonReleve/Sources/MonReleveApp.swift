// ios/MonReleve/Sources/MonReleveApp.swift
//
// IOS-HOST R1211, IOS-SHELL-1 R1320. THE iOS APP: one SwiftUI window whose content is ONE ComposeUIViewController - the
// COMMON AppRoot around the common router (ShellRoutes.kt, R1328), over the process's shell (the Kotlin composition
// root startIosShell, built once - ios/MonReleveViewController.kt). Sign-in by the six-digit code (iOS Ruling 3 Q2),
// RESOLVING, the manual-only onboarding and the four tabs are the shared code; the API base URL and the version line are
// read from Info.plist by the Kotlin side (ios/project.yml is their one home, R206).
//
// .ignoresSafeArea(): AppRoot owns the insets, as on Android (R1170).
//
// THE PILOT STAYS, FOR THE PROBE AND THE GLYPH SCREENSHOT ONLY (named in REPORT-IOS-SHELL-1; IOS-AUDIT I3 removes it):
// a launch that carries -pilotScenario or -probe shows the pilot view controller (pilot/AujourdhuiPilotViewController.kt
// - the shared Aujourd'hui screen over an in-memory fixture, no server, no account), exactly as before this task, so the
// probe launch is unchanged. A launch with NEITHER - the one a person makes - is the real app.
//
// LAUNCH ARGUMENTS (read from the argument domain, never persisted):
//   -pilotScenario <NAME>   show the PILOT in this state (PilotScenario's names) - a probe/test path, not the product.
//   -probe YES              show the pilot and run the host probe (HostProbe.swift, R1212). A normal launch never does.
//   -probeNonce <TEXT>      written first into the probe's result file, so a reader can tell THIS launch's file.

import Shared
import SwiftUI

@main
struct MonReleveApp: App {
    @UIApplicationDelegateAdaptor(HostAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            Group {
                if LaunchArguments.pilotLaunch {
                    PilotScreen(scenario: LaunchArguments.pilotScenario)
                } else {
                    AppScreen()
                }
            }
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
        // IOS-SHELL-2 R1330: a tap on the evening reminder opens Aujourd'hui. The delegate must be set before launch
        // ends for a tap that LAUNCHES the app to reach it. Not for the pilot or the probe (the probe sets its own).
        if !LaunchArguments.pilotLaunch {
            IosNotificationTapsKt.installNotificationTapDelegate()
        }
        return true
    }
}

/// The app itself: the Kotlin framework's one view controller over the process's shell (R1320).
struct AppScreen: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MonReleveViewControllerKt.monReleveViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

/// The pilot view controller from the Kotlin framework, as a SwiftUI view - the probe's and the glyph screenshot's only.
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

    /// The pilot is shown only for a probe launch or one that names a pilot state - never for a person's launch.
    static var pilotLaunch: Bool { probe || UserDefaults.standard.string(forKey: "pilotScenario") != nil }

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
