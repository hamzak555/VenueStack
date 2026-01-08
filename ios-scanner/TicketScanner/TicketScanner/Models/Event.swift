import Foundation

struct Event: Codable, Identifiable, Hashable {
    let id: String
    let businessId: String
    let title: String
    let description: String?
    let eventDate: String
    let eventTime: String?
    let location: String?
    let locationLatitude: Double?
    let locationLongitude: Double?
    let imageUrl: String?
    let ticketPrice: Double?
    let availableTickets: Int?
    let totalTickets: Int?
    let checkedInCount: Int?
    let status: EventStatus?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case businessId = "business_id"
        case title
        case description
        case eventDate = "event_date"
        case eventTime = "event_time"
        case location
        case locationLatitude = "location_latitude"
        case locationLongitude = "location_longitude"
        case imageUrl = "image_url"
        case ticketPrice = "ticket_price"
        case availableTickets = "available_tickets"
        case totalTickets = "total_tickets"
        case checkedInCount = "checked_in_count"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // Computed properties
    private var parsedDate: Date? {
        // Try ISO8601 format first (from API: "2026-07-04T00:00:00+00:00")
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: eventDate) {
            return date
        }

        // Try without fractional seconds
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: eventDate) {
            return date
        }

        // Fall back to simple date format
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: eventDate)
    }

    var formattedDate: String {
        guard let date = parsedDate else { return eventDate }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var formattedTime: String? {
        guard let time = eventTime else { return nil }

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        guard let date = formatter.date(from: time) else { return time }

        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    var isUpcoming: Bool {
        guard let date = parsedDate else { return false }
        return date >= Calendar.current.startOfDay(for: Date())
    }

    var soldTickets: Int {
        (totalTickets ?? 0) - (availableTickets ?? 0)
    }

    var soldPercentage: Double {
        guard let total = totalTickets, total > 0 else { return 0 }
        return Double(soldTickets) / Double(total) * 100
    }

    var safeStatus: EventStatus {
        status ?? .draft
    }

    var safeAvailableTickets: Int {
        availableTickets ?? 0
    }

    var safeTotalTickets: Int {
        totalTickets ?? 0
    }

    var safeCheckedInCount: Int {
        checkedInCount ?? 0
    }

    var checkedInPercentage: Double {
        guard let total = totalTickets, total > 0 else { return 0 }
        return Double(safeCheckedInCount) / Double(total) * 100
    }
}

enum EventStatus: String, Codable {
    case draft
    case published
    case cancelled

    var displayName: String {
        switch self {
        case .draft: return "Draft"
        case .published: return "Published"
        case .cancelled: return "Cancelled"
        }
    }
}

// Response wrapper for API
struct EventsResponse: Codable {
    let events: [Event]
}
