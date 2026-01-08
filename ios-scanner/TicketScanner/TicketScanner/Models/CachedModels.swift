import Foundation
import SwiftData

@Model
final class CachedEvent {
    @Attribute(.unique) var id: String
    var businessId: String
    var title: String
    var eventDescription: String?
    var eventDate: String
    var eventTime: String?
    var location: String?
    var imageUrl: String?
    var availableTickets: Int
    var totalTickets: Int
    var status: String
    var lastSyncedAt: Date

    @Relationship(deleteRule: .cascade, inverse: \CachedTicket.event)
    var tickets: [CachedTicket]?

    init(from event: Event) {
        self.id = event.id
        self.businessId = event.businessId
        self.title = event.title
        self.eventDescription = event.description
        self.eventDate = event.eventDate
        self.eventTime = event.eventTime
        self.location = event.location
        self.imageUrl = event.imageUrl
        self.availableTickets = event.safeAvailableTickets
        self.totalTickets = event.safeTotalTickets
        self.status = event.safeStatus.rawValue
        self.lastSyncedAt = Date()
        self.tickets = []
    }

    func update(from event: Event) {
        self.title = event.title
        self.eventDescription = event.description
        self.eventDate = event.eventDate
        self.eventTime = event.eventTime
        self.location = event.location
        self.imageUrl = event.imageUrl
        self.availableTickets = event.safeAvailableTickets
        self.totalTickets = event.safeTotalTickets
        self.status = event.safeStatus.rawValue
        self.lastSyncedAt = Date()
    }

    func toEvent() -> Event {
        return Event(
            id: id,
            businessId: businessId,
            title: title,
            description: eventDescription,
            eventDate: eventDate,
            eventTime: eventTime,
            location: location,
            locationLatitude: nil,
            locationLongitude: nil,
            imageUrl: imageUrl,
            ticketPrice: nil,
            availableTickets: availableTickets,
            totalTickets: totalTickets,
            checkedInCount: nil,
            status: EventStatus(rawValue: status) ?? .published,
            createdAt: nil,
            updatedAt: nil
        )
    }
}

@Model
final class CachedTicket {
    @Attribute(.unique) var id: String
    var eventId: String
    var ticketNumber: String
    var qrCodeData: String
    var customerName: String?
    var customerEmail: String?
    var price: Double
    var status: String
    var checkedInAt: Date?
    var lastSyncedAt: Date

    var event: CachedEvent?

    init(from ticket: Ticket) {
        self.id = ticket.id
        self.eventId = ticket.eventId
        self.ticketNumber = ticket.ticketNumber
        self.qrCodeData = ticket.safeQrCodeData
        self.customerName = ticket.customerName
        self.customerEmail = ticket.customerEmail
        self.price = ticket.safePrice
        self.status = ticket.safeStatus.rawValue
        self.checkedInAt = CachedTicket.parseDate(ticket.checkedInAt)
        self.lastSyncedAt = Date()
    }

    func update(from ticket: Ticket) {
        self.ticketNumber = ticket.ticketNumber
        self.customerName = ticket.customerName
        self.customerEmail = ticket.customerEmail
        self.price = ticket.safePrice
        self.status = ticket.safeStatus.rawValue
        self.checkedInAt = CachedTicket.parseDate(ticket.checkedInAt)
        self.lastSyncedAt = Date()
    }

    func markAsUsed() {
        self.status = TicketStatus.used.rawValue
        self.checkedInAt = Date()
    }

    private static func parseDate(_ dateString: String?) -> Date? {
        guard let dateString = dateString else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateString)
    }

    func toTicket() -> Ticket {
        let formatter = ISO8601DateFormatter()
        let checkedInAtString = checkedInAt.map { formatter.string(from: $0) }

        return Ticket(
            id: id,
            eventId: eventId,
            orderId: nil,
            ticketNumber: ticketNumber,
            qrCodeData: qrCodeData,
            ticketTypeId: nil,
            ticketTypeName: nil,
            price: price,
            status: TicketStatus(rawValue: status) ?? .valid,
            checkedInAt: checkedInAtString,
            customerName: customerName,
            customerEmail: customerEmail,
            customerPhone: nil,
            createdAt: nil,
            purchaseDate: nil,
            updatedAt: nil,
            event: nil
        )
    }
}

@Model
final class PendingScan {
    @Attribute(.unique) var id: String
    var qrCodeData: String
    var scannedAt: Date
    var synced: Bool
    var syncAttempts: Int
    var lastSyncAttempt: Date?
    var errorMessage: String?

    init(qrCodeData: String) {
        self.id = UUID().uuidString
        self.qrCodeData = qrCodeData
        self.scannedAt = Date()
        self.synced = false
        self.syncAttempts = 0
        self.lastSyncAttempt = nil
        self.errorMessage = nil
    }

    func markSynced() {
        self.synced = true
        self.lastSyncAttempt = Date()
    }

    func markFailed(error: String) {
        self.syncAttempts += 1
        self.lastSyncAttempt = Date()
        self.errorMessage = error
    }

    func toPendingScanData() -> PendingScanData {
        let formatter = ISO8601DateFormatter()
        return PendingScanData(
            qrCodeData: qrCodeData,
            scannedAt: formatter.string(from: scannedAt)
        )
    }
}
