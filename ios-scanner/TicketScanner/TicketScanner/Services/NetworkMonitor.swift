import Foundation
import Network
import Combine

class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()

    @Published var isConnected: Bool = true
    @Published var connectionType: ConnectionType = .unknown

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "NetworkMonitor")

    enum ConnectionType {
        case wifi
        case cellular
        case ethernet
        case unknown

        var description: String {
            switch self {
            case .wifi:
                return "WiFi"
            case .cellular:
                return "Cellular"
            case .ethernet:
                return "Ethernet"
            case .unknown:
                return "Unknown"
            }
        }
    }

    init() {
        monitor = NWPathMonitor()
        startMonitoring()
    }

    deinit {
        stopMonitoring()
    }

    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.updateConnectionType(path)

                // Trigger sync when connection is restored
                if path.status == .satisfied {
                    Task {
                        await SyncManager.shared.syncPendingScans()
                    }
                }
            }
        }
        monitor.start(queue: queue)
    }

    func stopMonitoring() {
        monitor.cancel()
    }

    private func updateConnectionType(_ path: NWPath) {
        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }
    }

    // Check if we can reach a specific host
    func canReach(host: String, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: host) else {
            completion(false)
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        request.timeoutInterval = 5

        URLSession.shared.dataTask(with: request) { _, response, _ in
            DispatchQueue.main.async {
                if let httpResponse = response as? HTTPURLResponse {
                    completion(200..<400 ~= httpResponse.statusCode)
                } else {
                    completion(false)
                }
            }
        }.resume()
    }
}
