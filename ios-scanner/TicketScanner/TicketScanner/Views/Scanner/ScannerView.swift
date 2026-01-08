import SwiftUI
import AVFoundation

struct ScannerView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = ScannerViewModel()
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @Environment(\.dismiss) private var dismiss

    var preselectedEvent: Event? = nil
    var onBack: (() -> Void)? = nil

    // When pushed from another view (has preselectedEvent), don't wrap in NavigationStack
    private var isEmbedded: Bool {
        preselectedEvent != nil
    }

    var body: some View {
        Group {
            if isEmbedded {
                scannerContent
            } else {
                NavigationStack {
                    scannerContent
                }
            }
        }
    }

    private var scannerContent: some View {
        ZStack {
            // Camera View
            QRCameraView(
                isScanning: $viewModel.isScanning,
                onCodeScanned: { code in
                    Task {
                        await handleScan(code)
                    }
                }
            )
            .ignoresSafeArea()

            // Overlay
            VStack {
                // Top Bar
                topBar

                Spacer()

                // Scanning Frame
                scanningFrame

                Spacer()

                // Bottom Bar
                bottomBar
            }

            // Processing Indicator
            if viewModel.isProcessing {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()

                ProgressView()
                    .scaleEffect(2)
                    .tint(.white)
            }

            // Result Overlay
            if viewModel.showResult, let result = viewModel.lastScanResult {
                ScanResultView(result: result) {
                    viewModel.dismissResult()
                }
                .transition(.opacity.combined(with: .scale))
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    if let onBack = onBack {
                        onBack()
                    } else {
                        dismiss()
                    }
                } label: {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image(systemName: "chevron.left")
                            .fontWeight(.semibold)
                        Text("Back")
                    }
                    .foregroundStyle(.white)
                }
            }
        }
        .onAppear {
            viewModel.isScanning = true
        }
        .onDisappear {
            viewModel.isScanning = false
            if viewModel.torchEnabled {
                viewModel.toggleTorch()
            }
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Offline indicator
            if !networkMonitor.isConnected {
                offlineBadge
            }

            Spacer()

            // Pending sync count
            if SyncManager.shared.pendingScanCount > 0 {
                pendingSyncBadge
            }
        }
        .padding(DesignSystem.Spacing.lg)
        .background(
            LinearGradient(
                colors: [.black.opacity(0.6), .clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private var offlineBadge: some View {
        HStack(spacing: DesignSystem.Spacing.xs) {
            Image(systemName: "wifi.slash")
            Text("Offline")
        }
        .font(DesignSystem.Typography.caption)
        .fontWeight(.medium)
        .foregroundStyle(.white)
        .padding(.horizontal, DesignSystem.Spacing.md)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .glassEffect(.regular.tint(DesignSystem.Colors.warning.opacity(0.5)), in: .capsule)
    }

    private var pendingSyncBadge: some View {
        HStack(spacing: DesignSystem.Spacing.xs) {
            Image(systemName: "arrow.triangle.2.circlepath")
            Text("\(SyncManager.shared.pendingScanCount)")
        }
        .font(DesignSystem.Typography.caption)
        .fontWeight(.medium)
        .foregroundStyle(.white)
        .padding(.horizontal, DesignSystem.Spacing.md)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .glassEffect(.regular.tint(DesignSystem.Colors.chartBlue.opacity(0.5)), in: .capsule)
    }

    // MARK: - Scanning Frame

    private var scanningFrame: some View {
        ZStack {
            // Corner accents only (no border)
            ForEach(0..<4, id: \.self) { index in
                CornerAccent()
                    .rotationEffect(.degrees(Double(index) * 90))
            }
            .frame(width: 280, height: 280)

            // Scanning line animation
            if viewModel.isScanning && !viewModel.isProcessing {
                ScanningLine()
                    .frame(width: 260)
            }
        }
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            // Instructions
            instructionsView

            // Torch Button
            torchButton
        }
        .padding(.top, DesignSystem.Spacing.xl)
        .padding(.bottom, 100) // Extra space for floating tab bar
        .padding(.horizontal, DesignSystem.Spacing.lg)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [.clear, .black.opacity(0.7)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
    }

    private var instructionsView: some View {
        Text("Position QR code within the frame")
            .font(DesignSystem.Typography.subheadline)
            .foregroundStyle(.white)
            .padding(.horizontal, DesignSystem.Spacing.lg)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .glassEffect(.clear, in: .capsule)
    }

    private var torchButton: some View {
        Button {
            viewModel.toggleTorch()
        } label: {
            VStack(spacing: DesignSystem.Spacing.xs) {
                Image(systemName: viewModel.torchEnabled ? "flashlight.on.fill" : "flashlight.off.fill")
                    .font(.title2)
                    .contentTransition(.symbolEffect(.replace))
                Text("Light")
                    .font(DesignSystem.Typography.caption)
            }
            .foregroundStyle(.white)
            .frame(width: 70, height: 70)
            .glassEffect(.regular.interactive())
        }
    }

    // MARK: - Actions

    private func handleScan(_ code: String) async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await viewModel.handleScannedCode(code, businessId: businessId, token: token)
    }
}

// MARK: - Corner Accent

struct CornerAccent: View {
    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: 40))
            path.addLine(to: CGPoint(x: 0, y: 10))
            path.addQuadCurve(to: CGPoint(x: 10, y: 0), control: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 40, y: 0))
        }
        .stroke(DesignSystem.Colors.success, style: StrokeStyle(lineWidth: 4, lineCap: .round))
        .frame(width: 280, height: 280)
    }
}

// MARK: - Scanning Line

struct ScanningLine: View {
    @State private var offset: CGFloat = -120

    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    colors: [DesignSystem.Colors.success.opacity(0), DesignSystem.Colors.success, DesignSystem.Colors.success.opacity(0)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(height: 2)
            .offset(y: offset)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 2)
                    .repeatForever(autoreverses: true)
                ) {
                    offset = 120
                }
            }
    }
}

#Preview {
    ScannerView()
        .environmentObject(AuthViewModel())
        .environmentObject(NetworkMonitor())
}
