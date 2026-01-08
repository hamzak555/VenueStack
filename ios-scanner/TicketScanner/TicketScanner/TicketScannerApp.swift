import SwiftUI
import SwiftData

@main
struct TicketScannerApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var networkMonitor = NetworkMonitor()

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            CachedEvent.self,
            CachedTicket.self,
            PendingScan.self
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authViewModel)
                .environmentObject(networkMonitor)
                .modelContainer(sharedModelContainer)
        }
    }
}
