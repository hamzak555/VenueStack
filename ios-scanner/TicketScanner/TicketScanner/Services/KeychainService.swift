import Foundation
import Security

enum KeychainError: LocalizedError {
    case duplicateItem
    case unknown(OSStatus)
    case notFound
    case invalidData

    var errorDescription: String? {
        switch self {
        case .duplicateItem:
            return "Item already exists in keychain"
        case .unknown(let status):
            return "Keychain error: \(status)"
        case .notFound:
            return "Item not found in keychain"
        case .invalidData:
            return "Invalid data format"
        }
    }
}

class KeychainService {
    static let shared = KeychainService()

    private let service = "com.hamzakhalid.ticketscanner"

    private enum Keys {
        static let sessionData = "session_data"
        static let pendingToken = "pending_token"
    }

    private init() {}

    // MARK: - Session Data

    func saveSession(_ session: SessionData) throws {
        let encoder = JSONEncoder()
        let data = try encoder.encode(session)
        try save(data: data, forKey: Keys.sessionData)
    }

    func getSession() -> SessionData? {
        guard let data = getData(forKey: Keys.sessionData) else {
            return nil
        }

        let decoder = JSONDecoder()
        return try? decoder.decode(SessionData.self, from: data)
    }

    func deleteSession() {
        delete(forKey: Keys.sessionData)
    }

    // MARK: - Pending Token (for business selection flow)

    func savePendingToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw KeychainError.invalidData
        }
        try save(data: data, forKey: Keys.pendingToken)
    }

    func getPendingToken() -> String? {
        guard let data = getData(forKey: Keys.pendingToken) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func deletePendingToken() {
        delete(forKey: Keys.pendingToken)
    }

    // MARK: - Clear All

    func clearAll() {
        deleteSession()
        deletePendingToken()
    }

    // MARK: - Private Helpers

    private func save(data: Data, forKey key: String) throws {
        // First try to delete any existing item
        delete(forKey: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            if status == errSecDuplicateItem {
                throw KeychainError.duplicateItem
            }
            throw KeychainError.unknown(status)
        }
    }

    private func getData(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            return nil
        }

        return result as? Data
    }

    private func delete(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }

    private func update(data: Data, forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                throw KeychainError.notFound
            }
            throw KeychainError.unknown(status)
        }
    }
}
