import SwiftUI

struct TicketRowView: View {
    let ticket: Ticket
    var onMarkAsUsed: ((Ticket) -> Void)? = nil

    var body: some View {
        HStack(spacing: 0) {
            // Status Indicator - vertical line on the left edge
            Rectangle()
                .fill(statusColor)
                .frame(width: 4)

            // Content
            VStack(spacing: DesignSystem.Spacing.xs) {
                // Row 1: Name & Status Badge
                HStack {
                    Text(ticket.customerName ?? "Unknown")
                        .font(DesignSystem.Typography.headline)
                        .foregroundStyle(DesignSystem.Colors.foreground)
                    Spacer()
                    AppBadge(text: statusText, color: statusColor)
                }

                // Row 2: Ticket Type (if exists)
                if let typeName = ticket.ticketTypeName {
                    HStack {
                        Text(typeName)
                            .font(DesignSystem.Typography.caption)
                            .foregroundStyle(DesignSystem.Colors.foreground)
                        Spacer()
                    }
                }

                // Row 3: Ticket ID & Date
                HStack {
                    Text(ticket.ticketNumber)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(DesignSystem.Colors.mutedForeground)
                        .lineLimit(1)
                    Spacer()
                    if let checkedInTime = ticket.formattedCheckedInTime {
                        Text(checkedInTime)
                            .font(DesignSystem.Typography.caption2)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    }
                }

                // Row 4: Email & Price
                HStack {
                    if let email = ticket.customerEmail {
                        Text(email)
                            .font(DesignSystem.Typography.caption)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    }
                    Spacer()
                    Text(ticket.formattedPrice)
                        .font(DesignSystem.Typography.caption)
                        .foregroundStyle(DesignSystem.Colors.mutedForeground)
                }
            }
            .padding(DesignSystem.Spacing.md)
        }
        .background(DesignSystem.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                .stroke(DesignSystem.Colors.border, lineWidth: 1)
        )
    }

    private var statusColor: Color {
        if ticket.isCheckedIn || ticket.safeStatus == .used {
            return DesignSystem.Colors.warning // Used = yellow
        }

        switch ticket.safeStatus {
        case .valid:
            return DesignSystem.Colors.success // Valid = green
        case .used:
            return DesignSystem.Colors.warning // Used = yellow
        case .cancelled, .invalid:
            return DesignSystem.Colors.destructive // Invalid/Cancelled = red
        }
    }

    private var statusText: String {
        if ticket.isCheckedIn || ticket.safeStatus == .used {
            return "Used"
        }
        return ticket.safeStatus.displayName
    }
}

#Preview {
    VStack(spacing: 12) {
        TicketRowView(ticket: Ticket(
            id: "1",
            eventId: "e1",
            orderId: "o1",
            ticketNumber: "TKT-ABC123-XYZ",
            qrCodeData: "TKT-ABC123-XYZ|e1|o1",
            ticketTypeId: nil,
            ticketTypeName: nil,
            price: 49.99,
            status: .valid,
            checkedInAt: nil,
            customerName: "John Doe",
            customerEmail: "john@example.com",
            customerPhone: nil,
            createdAt: nil,
            purchaseDate: nil,
            updatedAt: nil,
            event: nil
        ))

        TicketRowView(ticket: Ticket(
            id: "2",
            eventId: "e1",
            orderId: "o2",
            ticketNumber: "TKT-DEF456-UVW",
            qrCodeData: "TKT-DEF456-UVW|e1|o2",
            ticketTypeId: nil,
            ticketTypeName: nil,
            price: 49.99,
            status: .valid,
            checkedInAt: "2024-01-15T14:30:00Z",
            customerName: "Jane Smith",
            customerEmail: "jane@example.com",
            customerPhone: nil,
            createdAt: nil,
            purchaseDate: nil,
            updatedAt: nil,
            event: nil
        ))

        TicketRowView(ticket: Ticket(
            id: "3",
            eventId: "e1",
            orderId: "o3",
            ticketNumber: "TKT-GHI789-RST",
            qrCodeData: "TKT-GHI789-RST|e1|o3",
            ticketTypeId: nil,
            ticketTypeName: nil,
            price: 49.99,
            status: .cancelled,
            checkedInAt: nil,
            customerName: "Bob Wilson",
            customerEmail: "bob@example.com",
            customerPhone: nil,
            createdAt: nil,
            purchaseDate: nil,
            updatedAt: nil,
            event: nil
        ))
    }
    .padding()
    .background(DesignSystem.Colors.background)
}
