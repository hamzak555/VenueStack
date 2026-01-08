import SwiftUI

struct BusinessSelectorView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                DesignSystem.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Brand Header
                    VStack(spacing: DesignSystem.Spacing.lg) {
                        Text("Ticketing")
                            .font(DesignSystem.Typography.title2)
                            .foregroundStyle(DesignSystem.Colors.foreground)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, DesignSystem.Spacing.xl)
                    .padding(.top, DesignSystem.Spacing.xl)
                    .padding(.bottom, 60)

                    // Selection Card
                    VStack(spacing: DesignSystem.Spacing.xl) {
                        // Header
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            Text("Welcome back")
                                .font(DesignSystem.Typography.title2)
                                .foregroundStyle(DesignSystem.Colors.foreground)

                            Text("Select where you'd like to go")
                                .font(DesignSystem.Typography.subheadline)
                                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                        }
                        .frame(maxWidth: .infinity, alignment: .center)

                        // Business List
                        if let affiliations = authViewModel.pendingAffiliations {
                            VStack(spacing: DesignSystem.Spacing.md) {
                                ForEach(affiliations) { affiliation in
                                    BusinessCard(affiliation: affiliation) {
                                        Task {
                                            await authViewModel.selectBusiness(affiliation)
                                        }
                                    }
                                    .disabled(authViewModel.isLoading)
                                }
                            }
                        }

                        // Error Message
                        if let error = authViewModel.error {
                            HStack(spacing: DesignSystem.Spacing.sm) {
                                Image(systemName: "exclamationmark.circle.fill")
                                Text(error)
                                    .font(DesignSystem.Typography.subheadline)
                            }
                            .foregroundStyle(DesignSystem.Colors.destructive)
                            .padding(DesignSystem.Spacing.md)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(DesignSystem.Colors.destructive.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
                            .overlay(
                                RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                                    .stroke(DesignSystem.Colors.destructive.opacity(0.3), lineWidth: 1)
                            )
                        }

                        // Loading indicator
                        if authViewModel.isLoading {
                            HStack(spacing: DesignSystem.Spacing.sm) {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                                    .scaleEffect(0.8)
                                Text("Signing in...")
                                    .font(DesignSystem.Typography.subheadline)
                                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                            }
                        }

                        // Cancel Button
                        Button {
                            authViewModel.cancelBusinessSelection()
                        } label: {
                            Text("Sign in with a different account")
                        }
                        .buttonStyle(GhostButtonStyle())
                    }
                    .padding(DesignSystem.Spacing.xl)
                    .cardStyle()
                    .padding(.horizontal, DesignSystem.Spacing.lg)

                    Spacer()
                }
            }
        }
    }
}

struct BusinessCard: View {
    let affiliation: BusinessAffiliation
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: DesignSystem.Spacing.lg) {
                // Business Logo/Initial
                if let logoUrl = affiliation.businessLogo,
                   let url = URL(string: logoUrl) {
                    ZStack {
                        RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                            .fill(DesignSystem.Colors.card)

                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        } placeholder: {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.mutedForeground))
                                .scaleEffect(0.6)
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
                    BusinessInitialView(name: affiliation.safeBusinessName, color: affiliation.safeThemeColor)
                }

                // Business Info
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(affiliation.safeBusinessName)
                        .font(DesignSystem.Typography.headline)
                        .foregroundStyle(DesignSystem.Colors.foreground)

                    Text("\(affiliation.safeRole.capitalized) access")
                        .font(DesignSystem.Typography.caption)
                        .foregroundStyle(DesignSystem.Colors.mutedForeground)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
            }
            .padding(DesignSystem.Spacing.lg)
            .background(DesignSystem.Colors.secondary)
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct BusinessInitialView: View {
    let name: String
    let color: String

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                .fill(Color(hex: color).opacity(0.15))

            Text(String(name.prefix(2)).uppercased())
                .font(DesignSystem.Typography.headline)
                .fontWeight(.bold)
                .foregroundStyle(Color(hex: color))
        }
        .frame(width: 48, height: 48)
    }
}

#Preview {
    BusinessSelectorView()
        .environmentObject({
            let vm = AuthViewModel()
            vm.pendingAffiliations = [
                BusinessAffiliation(
                    id: "1",
                    type: "business",
                    businessId: "b1",
                    businessName: "Cool Events Co",
                    businessSlug: "cool-events",
                    businessLogo: nil,
                    themeColor: "#007AFF",
                    role: "admin",
                    email: "test@test.com",
                    name: "Test User"
                ),
                BusinessAffiliation(
                    id: "2",
                    type: "business",
                    businessId: "b2",
                    businessName: "Party Planners",
                    businessSlug: "party-planners",
                    businessLogo: nil,
                    themeColor: "#FF3B30",
                    role: "regular",
                    email: "test@test.com",
                    name: "Test User"
                )
            ]
            return vm
        }())
}
