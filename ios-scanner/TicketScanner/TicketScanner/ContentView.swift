import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @EnvironmentObject var networkMonitor: NetworkMonitor

    var body: some View {
        Group {
            if authViewModel.isLoading {
                LoadingView(message: "Loading...")
            } else if authViewModel.isAuthenticated {
                MainTabView()
            } else if authViewModel.pendingAffiliations != nil {
                BusinessSelectorView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut, value: authViewModel.isAuthenticated)
        .animation(.easeInOut, value: authViewModel.pendingAffiliations != nil)
        .overlay(alignment: .top) {
            if !networkMonitor.isConnected {
                OfflineBanner()
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct MainTabView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var selectedTab = 0
    @State private var eventsNavigationPath = NavigationPath()

    var body: some View {
        ZStack(alignment: .bottom) {
            // Content
            Group {
                switch selectedTab {
                case 0:
                    EventListView(navigationPath: $eventsNavigationPath)
                case 1:
                    ScannerView(onBack: { selectedTab = 0 })
                case 2:
                    SettingsView()
                default:
                    EventListView(navigationPath: $eventsNavigationPath)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Liquid Glass Pill Navigation
            LiquidGlassTabBar(selectedTab: $selectedTab, onTabTapped: { tab in
                // If tapping Events tab while already on Events, pop to root
                if tab == 0 && selectedTab == 0 {
                    eventsNavigationPath = NavigationPath()
                }
            })
        }
        .ignoresSafeArea(.keyboard)
    }
}

// MARK: - Liquid Glass Tab Bar (iOS 26+)

struct LiquidGlassTabBar: View {
    @Binding var selectedTab: Int
    var onTabTapped: ((Int) -> Void)? = nil

    @Namespace private var glassNamespace

    private let tabs: [(icon: String, label: String)] = [
        ("calendar", "Events"),
        ("qrcode.viewfinder", "Scan"),
        ("gearshape", "Settings")
    ]

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 0) {
                ForEach(0..<tabs.count, id: \.self) { index in
                    LiquidGlassTabButton(
                        icon: tabs[index].icon,
                        label: tabs[index].label,
                        isSelected: selectedTab == index,
                        namespace: glassNamespace
                    ) {
                        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                        impactFeedback.impactOccurred()

                        onTabTapped?(index)
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                            selectedTab = index
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .glassEffect(.regular.interactive(), in: .capsule)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }
}

struct LiquidGlassTabButton: View {
    let icon: String
    let label: String
    let isSelected: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: isSelected ? .semibold : .regular))
                .symbolRenderingMode(.hierarchical)
                .contentTransition(.symbolEffect(.replace))

            Text(label)
                .font(.system(size: 10, weight: isSelected ? .semibold : .regular, design: .rounded))
        }
        .foregroundStyle(isSelected ? .white : .white.opacity(0.5))
        .frame(width: 90, height: 50)
        .contentShape(Rectangle())
        .background {
            if isSelected {
                Capsule()
                    .fill(.white.opacity(0.12))
                    .matchedGeometryEffect(id: "selectedPill", in: namespace)
            }
        }
        .onTapGesture {
            action()
        }
    }
}

// MARK: - Legacy Floating Tab Bar (Fallback for iOS < 26)

struct FloatingTabBar: View {
    @Binding var selectedTab: Int
    var onTabTapped: ((Int) -> Void)? = nil

    private let tabs: [(icon: String, label: String)] = [
        ("calendar", "Events"),
        ("qrcode.viewfinder", "Scan"),
        ("gearshape", "Settings")
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<tabs.count, id: \.self) { index in
                TabBarButton(
                    icon: tabs[index].icon,
                    label: tabs[index].label,
                    isSelected: selectedTab == index
                ) {
                    onTabTapped?(index)
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        selectedTab = index
                    }
                }
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.sm)
        .padding(.vertical, DesignSystem.Spacing.xs)
        .background(
            Capsule()
                .fill(DesignSystem.Colors.card)
                .shadow(color: .black.opacity(0.25), radius: 12, x: 0, y: 6)
        )
        .overlay(
            Capsule()
                .stroke(DesignSystem.Colors.border, lineWidth: 1)
        )
        .padding(.horizontal, DesignSystem.Spacing.xxl)
        .padding(.bottom, DesignSystem.Spacing.md)
    }
}

struct TabBarButton: View {
    let icon: String
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: isSelected ? .semibold : .regular))
                    .symbolRenderingMode(.hierarchical)

                Text(label)
                    .font(.system(size: 9, weight: isSelected ? .semibold : .regular))
            }
            .foregroundStyle(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.mutedForeground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(
                Capsule()
                    .fill(isSelected ? DesignSystem.Colors.primary.opacity(0.15) : .clear)
                    .padding(.horizontal, 4)
            )
        }
        .buttonStyle(.plain)
    }
}

struct OfflineBanner: View {
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 12))
            Text("Offline Mode")
                .font(DesignSystem.Typography.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, DesignSystem.Spacing.lg)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .glassEffect(.regular.tint(DesignSystem.Colors.warning.opacity(0.6)), in: .capsule)
        .padding(.top, DesignSystem.Spacing.xs)
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 122, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthViewModel())
        .environmentObject(NetworkMonitor())
}
