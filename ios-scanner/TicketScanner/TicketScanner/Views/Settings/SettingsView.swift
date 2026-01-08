import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @StateObject private var syncManager = SyncManager.shared

    @State private var showLogoutConfirmation = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                DesignSystem.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header with Title
                    HStack {
                        Text("ACCOUNT SETTINGS")
                            .font(DesignSystem.Typography.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                            .tracking(1.2)

                        Spacer()
                    }
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.top, DesignSystem.Spacing.md)
                    .padding(.bottom, DesignSystem.Spacing.sm)

                    ScrollView {
                        VStack(spacing: DesignSystem.Spacing.lg) {
                            // Account Row with Switch Business button
                            if let business = authViewModel.currentBusiness {
                                HStack(spacing: DesignSystem.Spacing.md) {
                                    // Business Logo or Initial
                                    if let logoUrl = business.logoUrl,
                                       let url = URL(string: logoUrl) {
                                        ZStack {
                                            RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                                                .fill(DesignSystem.Colors.card)

                                            AsyncImage(url: url) { phase in
                                                switch phase {
                                                case .success(let image):
                                                    image
                                                        .resizable()
                                                        .aspectRatio(contentMode: .fit)
                                                case .failure(_):
                                                    BusinessInitialView(
                                                        name: business.name,
                                                        color: business.safeThemeColor
                                                    )
                                                case .empty:
                                                    ProgressView()
                                                        .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.mutedForeground))
                                                        .scaleEffect(0.6)
                                                @unknown default:
                                                    BusinessInitialView(
                                                        name: business.name,
                                                        color: business.safeThemeColor
                                                    )
                                                }
                                            }
                                            .padding(8)
                                        }
                                        .frame(width: 48, height: 48)
                                        .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                                                .stroke(DesignSystem.Colors.border, lineWidth: 1)
                                        )
                                    } else {
                                        BusinessInitialView(
                                            name: business.name,
                                            color: business.safeThemeColor
                                        )
                                    }

                                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                                        Text(business.name)
                                            .font(DesignSystem.Typography.headline)
                                            .foregroundStyle(DesignSystem.Colors.foreground)

                                        if let user = authViewModel.currentUser {
                                            Text(user.email)
                                                .font(DesignSystem.Typography.caption)
                                                .foregroundStyle(DesignSystem.Colors.mutedForeground)

                                            Text(user.role.capitalized)
                                                .font(DesignSystem.Typography.caption2)
                                                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                                        }
                                    }

                                    Spacer()

                                    // Switch Business Button
                                    Button {
                                        Task {
                                            await authViewModel.switchBusiness()
                                        }
                                    } label: {
                                        Image(systemName: "arrow.left.arrow.right")
                                            .font(.system(size: 16))
                                            .foregroundStyle(.white)
                                            .frame(width: 36, height: 36)
                                            .glassEffect(.regular.interactive(), in: .circle)
                                    }
                                }
                                .padding(DesignSystem.Spacing.lg)
                                .background(DesignSystem.Colors.card)
                                .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
                                .overlay(
                                    RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                                )
                            }

                        // Sync Section
                        SettingsSection(title: "Sync", footer: "Offline scans are automatically synced when connection is restored.") {
                            // Connection Status
                            SettingsRow(
                                icon: networkMonitor.isConnected ? "wifi" : "wifi.slash",
                                title: "Connection",
                                value: networkMonitor.isConnected ? "Online" : "Offline",
                                valueColor: networkMonitor.isConnected ? DesignSystem.Colors.success : DesignSystem.Colors.warning
                            )
                            .padding(.bottom, DesignSystem.Spacing.md)

                            Divider()
                                .background(DesignSystem.Colors.border)

                            // Pending Syncs
                            SettingsRow(
                                icon: "arrow.triangle.2.circlepath",
                                title: "Pending Syncs",
                                value: "\(syncManager.pendingScanCount)",
                                valueColor: syncManager.pendingScanCount > 0 ? DesignSystem.Colors.warning : DesignSystem.Colors.mutedForeground
                            )
                            .padding(.vertical, DesignSystem.Spacing.md)

                            Divider()
                                .background(DesignSystem.Colors.border)

                            // Last Sync
                            SettingsRow(
                                icon: "clock",
                                title: "Last Sync",
                                value: syncManager.lastSyncTime?.formatted(date: .omitted, time: .shortened) ?? "Never",
                                valueColor: DesignSystem.Colors.mutedForeground
                            )
                            .padding(.vertical, DesignSystem.Spacing.md)

                            Divider()
                                .background(DesignSystem.Colors.border)

                            // Manual Sync Button
                            Button {
                                Task {
                                    await syncManager.syncPendingScans()
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "arrow.clockwise")
                                        .foregroundStyle(DesignSystem.Colors.chartBlue)
                                    Text("Sync Now")
                                        .font(DesignSystem.Typography.body)
                                        .foregroundStyle(DesignSystem.Colors.foreground)
                                    Spacer()
                                    if syncManager.isSyncing {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                                            .scaleEffect(0.8)
                                    }
                                }
                            }
                            .padding(.top, DesignSystem.Spacing.md)
                            .disabled(!networkMonitor.isConnected || syncManager.isSyncing || syncManager.pendingScanCount == 0)
                            .opacity((!networkMonitor.isConnected || syncManager.isSyncing || syncManager.pendingScanCount == 0) ? 0.5 : 1)
                        }

                        // About Section
                        SettingsSection(title: "About") {
                            SettingsRow(
                                icon: nil,
                                title: "Version",
                                value: "1.0.0",
                                valueColor: DesignSystem.Colors.mutedForeground
                            )
                            .padding(.bottom, DesignSystem.Spacing.md)

                            Divider()
                                .background(DesignSystem.Colors.border)

                            SettingsRow(
                                icon: nil,
                                title: "Build",
                                value: "1",
                                valueColor: DesignSystem.Colors.mutedForeground
                            )
                            .padding(.top, DesignSystem.Spacing.md)
                        }

                        // Sign Out Button
                        Button {
                            showLogoutConfirmation = true
                        } label: {
                            Text("Sign Out")
                                .font(DesignSystem.Typography.headline)
                                .foregroundStyle(DesignSystem.Colors.destructive)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, DesignSystem.Spacing.md)
                                .background(DesignSystem.Colors.destructive.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
                                .overlay(
                                    RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                                        .stroke(DesignSystem.Colors.destructive.opacity(0.3), lineWidth: 1)
                                )
                        }
                        .padding(.top, DesignSystem.Spacing.md)
                    }
                    .padding(DesignSystem.Spacing.lg)
                    }
                }
            }
            .navigationBarHidden(true)
            .confirmationDialog(
                "Sign Out",
                isPresented: $showLogoutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    authViewModel.logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                if syncManager.pendingScanCount > 0 {
                    Text("You have \(syncManager.pendingScanCount) pending scans that haven't been synced. Signing out will lose these scans.")
                } else {
                    Text("Are you sure you want to sign out?")
                }
            }
        }
    }
}

// MARK: - Settings Components

struct SettingsSection<Content: View>: View {
    let title: String
    var footer: String? = nil
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            Text(title.uppercased())
                .font(DesignSystem.Typography.caption)
                .fontWeight(.medium)
                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                .padding(.horizontal, DesignSystem.Spacing.xs)

            VStack(spacing: 0) {
                content
            }
            .padding(DesignSystem.Spacing.lg)
            .background(DesignSystem.Colors.card)
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )

            if let footer = footer {
                Text(footer)
                    .font(DesignSystem.Typography.caption)
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    .padding(.horizontal, DesignSystem.Spacing.xs)
            }
        }
    }
}

struct SettingsRow: View {
    let icon: String?
    let title: String
    let value: String
    let valueColor: Color

    var body: some View {
        HStack {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    .frame(width: 24)
            }

            Text(title)
                .font(DesignSystem.Typography.body)
                .foregroundStyle(DesignSystem.Colors.foreground)

            Spacer()

            Text(value)
                .font(DesignSystem.Typography.body)
                .foregroundStyle(valueColor)
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthViewModel())
        .environmentObject(NetworkMonitor())
}
