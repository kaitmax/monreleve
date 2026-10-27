package ch.monreleve.app.pilot

import androidx.compose.ui.window.ComposeUIViewController
import ch.monreleve.app.ios.newIosMutationId
import platform.UIKit.UIViewController

// IOS-1b-A R609. THE ENTRY POINT PART B'S iOS APP CALLS: one UIViewController hosting the shared Aujourd'hui screen
// over the in-memory pilot fixture. From Swift (the framework exports it as AujourdhuiPilotViewControllerKt):
//
//     let controller = AujourdhuiPilotViewControllerKt.aujourdhuiPilotViewController(scenario: .unanswered)
//
// and set it as the window's root view controller (SwiftUI: wrap it in a UIViewControllerRepresentable).
//
// Compose Multiplatform's strict Info.plist check stays ON here: the app must declare
// CADisableMinimumFrameDurationOnPhone = YES (Compose renders at the display's full rate on ProMotion phones and
// refuses to start without it) - REPORT-IOS-1b-A R609. Only the probe/test binaries, which have no Info.plist,
// switch the check off.

/** The pilot's root view controller: the shared screen, in [scenario], ids from iOS's own UUID source. */
fun aujourdhuiPilotViewController(scenario: PilotScenario = PilotScenario.UNANSWERED): UIViewController =
    ComposeUIViewController { AujourdhuiPilot(scenario, newMutationId = ::newIosMutationId) }
