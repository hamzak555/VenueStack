import Foundation
import SwiftUI
import Combine

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var error: String?

    @Published var currentBusiness: Business?
    @Published var currentUser: BusinessUserInfo?

    // For business selection flow
    @Published var pendingAffiliations: [BusinessAffiliation]?
    @Published var pendingToken: String?

    private let api = APIClient.shared
    private let keychain = KeychainService.shared

    init() {
        checkExistingSession()
    }

    // MARK: - Session Management

    func checkExistingSession() {
        isLoading = true

        if let session = keychain.getSession() {
            if session.isExpired {
                // Session expired, clear and require re-login
                logout()
            } else {
                // Valid session exists
                currentBusiness = Business(
                    id: session.businessId,
                    name: session.businessName,
                    slug: session.businessSlug,
                    description: nil,
                    logoUrl: session.logoUrl,
                    contactEmail: nil,
                    contactPhone: nil,
                    website: nil,
                    address: nil,
                    themeColor: session.themeColor,
                    isActive: true,
                    createdAt: nil,
                    updatedAt: nil
                )
                currentUser = BusinessUserInfo(
                    id: session.userId,
                    email: session.userEmail,
                    name: session.userName,
                    role: session.userRole,
                    businessId: session.businessId
                )
                isAuthenticated = true
            }
        }

        isLoading = false
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            error = "Please enter email and password"
            return
        }

        isLoading = true
        error = nil

        do {
            let response = try await api.login(email: email, password: password)

            if response.success {
                let affiliations = response.businessAffiliations
                if !affiliations.isEmpty {
                    // Save pending token for business selection
                    if let token = response.token {
                        try? keychain.savePendingToken(token)
                        pendingToken = token
                    }

                    if affiliations.count == 1 {
                        // Auto-select if only one business
                        await selectBusiness(affiliations[0])
                    } else {
                        // Show business selector
                        pendingAffiliations = affiliations
                    }
                } else {
                    error = "No business affiliations found"
                }
            } else {
                error = response.message ?? "Login failed"
            }
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = "An unexpected error occurred"
        }

        isLoading = false
    }

    // MARK: - Business Selection

    func selectBusiness(_ affiliation: BusinessAffiliation) async {
        isLoading = true
        error = nil

        guard let token = pendingToken ?? keychain.getPendingToken() else {
            error = "Session expired. Please log in again."
            pendingAffiliations = nil
            isLoading = false
            return
        }

        do {
            let response = try await api.selectAffiliation(
                businessId: affiliation.safeBusinessId,
                token: token
            )

            if response.success {
                // Save session
                if let sessionToken = response.token,
                   let business = response.business,
                   let user = response.user {

                    let session = SessionData(
                        token: sessionToken,
                        businessId: business.id,
                        businessName: business.name,
                        businessSlug: business.slug,
                        themeColor: business.safeThemeColor,
                        logoUrl: business.logoUrl,
                        userId: user.id,
                        userName: user.name,
                        userEmail: user.email,
                        userRole: user.role,
                        expiresAt: Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
                    )

                    try keychain.saveSession(session)
                    keychain.deletePendingToken()

                    currentBusiness = business
                    currentUser = user
                    pendingAffiliations = nil
                    pendingToken = nil
                    isAuthenticated = true
                } else {
                    // Fallback: use affiliation data directly
                    let session = SessionData(
                        token: token,
                        businessId: affiliation.safeBusinessId,
                        businessName: affiliation.safeBusinessName,
                        businessSlug: affiliation.safeBusinessSlug,
                        themeColor: affiliation.safeThemeColor,
                        logoUrl: affiliation.businessLogo,
                        userId: affiliation.id,
                        userName: affiliation.name,
                        userEmail: affiliation.email ?? "",
                        userRole: affiliation.safeRole,
                        expiresAt: Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
                    )

                    try keychain.saveSession(session)
                    keychain.deletePendingToken()

                    currentBusiness = Business(
                        id: affiliation.safeBusinessId,
                        name: affiliation.safeBusinessName,
                        slug: affiliation.safeBusinessSlug,
                        description: nil,
                        logoUrl: affiliation.businessLogo,
                        contactEmail: nil,
                        contactPhone: nil,
                        website: nil,
                        address: nil,
                        themeColor: affiliation.safeThemeColor,
                        isActive: true,
                        createdAt: nil,
                        updatedAt: nil
                    )
                    currentUser = BusinessUserInfo(
                        id: affiliation.id,
                        email: affiliation.email ?? "",
                        name: affiliation.name,
                        role: affiliation.safeRole,
                        businessId: affiliation.safeBusinessId
                    )
                    pendingAffiliations = nil
                    pendingToken = nil
                    isAuthenticated = true
                }
            } else {
                error = response.message ?? "Failed to select business"
            }
        } catch let apiError as APIError {
            error = apiError.localizedDescription
        } catch {
            self.error = "An unexpected error occurred"
        }

        isLoading = false
    }

    func cancelBusinessSelection() {
        pendingAffiliations = nil
        pendingToken = nil
        keychain.deletePendingToken()
    }

    /// Switch to a different business (shows business selector)
    @MainActor
    func switchBusiness() async {
        // Get current session info
        guard let session = keychain.getSession() else {
            print("[SwitchBusiness] No session found, logging out")
            logout()
            return
        }

        print("[SwitchBusiness] Starting switch with token: \(session.token.prefix(20))...")
        isLoading = true
        error = nil

        do {
            let affiliations = try await api.getAffiliations(token: session.token)
            print("[SwitchBusiness] Got \(affiliations.count) affiliations")

            // Filter to only business affiliations (exclude admin type)
            let businessAffiliations = affiliations.filter { $0.type == "business" }
            print("[SwitchBusiness] Filtered to \(businessAffiliations.count) business affiliations")

            if businessAffiliations.isEmpty {
                error = "No business affiliations found"
                isLoading = false
                return
            }

            // Save current token as pending token BEFORE clearing session
            let tokenToSave = session.token
            try? keychain.savePendingToken(tokenToSave)
            pendingToken = tokenToSave

            print("[SwitchBusiness] Saved pending token")

            // Clear current session
            keychain.deleteSession()

            print("[SwitchBusiness] Deleted session, setting state...")

            // IMPORTANT: Set pendingAffiliations BEFORE setting isAuthenticated to false
            // This ensures ContentView sees the affiliations when it re-renders
            pendingAffiliations = businessAffiliations
            currentBusiness = nil
            currentUser = nil
            isAuthenticated = false
            isLoading = false

            print("[SwitchBusiness] State updated - pendingAffiliations: \(pendingAffiliations?.count ?? 0), isAuthenticated: \(isAuthenticated)")

        } catch let apiError as APIError {
            print("[SwitchBusiness] API Error: \(apiError.localizedDescription)")
            self.error = apiError.localizedDescription
            isLoading = false
        } catch {
            print("[SwitchBusiness] Error: \(error)")
            self.error = "Failed to load accounts: \(error.localizedDescription)"
            isLoading = false
        }
    }

    // MARK: - Logout

    func logout() {
        keychain.clearAll()
        SyncManager.shared.clearAllCache()

        currentBusiness = nil
        currentUser = nil
        pendingAffiliations = nil
        pendingToken = nil
        isAuthenticated = false
        error = nil
    }

    // MARK: - Token Access

    var currentToken: String? {
        keychain.getSession()?.token
    }

    var currentBusinessId: String? {
        keychain.getSession()?.businessId
    }
}
