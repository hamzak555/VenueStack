import Foundation

struct Ticket: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let orderId: String?
    let ticketNumber: String
    let qrCodeData: String?
    let ticketTypeId: String?
    let ticketTypeName: String?
    let price: Double?
    let status: TicketStatus?
    let checkedInAt: String?
    let customerName: String?
    let customerEmail: String?
    let customerPhone: String?
    let createdAt: String?
    let purchaseDate: String?
    let updatedAt: String?

    // Nested event info (from API response)
    var event: TicketEvent?

    enum CodingKeys: String, CodingKey {
        case id
        case eventId = "event_id"
        case orderId = "order_id"
        case ticketNumber = "ticket_number"
        case qrCodeData = "qr_code_data"
        case ticketTypeId = "ticket_type_id"
        case ticketTypeName = "ticket_type_name"
        case price
        case status
        case checkedInAt = "checked_in_at"
        case customerName = "customer_name"
        case customerEmail = "customer_email"
        case customerPhone = "customer_phone"
        case createdAt = "created_at"
        case purchaseDate = "purchase_date"
        case updatedAt = "updated_at"
        case event
    }

    var safePrice: Double {
        price ?? 0
    }

    var safeStatus: TicketStatus {
        status ?? .valid
    }

    var safeQrCodeData: String {
        qrCodeData ?? ticketNumber
    }

    var formattedPrice: String {
        return String(format: "$%.2f", safePrice)
    }

    var formattedCheckedInTime: String? {
        guard let checkedInAt = checkedInAt else { return nil }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: checkedInAt) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: checkedInAt) else { return checkedInAt }
            return formatDate(date)
        }
        return formatDate(date)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var isCheckedIn: Bool {
        checkedInAt != nil
    }
}

struct TicketEvent: Codable, Hashable {
    let title: String
    let eventDate: String
    let eventTime: String?
    let location: String?
    let businessId: String

    enum CodingKeys: String, CodingKey {
        case title
        case eventDate = "event_date"
        case eventTime = "event_time"
        case location
        case businessId = "business_id"
    }
}

enum TicketStatus: String, Codable {
    case valid
    case used
    case cancelled
    case invalid

    var displayName: String {
        switch self {
        case .valid: return "Valid"
        case .used: return "Used"
        case .cancelled: return "Cancelled"
        case .invalid: return "Invalid"
        }
    }

    var color: String {
        switch self {
        case .valid: return "green"
        case .used: return "yellow"
        case .cancelled, .invalid: return "red"
        }
    }
}

// Response wrapper for bulk ticket download
struct TicketsResponse: Codable {
    let tickets: [Ticket]
    let total: Int
    let eventId: String

    enum CodingKeys: String, CodingKey {
        case tickets
        case total
        case eventId = "event_id"
    }
}
