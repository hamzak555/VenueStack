import SwiftUI

// MARK: - Design System
// Matches the web app's OKLCH-based color system and modern aesthetic

struct DesignSystem {

    // MARK: - Colors (Dark Mode First - deeper blacks)
    struct Colors {
        // Background colors - deeper blacks
        static let background = Color(red: 0.02, green: 0.02, blue: 0.02) // Near pure black
        static let card = Color(red: 0.06, green: 0.06, blue: 0.06) // Very dark gray
        static let cardElevated = Color(red: 0.09, green: 0.09, blue: 0.09)

        // Foreground colors
        static let foreground = Color(red: 0.98, green: 0.98, blue: 0.98)
        static let mutedForeground = Color(red: 0.55, green: 0.55, blue: 0.55) // Slightly dimmer

        // Primary - Light neutral
        static let primary = Color(red: 0.85, green: 0.85, blue: 0.85)
        static let primaryForeground = Color(red: 0.02, green: 0.02, blue: 0.02)

        // Secondary - darker
        static let secondary = Color(red: 0.10, green: 0.10, blue: 0.10)
        static let secondaryForeground = Color(red: 0.98, green: 0.98, blue: 0.98)

        // Accent
        static let accent = Color(red: 0.10, green: 0.10, blue: 0.10)
        static let accentForeground = Color(red: 0.98, green: 0.98, blue: 0.98)

        // Muted
        static let muted = Color(red: 0.10, green: 0.10, blue: 0.10)

        // Border & Input - subtler
        static let border = Color.white.opacity(0.08)
        static let input = Color.white.opacity(0.10)

        // Status colors
        static let destructive = Color(red: 0.85, green: 0.35, blue: 0.30) // Red/orange
        static let success = Color(red: 0.34, green: 0.75, blue: 0.45) // Green
        static let warning = Color(red: 0.95, green: 0.70, blue: 0.25) // Orange

        // Chart/Accent colors (vibrant)
        static let chartBlue = Color(red: 0.35, green: 0.50, blue: 0.90)
        static let chartTeal = Color(red: 0.35, green: 0.75, blue: 0.70)
        static let chartYellow = Color(red: 0.85, green: 0.75, blue: 0.30)
        static let chartPurple = Color(red: 0.65, green: 0.40, blue: 0.85)
        static let chartRed = Color(red: 0.85, green: 0.40, blue: 0.35)
    }

    // MARK: - Typography
    struct Typography {
        static let largeTitle = Font.system(size: 34, weight: .bold, design: .default)
        static let title = Font.system(size: 28, weight: .bold, design: .default)
        static let title2 = Font.system(size: 22, weight: .bold, design: .default)
        static let title3 = Font.system(size: 20, weight: .semibold, design: .default)
        static let headline = Font.system(size: 17, weight: .semibold, design: .default)
        static let body = Font.system(size: 17, weight: .regular, design: .default)
        static let callout = Font.system(size: 16, weight: .regular, design: .default)
        static let subheadline = Font.system(size: 15, weight: .regular, design: .default)
        static let footnote = Font.system(size: 13, weight: .regular, design: .default)
        static let caption = Font.system(size: 12, weight: .regular, design: .default)
        static let caption2 = Font.system(size: 11, weight: .regular, design: .default)

        // Mono for ticket numbers, codes
        static let mono = Font.system(size: 14, weight: .medium, design: .monospaced)
        static let monoSmall = Font.system(size: 12, weight: .medium, design: .monospaced)
    }

    // MARK: - Spacing
    struct Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    // MARK: - Radius (matching web: base 10px)
    struct Radius {
        static let sm: CGFloat = 6
        static let md: CGFloat = 8
        static let lg: CGFloat = 10  // Base radius
        static let xl: CGFloat = 14
        static let full: CGFloat = 9999
    }

    // MARK: - Shadows
    struct Shadows {
        static let xs = Color.black.opacity(0.05)
        static let sm = Color.black.opacity(0.10)
        static let md = Color.black.opacity(0.15)
    }
}

// MARK: - View Extensions

extension View {
    // Card style matching web
    func cardStyle() -> some View {
        self
            .background(DesignSystem.Colors.card)
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.xl))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.xl)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
    }

    // Elevated card (for modals, overlays)
    func elevatedCardStyle() -> some View {
        self
            .background(DesignSystem.Colors.cardElevated)
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.xl))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.xl)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
            .shadow(color: DesignSystem.Shadows.md, radius: 20, x: 0, y: 10)
    }

    // Input field style
    func inputStyle() -> some View {
        self
            .padding(.horizontal, DesignSystem.Spacing.md)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.input)
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
    }
}

// MARK: - Button Styles

struct PrimaryButtonStyle: ButtonStyle {
    var isLoading: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DesignSystem.Typography.headline)
            .foregroundStyle(DesignSystem.Colors.primaryForeground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(
                configuration.isPressed
                    ? DesignSystem.Colors.primary.opacity(0.8)
                    : DesignSystem.Colors.primary
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
            .opacity(isLoading ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DesignSystem.Typography.headline)
            .foregroundStyle(DesignSystem.Colors.foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(
                configuration.isPressed
                    ? DesignSystem.Colors.secondary.opacity(0.7)
                    : DesignSystem.Colors.secondary
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct GhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DesignSystem.Typography.subheadline)
            .foregroundStyle(DesignSystem.Colors.mutedForeground)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .padding(.horizontal, DesignSystem.Spacing.md)
            .background(
                configuration.isPressed
                    ? DesignSystem.Colors.accent.opacity(0.5)
                    : Color.clear
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Status Badge

struct AppBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(DesignSystem.Typography.caption)
            .fontWeight(.medium)
            .padding(.horizontal, DesignSystem.Spacing.sm)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(color, lineWidth: 1)
            )
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(spacing: 24) {
            // Typography
            VStack(alignment: .leading, spacing: 8) {
                Text("Typography")
                    .font(DesignSystem.Typography.title2)
                Text("Headline text")
                    .font(DesignSystem.Typography.headline)
                Text("Body text for descriptions")
                    .font(DesignSystem.Typography.body)
                Text("TKT-ABC123-XYZ")
                    .font(DesignSystem.Typography.mono)
                Text("Caption text")
                    .font(DesignSystem.Typography.caption)
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .cardStyle()

            // Buttons
            VStack(spacing: 12) {
                Button("Primary Button") {}
                    .buttonStyle(PrimaryButtonStyle())

                Button("Secondary Button") {}
                    .buttonStyle(SecondaryButtonStyle())

                Button("Ghost Button") {}
                    .buttonStyle(GhostButtonStyle())
            }
            .padding()
            .cardStyle()

            // Badges
            HStack(spacing: 8) {
                AppBadge(text: "Valid", color: DesignSystem.Colors.chartBlue)
                AppBadge(text: "Used", color: DesignSystem.Colors.success)
                AppBadge(text: "Cancelled", color: DesignSystem.Colors.destructive)
            }
            .padding()
            .cardStyle()
        }
        .padding()
    }
    .background(DesignSystem.Colors.background)
}
