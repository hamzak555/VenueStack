import Foundation
import SwiftData
import Combine

@MainActor
class SyncManager: ObservableObject {
    static let shared = SyncManager()

    @Published var isSyncing: Bool = false
    @Published var lastSyncTime: Date?
    @Published var pendingScanCount: Int = 0

    private var modelContext: ModelContext?
    private var cancellables = Set<AnyCancellable>()

    private init() {}

    func configure(modelContext: ModelContext) {
        self.modelContext = modelContext
        updatePendingScanCount()
    }

    // MARK: - Ticket Caching

    func cacheTickets(_ tickets: [Ticket], for eventId: String) async {
        guard let context = modelContext else { return }

        for ticket in tickets {
            let descriptor = FetchDescriptor<CachedTicket>(
                predicate: #Predicate { $0.id == ticket.id }
            )

            do {
                let existing = try context.fetch(descriptor)
                if let cachedTicket = existing.first {
                    cachedTicket.update(from: ticket)
                } else {
                    let newCachedTicket = CachedTicket(from: ticket)
                    context.insert(newCachedTicket)
                }
            } catch {
                print("Error caching ticket: \(error)")
            }
        }

        try? context.save()
    }

    func cacheEvents(_ events: [Event]) async {
        guard let context = modelContext else { return }

        for event in events {
            let descriptor = FetchDescriptor<CachedEvent>(
                predicate: #Predicate { $0.id == event.id }
            )

            do {
                let existing = try context.fetch(descriptor)
                if let cachedEvent = existing.first {
                    cachedEvent.update(from: event)
                } else {
                    let newCachedEvent = CachedEvent(from: event)
                    context.insert(newCachedEvent)
                }
            } catch {
                print("Error caching event: \(error)")
            }
        }

        try? context.save()
    }

    // MARK: - Offline Ticket Lookup

    func findCachedTicket(byQRCode qrCode: String) -> CachedTicket? {
        guard let context = modelContext else { return nil }

        let descriptor = FetchDescriptor<CachedTicket>(
            predicate: #Predicate { $0.qrCodeData == qrCode }
        )

        do {
            let results = try context.fetch(descriptor)
            return results.first
        } catch {
            print("Error finding cached ticket: \(error)")
            return nil
        }
    }

    func getCachedEvents(for businessId: String) -> [Event] {
        guard let context = modelContext else { return [] }

        let descriptor = FetchDescriptor<CachedEvent>(
            predicate: #Predicate { $0.businessId == businessId }
        )

        do {
            let results = try context.fetch(descriptor)
            return results.map { $0.toEvent() }
        } catch {
            print("Error fetching cached events: \(error)")
            return []
        }
    }

    func getCachedTickets(for eventId: String) -> [Ticket] {
        guard let context = modelContext else { return [] }

        let descriptor = FetchDescriptor<CachedTicket>(
            predicate: #Predicate { $0.eventId == eventId }
        )

        do {
            let results = try context.fetch(descriptor)
            return results.map { $0.toTicket() }
        } catch {
            print("Error fetching cached tickets: \(error)")
            return []
        }
    }

    // MARK: - Pending Scans

    func addPendingScan(qrCodeData: String) {
        guard let context = modelContext else { return }

        // Check if already pending
        let descriptor = FetchDescriptor<PendingScan>(
            predicate: #Predicate { $0.qrCodeData == qrCodeData && $0.synced == false }
        )

        do {
            let existing = try context.fetch(descriptor)
            if existing.isEmpty {
                let pendingScan = PendingScan(qrCodeData: qrCodeData)
                context.insert(pendingScan)
                try context.save()
                updatePendingScanCount()
            }
        } catch {
            print("Error adding pending scan: \(error)")
        }
    }

    func getPendingScans() -> [PendingScan] {
        guard let context = modelContext else { return [] }

        let descriptor = FetchDescriptor<PendingScan>(
            predicate: #Predicate { $0.synced == false }
        )

        do {
            return try context.fetch(descriptor)
        } catch {
            print("Error fetching pending scans: \(error)")
            return []
        }
    }

    func updatePendingScanCount() {
        pendingScanCount = getPendingScans().count
    }

    // MARK: - Sync Operations

    func syncPendingScans() async {
        guard !isSyncing else { return }
        guard NetworkMonitor.shared.isConnected else { return }

        guard let session = KeychainService.shared.getSession(),
              !session.isExpired else {
            return
        }

        let pendingScans = getPendingScans()
        guard !pendingScans.isEmpty else { return }

        isSyncing = true
        defer {
            isSyncing = false
            updatePendingScanCount()
        }

        let scanData = pendingScans.map { $0.toPendingScanData() }

        do {
            let response = try await APIClient.shared.batchSync(
                scans: scanData,
                businessId: session.businessId,
                token: session.token
            )

            // Update pending scans based on response
            for result in response.results {
                if let pendingScan = pendingScans.first(where: { $0.qrCodeData == result.qrCodeData }) {
                    if result.success {
                        pendingScan.markSynced()
                    } else {
                        pendingScan.markFailed(error: result.message ?? "Unknown error")
                    }
                }
            }

            try? modelContext?.save()
            lastSyncTime = Date()

            print("Sync complete: \(response.syncedCount) synced, \(response.failedCount) failed")
        } catch {
            print("Sync failed: \(error)")
        }
    }

    func syncTickets(for eventId: String) async {
        guard NetworkMonitor.shared.isConnected else { return }

        guard let session = KeychainService.shared.getSession(),
              !session.isExpired else {
            return
        }

        do {
            let response = try await APIClient.shared.getTickets(
                eventId: eventId,
                businessId: session.businessId,
                token: session.token
            )

            await cacheTickets(response.tickets, for: eventId)
            lastSyncTime = Date()
        } catch {
            print("Failed to sync tickets: \(error)")
        }
    }

    // MARK: - Clear Cache

    func clearAllCache() {
        guard let context = modelContext else { return }

        do {
            try context.delete(model: CachedEvent.self)
            try context.delete(model: CachedTicket.self)
            try context.delete(model: PendingScan.self)
            try context.save()
            pendingScanCount = 0
        } catch {
            print("Error clearing cache: \(error)")
        }
    }

    func clearOldCache(olderThan days: Int = 7) {
        guard let context = modelContext else { return }

        let cutoffDate = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()

        // Clear old synced pending scans
        let descriptor = FetchDescriptor<PendingScan>(
            predicate: #Predicate { $0.synced == true && $0.scannedAt < cutoffDate }
        )

        do {
            let oldScans = try context.fetch(descriptor)
            for scan in oldScans {
                context.delete(scan)
            }
            try context.save()
        } catch {
            print("Error clearing old cache: \(error)")
        }
    }
}
