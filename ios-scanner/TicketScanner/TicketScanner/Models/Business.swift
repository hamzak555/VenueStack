import Foundation

struct Business: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let logoUrl: String?
    let contactEmail: String?
    let contactPhone: String?
    let website: String?
    let address: String?
    let themeColor: String?
    let isActive: Bool?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case description
        case logoUrl = "logo_url"
        case contactEmail = "contact_email"
        case contactPhone = "contact_phone"
        case website
        case address
        case themeColor = "theme_color"
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var safeThemeColor: String {
        themeColor ?? "#007AFF"
    }
}

struct BusinessAffiliation: Codable, Identifiable, Hashable {
    let id: String
    let type: String?
    let businessId: String?
    let businessName: String?
    let businessSlug: String?
    let businessLogo: String?
    let themeColor: String?
    let role: String?
    let email: String?
    let name: String

    // Safe accessors with defaults
    var safeBusinessId: String { businessId ?? id }
    var safeBusinessName: String { businessName ?? name }
    var safeBusinessSlug: String { businessSlug ?? "" }
    var safeThemeColor: String { themeColor ?? "#007AFF" }
    var safeRole: String { role ?? "regular" }
}

struct AffiliationsResponse: Codable {
    let affiliations: [AffiliationType]
}

enum AffiliationType: Codable, Hashable {
    case admin(AdminAffiliation)
    case business(BusinessAffiliation)

    var displayName: String {
        switch self {
        case .admin(let admin):
            return "Platform Admin (\(admin.email))"
        case .business(let business):
            return business.safeBusinessName
        }
    }

    var id: String {
        switch self {
        case .admin(let admin):
            return "admin-\(admin.id)"
        case .business(let business):
            return business.id
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        // Try to decode as business first (more common)
        if let business = try? container.decode(BusinessAffiliation.self) {
            self = .business(business)
            return
        }

        // Try admin
        if let admin = try? container.decode(AdminAffiliation.self) {
            self = .admin(admin)
            return
        }

        throw DecodingError.typeMismatch(
            AffiliationType.self,
            DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Could not decode affiliation")
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .admin(let admin):
            try container.encode(admin)
        case .business(let business):
            try container.encode(business)
        }
    }
}

struct AdminAffiliation: Codable, Hashable {
    let id: String
    let email: String
    let name: String
}
