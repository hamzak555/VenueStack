import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case networkError(Error)
    case decodingError(Error)
    case serverError(Int, String?)
    case unauthorized
    case noData

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return message ?? "Server error: \(code)"
        case .unauthorized:
            return "Session expired. Please log in again."
        case .noData:
            return "No data received"
        }
    }
}

class APIClient {
    static let shared = APIClient()

    // IMPORTANT: Update this to your actual API URL
    private var baseURL: String {
        // For development, use your local IP or ngrok URL
        // For production, use your deployed domain
        #if DEBUG
        return "http://192.168.0.31:3001/api"
        #else
        return "https://your-domain.com/api"
        #endif
    }

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Generic Request Methods

    private func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Encodable? = nil,
        token: String? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = try encoder.encode(body)
        }

        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }

            guard 200..<300 ~= httpResponse.statusCode else {
                let errorMessage = try? decoder.decode(ErrorResponse.self, from: data)
                throw APIError.serverError(httpResponse.statusCode, errorMessage?.message)
            }

            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Authentication

    func login(email: String, password: String) async throws -> LoginResponse {
        let body = LoginRequest(email: email, password: password)
        return try await request(
            endpoint: "/auth/login",
            method: "POST",
            body: body
        )
    }

    func selectAffiliation(businessId: String, token: String) async throws -> SelectAffiliationResponse {
        let body = SelectAffiliationRequest(affiliationType: "business", businessId: businessId)
        return try await request(
            endpoint: "/auth/select",
            method: "POST",
            body: body,
            token: token
        )
    }

    func getAffiliations(token: String) async throws -> [BusinessAffiliation] {
        struct Response: Codable {
            let affiliations: [BusinessAffiliation]
        }
        let response: Response = try await request(
            endpoint: "/auth/affiliations",
            token: token
        )
        return response.affiliations
    }

    // MARK: - Events

    func getEvents(businessId: String, token: String) async throws -> [Event] {
        let response: EventsResponse = try await request(
            endpoint: "/businesses/\(businessId)/events",
            token: token
        )
        return response.events
    }

    func getEvent(eventId: String, token: String) async throws -> Event {
        return try await request(
            endpoint: "/events/\(eventId)",
            token: token
        )
    }

    // MARK: - Tickets

    func getTickets(eventId: String, businessId: String, token: String) async throws -> TicketsResponse {
        return try await request(
            endpoint: "/events/\(eventId)/tickets?businessId=\(businessId)",
            token: token
        )
    }

    func getModifiedTickets(eventId: String, since: Date, token: String) async throws -> TicketsResponse {
        let formatter = ISO8601DateFormatter()
        let sinceString = formatter.string(from: since)
        return try await request(
            endpoint: "/events/\(eventId)/tickets/modified?since=\(sinceString)",
            token: token
        )
    }

    // MARK: - Ticket Validation

    func validateTicket(qrCodeData: String, businessId: String, token: String) async throws -> ValidationResponse {
        struct ValidateRequest: Codable {
            let qrCodeData: String
            let businessId: String
        }

        let body = ValidateRequest(qrCodeData: qrCodeData, businessId: businessId)
        return try await request(
            endpoint: "/tickets/validate",
            method: "POST",
            body: body,
            token: token
        )
    }

    func batchSync(scans: [PendingScanData], businessId: String, token: String) async throws -> BatchSyncResponse {
        let body = BatchSyncRequest(scans: scans, businessId: businessId)
        return try await request(
            endpoint: "/tickets/batch-validate",
            method: "POST",
            body: body,
            token: token
        )
    }

    // MARK: - Business

    func getBusiness(businessId: String, token: String) async throws -> Business {
        return try await request(
            endpoint: "/businesses/\(businessId)",
            token: token
        )
    }
}

// Helper struct for error responses
struct ErrorResponse: Codable {
    let message: String?
    let error: String?
}
