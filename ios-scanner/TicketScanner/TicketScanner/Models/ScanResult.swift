import Foundation

enum ScanResultType {
    case success
    case alreadyCheckedIn
    case invalid
    case wrongBusiness
    case notFound
    case offline
    case error

    var title: String {
        switch self {
        case .success:
            return "Check-in Complete"
        case .alreadyCheckedIn:
            return "Already Checked In"
        case .invalid:
            return "Invalid Ticket"
        case .wrongBusiness:
            return "Wrong Business"
        case .notFound:
            return "Ticket Not Found"
        case .offline:
            return "Offline Check-in"
        case .error:
            return "Error"
        }
    }

    var iconName: String {
        switch self {
        case .success:
            return "checkmark.circle.fill"
        case .alreadyCheckedIn:
            return "exclamationmark.triangle.fill"
        case .invalid, .wrongBusiness, .notFound:
            return "xmark.circle.fill"
        case .offline:
            return "wifi.slash"
        case .error:
            return "exclamationmark.circle.fill"
        }
    }

    var color: String {
        switch self {
        case .success:
            return "green"
        case .alreadyCheckedIn:
            return "orange"
        case .invalid, .wrongBusiness, .notFound:
            return "red"
        case .offline:
            return "blue"
        case .error:
            return "gray"
        }
    }

    var allowEntry: Bool {
        switch self {
        case .success, .alreadyCheckedIn, .offline:
            return true
        default:
            return false
        }
    }
}

struct ScanResult: Identifiable {
    let id = UUID()
    let type: ScanResultType
    let message: String
    let ticket: ValidatedTicket?
    let scannedAt: Date

    init(type: ScanResultType, message: String, ticket: ValidatedTicket? = nil) {
        self.type = type
        self.message = message
        self.ticket = ticket
        self.scannedAt = Date()
    }
}

struct ValidatedTicket: Codable {
    let ticketNumber: String
    let eventTitle: String
    let customerName: String
    let customerEmail: String
    let price: Double
    let status: String
    let checkedInAt: String?
    let eventDate: String
    let eventTime: String?
    let location: String?

    var formattedPrice: String {
        return String(format: "$%.2f", price)
    }

    var formattedCheckedInTime: String? {
        guard let checkedInAt = checkedInAt else { return nil }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: checkedInAt) else {
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: checkedInAt) else { return checkedInAt }
            return formatDate(date)
        }
        return formatDate(date)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// API response for ticket validation
struct ValidationResponse: Codable {
    let valid: Bool
    let message: String
    let ticket: ValidatedTicket?
}

// Batch sync request/response
struct BatchSyncRequest: Codable {
    let scans: [PendingScanData]
    let businessId: String

    enum CodingKeys: String, CodingKey {
        case scans
        case businessId = "business_id"
    }
}

struct PendingScanData: Codable {
    let qrCodeData: String
    let scannedAt: String

    enum CodingKeys: String, CodingKey {
        case qrCodeData = "qr_code_data"
        case scannedAt = "scanned_at"
    }
}

struct BatchSyncResponse: Codable {
    let results: [BatchSyncResult]
    let syncedCount: Int
    let failedCount: Int

    enum CodingKeys: String, CodingKey {
        case results
        case syncedCount = "synced_count"
        case failedCount = "failed_count"
    }
}

struct BatchSyncResult: Codable {
    let qrCodeData: String
    let success: Bool
    let message: String?
    let conflict: Bool?

    enum CodingKeys: String, CodingKey {
        case qrCodeData = "qr_code_data"
        case success
        case message
        case conflict
    }
}
