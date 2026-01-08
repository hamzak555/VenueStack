import SwiftUI

struct StatusBadge: View {
    let status: String
    let color: Color

    init(status: String, color: Color) {
        self.status = status
        self.color = color
    }

    init(status: String, colorName: String) {
        self.status = status
        switch colorName.lowercased() {
        case "green":
            self.color = DesignSystem.Colors.success
        case "yellow":
            self.color = DesignSystem.Colors.warning
        case "orange":
            self.color = .orange
        case "red":
            self.color = DesignSystem.Colors.destructive
        case "blue":
            self.color = DesignSystem.Colors.chartBlue
        default:
            self.color = DesignSystem.Colors.mutedForeground
        }
    }

    var body: some View {
        Text(status)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(color, lineWidth: 1)
            )
    }
}

struct LargeStatusBadge: View {
    let status: String
    let color: Color
    let icon: String?

    init(status: String, color: Color, icon: String? = nil) {
        self.status = status
        self.color = color
        self.icon = icon
    }

    var body: some View {
        HStack(spacing: 6) {
            if let icon = icon {
                Image(systemName: icon)
            }
            Text(status)
                .fontWeight(.semibold)
        }
        .font(.subheadline)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(color.opacity(0.15))
        .foregroundStyle(color)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(color, lineWidth: 1)
        )
    }
}

struct PulsatingBadge: View {
    let count: Int
    let color: Color

    @State private var isPulsing = false

    var body: some View {
        ZStack {
            if count > 0 {
                Circle()
                    .fill(color.opacity(0.3))
                    .frame(width: 28, height: 28)
                    .scaleEffect(isPulsing ? 1.2 : 1)
                    .opacity(isPulsing ? 0 : 1)
                    .animation(
                        .easeInOut(duration: 1)
                        .repeatForever(autoreverses: false),
                        value: isPulsing
                    )
            }

            Circle()
                .fill(color)
                .frame(width: 22, height: 22)
                .overlay {
                    Text("\(min(count, 99))")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                }
        }
        .onAppear {
            if count > 0 {
                isPulsing = true
            }
        }
        .onChange(of: count) { _, newValue in
            isPulsing = newValue > 0
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        HStack(spacing: 12) {
            StatusBadge(status: "Valid", color: .green)
            StatusBadge(status: "Used", color: .orange)
            StatusBadge(status: "Cancelled", color: .red)
            StatusBadge(status: "Draft", color: .gray)
        }

        HStack(spacing: 12) {
            LargeStatusBadge(status: "Published", color: .green, icon: "checkmark.circle")
            LargeStatusBadge(status: "Draft", color: .orange, icon: "pencil.circle")
        }

        HStack(spacing: 20) {
            PulsatingBadge(count: 5, color: .red)
            PulsatingBadge(count: 0, color: .red)
            PulsatingBadge(count: 99, color: .blue)
        }
    }
    .padding()
}
