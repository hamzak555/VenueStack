import Foundation
import SwiftUI
import AVFoundation
import Combine

@MainActor
class ScannerViewModel: ObservableObject {
    @Published var isScanning: Bool = false
    @Published var lastScanResult: ScanResult?
    @Published var showResult: Bool = false
    @Published var isProcessing: Bool = false
    @Published var torchEnabled: Bool = false
    @Published var scanHistory: [ScanResult] = []

    private let api = APIClient.shared
    private let syncManager = SyncManager.shared
    private var lastScannedCode: String?
    private var lastScanTime: Date?

    // Prevent duplicate scans within this interval
    private let scanDebounceInterval: TimeInterval = 2.0

    // MARK: - Scanning

    func handleScannedCode(_ code: String, businessId: String, token: String) async {
        // Prevent duplicate scans
        if let lastCode = lastScannedCode,
           let lastTime = lastScanTime,
           lastCode == code,
           Date().timeIntervalSince(lastTime) < scanDebounceInterval {
            return
        }

        lastScannedCode = code
        lastScanTime = Date()
        isProcessing = true

        // Provide haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        let result = await validateTicket(qrCodeData: code, businessId: businessId, token: token)

        lastScanResult = result
        scanHistory.insert(result, at: 0)

        // Keep only last 50 scans in history
        if scanHistory.count > 50 {
            scanHistory = Array(scanHistory.prefix(50))
        }

        isProcessing = false
        showResult = true

        // Provide feedback based on result
        provideFeedback(for: result.type)
    }

    private func validateTicket(qrCodeData: String, businessId: String, token: String) async -> ScanResult {
        // Validate QR code format
        let parts = qrCodeData.split(separator: "|")
        guard parts.count == 3 else {
            return ScanResult(
                type: .invalid,
                message: "Invalid QR code format"
            )
        }

        // Check if online
        if NetworkMonitor.shared.isConnected {
            return await validateOnline(qrCodeData: qrCodeData, businessId: businessId, token: token)
        } else {
            return validateOffline(qrCodeData: qrCodeData)
        }
    }

    private func validateOnline(qrCodeData: String, businessId: String, token: String) async -> ScanResult {
        do {
            let response = try await api.validateTicket(
                qrCodeData: qrCodeData,
                businessId: businessId,
                token: token
            )

            // Update cached ticket
            if let cached = syncManager.findCachedTicket(byQRCode: qrCodeData) {
                cached.markAsUsed()
            }

            if response.valid {
                // Check if it was already checked in
                if response.message.lowercased().contains("already") {
                    return ScanResult(
                        type: .alreadyCheckedIn,
                        message: response.message,
                        ticket: response.ticket
                    )
                }

                return ScanResult(
                    type: .success,
                    message: response.message,
                    ticket: response.ticket
                )
            } else {
                // Determine the type of failure
                let message = response.message.lowercased()

                if message.contains("not found") {
                    return ScanResult(
                        type: .notFound,
                        message: response.message,
                        ticket: response.ticket
                    )
                } else if message.contains("business") {
                    return ScanResult(
                        type: .wrongBusiness,
                        message: response.message,
                        ticket: response.ticket
                    )
                } else if message.contains("cancelled") || message.contains("invalid") {
                    return ScanResult(
                        type: .invalid,
                        message: response.message,
                        ticket: response.ticket
                    )
                } else {
                    return ScanResult(
                        type: .invalid,
                        message: response.message,
                        ticket: response.ticket
                    )
                }
            }
        } catch let apiError as APIError {
            return ScanResult(
                type: .error,
                message: apiError.localizedDescription
            )
        } catch {
            return ScanResult(
                type: .error,
                message: "Failed to validate ticket"
            )
        }
    }

    private func validateOffline(qrCodeData: String) -> ScanResult {
        // Check local cache
        if let cached = syncManager.findCachedTicket(byQRCode: qrCodeData) {
            // Check if already scanned
            if cached.status == TicketStatus.used.rawValue || cached.checkedInAt != nil {
                return ScanResult(
                    type: .alreadyCheckedIn,
                    message: "Ticket was already checked in",
                    ticket: ValidatedTicket(
                        ticketNumber: cached.ticketNumber,
                        eventTitle: cached.event?.title ?? "Unknown Event",
                        customerName: cached.customerName ?? "Unknown",
                        customerEmail: cached.customerEmail ?? "",
                        price: cached.price,
                        status: cached.status,
                        checkedInAt: cached.checkedInAt.map { ISO8601DateFormatter().string(from: $0) },
                        eventDate: cached.event?.eventDate ?? "",
                        eventTime: cached.event?.eventTime,
                        location: cached.event?.location
                    )
                )
            }

            // Check ticket status
            if cached.status == TicketStatus.cancelled.rawValue ||
               cached.status == TicketStatus.invalid.rawValue {
                return ScanResult(
                    type: .invalid,
                    message: "Ticket is \(cached.status)",
                    ticket: nil
                )
            }

            // Mark as used locally
            cached.markAsUsed()

            // Add to pending sync queue
            syncManager.addPendingScan(qrCodeData: qrCodeData)

            return ScanResult(
                type: .offline,
                message: "Checked in offline. Will sync when online.",
                ticket: ValidatedTicket(
                    ticketNumber: cached.ticketNumber,
                    eventTitle: cached.event?.title ?? "Unknown Event",
                    customerName: cached.customerName ?? "Unknown",
                    customerEmail: cached.customerEmail ?? "",
                    price: cached.price,
                    status: "used",
                    checkedInAt: ISO8601DateFormatter().string(from: Date()),
                    eventDate: cached.event?.eventDate ?? "",
                    eventTime: cached.event?.eventTime,
                    location: cached.event?.location
                )
            )
        }

        // Ticket not found in cache
        return ScanResult(
            type: .notFound,
            message: "Ticket not found. Please sync tickets while online."
        )
    }

    // MARK: - Feedback

    private func provideFeedback(for resultType: ScanResultType) {
        let generator = UINotificationFeedbackGenerator()

        switch resultType {
        case .success, .offline:
            generator.notificationOccurred(.success)
            playSound(success: true)
        case .alreadyCheckedIn:
            generator.notificationOccurred(.warning)
            playSound(success: true) // Still allow entry
        case .invalid, .wrongBusiness, .notFound, .error:
            generator.notificationOccurred(.error)
            playSound(success: false)
        }
    }

    private func playSound(success: Bool) {
        let soundID: SystemSoundID = success ? 1057 : 1053
        AudioServicesPlaySystemSound(soundID)
    }

    // MARK: - Torch Control

    func toggleTorch() {
        guard let device = AVCaptureDevice.default(for: .video),
              device.hasTorch else { return }

        do {
            try device.lockForConfiguration()
            device.torchMode = torchEnabled ? .off : .on
            torchEnabled.toggle()
            device.unlockForConfiguration()
        } catch {
            print("Failed to toggle torch: \(error)")
        }
    }

    // MARK: - History

    func clearHistory() {
        scanHistory.removeAll()
    }

    // MARK: - Reset

    func dismissResult() {
        showResult = false
    }

    func resetScanner() {
        lastScannedCode = nil
        lastScanTime = nil
        isProcessing = false
        showResult = false
    }
}
