import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let name: String
    let role: UserRole
    let businessId: String?
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case role
        case businessId = "business_id"
        case isActive = "is_active"
    }
}

enum UserRole: String, Codable {
    case admin
    case regular
}

// Login request/response
struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let success: Bool
    let message: String?
    let requiresSelection: Bool?
    let affiliations: [BusinessAffiliation]?
    let token: String?

    // Filter to only business affiliations (exclude admin)
    var businessAffiliations: [BusinessAffiliation] {
        affiliations?.filter { $0.type == "business" } ?? []
    }
}

struct SelectAffiliationRequest: Codable {
    let affiliationType: String
    let businessId: String?

    enum CodingKeys: String, CodingKey {
        case affiliationType = "affiliation_type"
        case businessId = "business_id"
    }
}

struct SelectAffiliationResponse: Codable {
    let success: Bool
    let message: String?
    let business: Business?
    let user: BusinessUserInfo?
    let token: String?
}

struct BusinessUserInfo: Codable {
    let id: String
    let email: String
    let name: String
    let role: String
    let businessId: String

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case role
        case businessId = "business_id"
    }
}

// Session data stored locally
struct SessionData: Codable {
    let token: String
    let businessId: String
    let businessName: String
    let businessSlug: String
    let themeColor: String
    let logoUrl: String?
    let userId: String
    let userName: String
    let userEmail: String
    let userRole: String
    let expiresAt: Date

    var isExpired: Bool {
        return Date() >= expiresAt
    }

    // Regular initializer
    init(token: String, businessId: String, businessName: String, businessSlug: String, themeColor: String, logoUrl: String?, userId: String, userName: String, userEmail: String, userRole: String, expiresAt: Date) {
        self.token = token
        self.businessId = businessId
        self.businessName = businessName
        self.businessSlug = businessSlug
        self.themeColor = themeColor
        self.logoUrl = logoUrl
        self.userId = userId
        self.userName = userName
        self.userEmail = userEmail
        self.userRole = userRole
        self.expiresAt = expiresAt
    }

    // Migration initializer for old sessions without logoUrl
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        token = try container.decode(String.self, forKey: .token)
        businessId = try container.decode(String.self, forKey: .businessId)
        businessName = try container.decode(String.self, forKey: .businessName)
        businessSlug = try container.decode(String.self, forKey: .businessSlug)
        themeColor = try container.decode(String.self, forKey: .themeColor)
        logoUrl = try container.decodeIfPresent(String.self, forKey: .logoUrl)
        userId = try container.decode(String.self, forKey: .userId)
        userName = try container.decode(String.self, forKey: .userName)
        userEmail = try container.decode(String.self, forKey: .userEmail)
        userRole = try container.decode(String.self, forKey: .userRole)
        expiresAt = try container.decode(Date.self, forKey: .expiresAt)
    }
}
