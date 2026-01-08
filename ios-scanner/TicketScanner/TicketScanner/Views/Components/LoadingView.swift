import SwiftUI

struct LoadingView: View {
    let message: String

    var body: some View {
        ZStack {
            DesignSystem.Colors.background
                .ignoresSafeArea()

            VStack(spacing: DesignSystem.Spacing.lg) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                    .scaleEffect(1.2)

                Text(message)
                    .font(DesignSystem.Typography.subheadline)
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
            }
        }
    }
}

struct FullScreenLoadingView: View {
    let message: String

    var body: some View {
        ZStack {
            DesignSystem.Colors.background
                .ignoresSafeArea()

            VStack(spacing: DesignSystem.Spacing.xl) {
                // App Icon placeholder
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 60))
                    .foregroundStyle(DesignSystem.Colors.primary)

                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                    .scaleEffect(1.2)

                Text(message)
                    .font(DesignSystem.Typography.subheadline)
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
            }
        }
    }
}

struct LoadingButton: View {
    let title: String
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.primaryForeground))
                        .scaleEffect(0.9)
                }
                Text(isLoading ? "Loading..." : title)
            }
        }
        .buttonStyle(PrimaryButtonStyle(isLoading: isLoading))
        .disabled(isLoading)
    }
}

#Preview {
    VStack {
        LoadingView(message: "Loading events...")
            .frame(height: 200)

        LoadingButton(title: "Sign In", isLoading: true) {}
            .padding()

        LoadingButton(title: "Sign In", isLoading: false) {}
            .padding()
    }
    .background(DesignSystem.Colors.background)
}
