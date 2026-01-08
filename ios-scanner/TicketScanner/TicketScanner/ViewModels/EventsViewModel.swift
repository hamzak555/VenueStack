import Foundation
import SwiftUI
import Combine

@MainActor
class EventsViewModel: ObservableObject {
    @Published var events: [Event] = []
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var selectedFilter: EventFilter = .upcoming

    private let api = APIClient.shared
    private let syncManager = SyncManager.shared

    enum EventFilter: String, CaseIterable {
        case upcoming = "Upcoming"
        case past = "Past"
        case all = "All"
    }

    var filteredEvents: [Event] {
        switch selectedFilter {
        case .upcoming:
            return events.filter { $0.isUpcoming && $0.safeStatus == .published }
        case .past:
            return events.filter { !$0.isUpcoming }
        case .all:
            return events
        }
    }

    var upcomingEvents: [Event] {
        events.filter { $0.isUpcoming && $0.safeStatus == .published }
    }

    func loadEvents(businessId: String, token: String) async {
        isLoading = true
        error = nil

        // First, try to load from cache for instant display
        let cachedEvents = syncManager.getCachedEvents(for: businessId)
        if !cachedEvents.isEmpty {
            events = cachedEvents.sorted { $0.eventDate > $1.eventDate }
        }

        // Then fetch fresh data from API
        if NetworkMonitor.shared.isConnected {
            do {
                let freshEvents = try await api.getEvents(businessId: businessId, token: token)
                events = freshEvents.sorted { $0.eventDate > $1.eventDate }

                // Cache the events
                await syncManager.cacheEvents(freshEvents)
            } catch let apiError as APIError {
                // Only show error if we don't have cached data
                if cachedEvents.isEmpty {
                    error = apiError.localizedDescription
                }
            } catch {
                if cachedEvents.isEmpty {
                    self.error = "Failed to load events"
                }
            }
        } else if cachedEvents.isEmpty {
            error = "No internet connection and no cached data available"
        }

        isLoading = false
    }

    func refresh(businessId: String, token: String) async {
        await loadEvents(businessId: businessId, token: token)
    }
}
