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
// IOS-AUDIT R1350: NOTHING PROBE-ONLY SHIPS. Every launch shows the real app. The pilot view controller and its
// -pilotScenario path are gone (the walk photographs the real app's glyphs). What remains for the runner's checks - the
// host probe (HostProbe.swift) and the walk's centre reader (WalkProbe.swift) - is compiled ONLY in the Debug
// configuration (`#if DEBUG`; ios/project.yml defines DEBUG for Debug alone), and so are the launch arguments that start
// them: a Release build cannot handle one, and R1353 checks the built Release binary for their names.
//
// LAUNCH ARGUMENTS (Debug builds only; read from the argument domain, never persisted):
//   -probe YES              run the host probe over the real app (HostProbe.swift, R1212).
//   -probeNonce <TEXT>      written first into the probe's result file, so a reader can tell THIS launch's file.
//   -walkProbe YES          IOS-WALK only: WalkProbe.swift's read-only file of the centre's state.
//   -walkNearTap YES        IOS-WALK only, with -walkProbe: one near copy of the first pending reminder (R1345's tap).

import Shared
import SwiftUI

@main
struct MonReleveApp: App {
    @UIApplicationDelegateAdaptor(HostAppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            AppScreen()
                .ignoresSafeArea()
                .onAppear {
                    #if DEBUG
                    if LaunchArguments.probe {
                        HostProbe.shared.start()
                    }
                    #endif
                }
        }
    }
}

final class HostAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // IOS-SHELL-2 R1330: a tap on the evening reminder opens Aujourd'hui. The delegate must be set before launch
        // ends for a tap that LAUNCHES the app to reach it.
        IosNotificationTapsKt.installNotificationTapDelegate()
        #if DEBUG
        // IOS-WALK R1345: the walk's read-only window onto the real centre - ONLY with `-walkProbe YES`
        // (WalkProbe.swift). A person's launch never starts it, and a Release build does not contain it.
        if WalkProbe.enabled {
            WalkProbe.shared.start()
        }
        #endif
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

#if DEBUG
/// The runner's launch arguments - Debug builds only (R1350).
enum LaunchArguments {
    static var probe: Bool { UserDefaults.standard.bool(forKey: "probe") }

    static var probeNonce: String { UserDefaults.standard.string(forKey: "probeNonce") ?? "none" }
}
#endif
