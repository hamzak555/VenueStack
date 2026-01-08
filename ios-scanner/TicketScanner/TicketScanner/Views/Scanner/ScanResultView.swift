import SwiftUI

struct ScanResultView: View {
    let result: ScanResult
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            // Dimmed background
            Color.black.opacity(0.7)
                .ignoresSafeArea()
                .onTapGesture {
                    onDismiss()
                }

            // Main content card with glass effect
            VStack(spacing: DesignSystem.Spacing.lg) {
                // Icon and Status
                HStack(spacing: DesignSystem.Spacing.md) {
                    iconView

                    VStack(alignment: .leading, spacing: 4) {
                        Text(result.type.title)
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text(result.message)
                            .font(DesignSystem.Typography.caption)
                            .foregroundStyle(.white.opacity(0.7))
                            .lineLimit(2)
                    }

                    Spacer()
                }

                // Ticket Details (if available)
                if let ticket = result.ticket {
                    ticketDetailsView(ticket)
                }

                // Dismiss Button
                Button {
                    onDismiss()
                } label: {
                    Text("Dismiss")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(DesignSystem.Spacing.lg)
            .background(
                RoundedRectangle(cornerRadius: 24)
                    .fill(statusColor.opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(statusColor.opacity(0.5), lineWidth: 1)
                    )
            )
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 24))
            .padding(.horizontal, DesignSystem.Spacing.lg)
        }
    }

    // MARK: - Icon View

    private var iconView: some View {
        Image(systemName: result.type.iconName)
            .font(.system(size: 28, weight: .medium))
            .foregroundStyle(.white)
            .frame(width: 56, height: 56)
            .glassEffect(.regular.tint(statusColor.opacity(0.6)), in: .circle)
            .symbolEffect(.bounce, value: result.id)
    }

    private var statusColor: Color {
        switch result.type {
        case .success:
            return DesignSystem.Colors.success
        case .alreadyCheckedIn:
            return DesignSystem.Colors.warning
        case .invalid, .wrongBusiness, .notFound:
            return DesignSystem.Colors.destructive
        case .offline:
            return DesignSystem.Colors.chartBlue
        case .error:
            return DesignSystem.Colors.mutedForeground
        }
    }

    // MARK: - Ticket Details

    @ViewBuilder
    private func ticketDetailsView(_ ticket: ValidatedTicket) -> some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            ticketDetailRow(icon: "person.fill", text: ticket.customerName, isHighlighted: true)
            ticketDetailRow(icon: "ticket", text: ticket.ticketNumber)
            if let checkedInTime = ticket.formattedCheckedInTime {
                ticketDetailRow(icon: "clock", text: checkedInTime)
            }
        }
        .padding(DesignSystem.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 12))
    }

    private func ticketDetailRow(icon: String, text: String, isHighlighted: Bool = false) -> some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.6))
                .frame(width: 20)
            Text(text)
                .font(isHighlighted ? .system(size: 15, weight: .semibold) : .system(size: 13))
                .foregroundStyle(.white.opacity(isHighlighted ? 1 : 0.8))
            Spacer()
        }
    }
}

#Preview("Success") {
    ScanResultView(
        result: ScanResult(
            type: .success,
            message: "Ticket validated successfully",
            ticket: ValidatedTicket(
                ticketNumber: "TKT-ABC123-XYZ",
                eventTitle: "Summer Music Festival",
                customerName: "John Doe",
                customerEmail: "john@example.com",
                price: 49.99,
                status: "used",
                checkedInAt: ISO8601DateFormatter().string(from: Date()),
                eventDate: "2024-07-15",
                eventTime: "18:00",
                location: "Central Park"
            )
        ),
        onDismiss: {}
    )
}

#Preview("Already Checked In") {
    ScanResultView(
        result: ScanResult(
            type: .alreadyCheckedIn,
            message: "This ticket was already scanned",
            ticket: ValidatedTicket(
                ticketNumber: "TKT-DEF456-UVW",
                eventTitle: "Summer Music Festival",
                customerName: "Jane Smith",
                customerEmail: "jane@example.com",
                price: 49.99,
                status: "used",
                checkedInAt: "2024-07-15T14:30:00Z",
                eventDate: "2024-07-15",
                eventTime: "18:00",
                location: "Central Park"
            )
        ),
        onDismiss: {}
    )
}

#Preview("Invalid") {
    ScanResultView(
        result: ScanResult(
            type: .invalid,
            message: "This ticket has been cancelled"
        ),
        onDismiss: {}
    )
}

#Preview("Offline") {
    ScanResultView(
        result: ScanResult(
            type: .offline,
            message: "Checked in offline. Will sync when online.",
            ticket: ValidatedTicket(
                ticketNumber: "TKT-GHI789-RST",
                eventTitle: "Summer Music Festival",
                customerName: "Bob Wilson",
                customerEmail: "bob@example.com",
                price: 49.99,
                status: "used",
                checkedInAt: ISO8601DateFormatter().string(from: Date()),
                eventDate: "2024-07-15",
                eventTime: "18:00",
                location: "Central Park"
            )
        ),
        onDismiss: {}
    )
}
