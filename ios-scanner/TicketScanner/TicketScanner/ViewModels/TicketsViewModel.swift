import Foundation
import SwiftUI
import Combine

@MainActor
class TicketsViewModel: ObservableObject {
    @Published var tickets: [Ticket] = []
    @Published var isLoading: Bool = false
    @Published var error: String?
    @Published var searchText: String = ""
    @Published var selectedFilter: TicketFilter = .all
    @Published var selectedSort: TicketSortOption = .nameAsc

    private let api = APIClient.shared
    private let syncManager = SyncManager.shared

    var eventId: String?

    enum TicketFilter: String, CaseIterable {
        case all = "All"
        case valid = "Valid"
        case checkedIn = "Used"
        case cancelled = "Invalid"
    }

    enum TicketSortOption: String, CaseIterable {
        case nameAsc = "Name (A-Z)"
        case nameDesc = "Name (Z-A)"
        case ticketNumAsc = "Ticket # (Asc)"
        case ticketNumDesc = "Ticket # (Desc)"
        case purchaseDateAsc = "Purchase (Oldest)"
        case purchaseDateDesc = "Purchase (Newest)"
    }

    var filteredTickets: [Ticket] {
        var result = tickets

        // Apply status filter
        switch selectedFilter {
        case .all:
            break
        case .valid:
            result = result.filter { $0.status == .valid && !$0.isCheckedIn }
        case .checkedIn:
            result = result.filter { $0.isCheckedIn }
        case .cancelled:
            result = result.filter { $0.status == .cancelled || $0.status == .invalid }
        }

        // Apply search filter
        if !searchText.isEmpty {
            let search = searchText.lowercased()
            result = result.filter {
                $0.ticketNumber.lowercased().contains(search) ||
                ($0.customerName?.lowercased().contains(search) ?? false) ||
                ($0.customerEmail?.lowercased().contains(search) ?? false)
            }
        }

        // Apply sorting
        switch selectedSort {
        case .nameAsc:
            result.sort { ($0.customerName ?? "") < ($1.customerName ?? "") }
        case .nameDesc:
            result.sort { ($0.customerName ?? "") > ($1.customerName ?? "") }
        case .ticketNumAsc:
            result.sort { $0.ticketNumber < $1.ticketNumber }
        case .ticketNumDesc:
            result.sort { $0.ticketNumber > $1.ticketNumber }
        case .purchaseDateAsc:
            result.sort { ($0.createdAt ?? "") < ($1.createdAt ?? "") }
        case .purchaseDateDesc:
            result.sort { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
        }

        return result
    }

    var statistics: TicketStatistics {
        let total = tickets.count
        let checkedIn = tickets.filter { $0.isCheckedIn }.count
        let valid = tickets.filter { $0.status == .valid && !$0.isCheckedIn }.count
        let cancelled = tickets.filter { $0.status == .cancelled || $0.status == .invalid }.count

        return TicketStatistics(
            total: total,
            checkedIn: checkedIn,
            valid: valid,
            cancelled: cancelled
        )
    }

    var statisticsByTicketType: [TicketTypeStatistics] {
        // Group tickets by ticket type name
        var typeStats: [String: (total: Int, checkedIn: Int)] = [:]

        for ticket in tickets {
            let typeName = ticket.ticketTypeName ?? "General"

            if typeStats[typeName] == nil {
                typeStats[typeName] = (total: 0, checkedIn: 0)
            }

            typeStats[typeName]!.total += 1
            if ticket.isCheckedIn {
                typeStats[typeName]!.checkedIn += 1
            }
        }

        // Convert to array and sort by total count descending
        return typeStats.map { name, stats in
            TicketTypeStatistics(
                typeName: name,
                total: stats.total,
                checkedIn: stats.checkedIn
            )
        }.sorted { $0.total > $1.total }
    }

    func loadTickets(eventId: String, businessId: String, token: String) async {
        self.eventId = eventId
        isLoading = true
        error = nil

        // First, try to load from cache
        let cachedTickets = syncManager.getCachedTickets(for: eventId)
        if !cachedTickets.isEmpty {
            tickets = cachedTickets.sorted { ($0.customerName ?? "") < ($1.customerName ?? "") }
        }

        // Then fetch fresh data from API
        if NetworkMonitor.shared.isConnected {
            do {
                let response = try await api.getTickets(
                    eventId: eventId,
                    businessId: businessId,
                    token: token
                )
                tickets = response.tickets.sorted { ($0.customerName ?? "") < ($1.customerName ?? "") }

                // Cache the tickets
                await syncManager.cacheTickets(response.tickets, for: eventId)
            } catch let apiError as APIError {
                if cachedTickets.isEmpty {
                    error = apiError.localizedDescription
                }
            } catch {
                if cachedTickets.isEmpty {
                    self.error = "Failed to load tickets"
                }
            }
        } else if cachedTickets.isEmpty {
            error = "No internet connection and no cached data available"
        }

        isLoading = false
    }

    func refresh(eventId: String, businessId: String, token: String) async {
        await loadTickets(eventId: eventId, businessId: businessId, token: token)
    }

    func manualCheckIn(ticket: Ticket, businessId: String, token: String) async -> ScanResult {
        guard NetworkMonitor.shared.isConnected else {
            // Handle offline check-in
            if let cached = syncManager.findCachedTicket(byQRCode: ticket.safeQrCodeData) {
                if cached.status == TicketStatus.used.rawValue {
                    return ScanResult(
                        type: .alreadyCheckedIn,
                        message: "Ticket was already checked in",
                        ticket: nil
                    )
                }

                cached.markAsUsed()
                syncManager.addPendingScan(qrCodeData: ticket.safeQrCodeData)

                return ScanResult(
                    type: .offline,
                    message: "Checked in offline. Will sync when online.",
                    ticket: nil
                )
            }

            return ScanResult(
                type: .error,
                message: "Cannot check in offline without cached data"
            )
        }

        do {
            let response = try await api.validateTicket(
                qrCodeData: ticket.safeQrCodeData,
                businessId: businessId,
                token: token
            )

            // Update local ticket
            if let index = tickets.firstIndex(where: { $0.id == ticket.id }) {
                let updatedTicket = tickets[index]
                // Create new ticket with updated status
                tickets[index] = Ticket(
                    id: updatedTicket.id,
                    eventId: updatedTicket.eventId,
                    orderId: updatedTicket.orderId,
                    ticketNumber: updatedTicket.ticketNumber,
                    qrCodeData: updatedTicket.qrCodeData,
                    ticketTypeId: updatedTicket.ticketTypeId,
                    ticketTypeName: updatedTicket.ticketTypeName,
                    price: updatedTicket.price,
                    status: .used,
                    checkedInAt: response.ticket?.checkedInAt,
                    customerName: updatedTicket.customerName,
                    customerEmail: updatedTicket.customerEmail,
                    customerPhone: updatedTicket.customerPhone,
                    createdAt: updatedTicket.createdAt,
                    purchaseDate: updatedTicket.purchaseDate,
                    updatedAt: updatedTicket.updatedAt,
                    event: updatedTicket.event
                )
            }

            if response.valid {
                return ScanResult(
                    type: .success,
                    message: response.message,
                    ticket: response.ticket
                )
            } else {
                return ScanResult(
                    type: .alreadyCheckedIn,
                    message: response.message,
                    ticket: response.ticket
                )
            }
        } catch {
            return ScanResult(
                type: .error,
                message: error.localizedDescription
            )
        }
    }
}

struct TicketStatistics {
    let total: Int
    let checkedIn: Int
    let valid: Int
    let cancelled: Int

    var checkedInPercentage: Double {
        guard total > 0 else { return 0 }
        return Double(checkedIn) / Double(total) * 100
    }
}

struct TicketTypeStatistics: Identifiable {
    let typeName: String
    let total: Int
    let checkedIn: Int

    var id: String { typeName }

    var remaining: Int {
        total - checkedIn
    }

    var checkedInPercentage: Double {
        guard total > 0 else { return 0 }
        return Double(checkedIn) / Double(total) * 100
    }
}
