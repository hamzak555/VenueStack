import SwiftUI

struct EventRowView: View {
    let event: Event

    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            // Event Image
            if let imageUrl = event.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(DesignSystem.Colors.secondary)
                        .overlay {
                            Image(systemName: "photo")
                                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                        }
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
            } else {
                RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                    .fill(DesignSystem.Colors.secondary)
                    .frame(width: 64, height: 64)
                    .overlay {
                        Image(systemName: "calendar")
                            .font(.title3)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    }
            }

            // Event Info
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(event.title)
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                    .lineLimit(1)
                    .truncationMode(.tail)

                HStack(spacing: DesignSystem.Spacing.xs) {
                    Image(systemName: "calendar")
                        .font(.system(size: 12))
                    Text(event.formattedDate)
                        .font(DesignSystem.Typography.caption)
                }
                .foregroundStyle(DesignSystem.Colors.mutedForeground)

                if let time = event.formattedTime {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image(systemName: "clock")
                            .font(.system(size: 12))
                        Text(time)
                            .font(DesignSystem.Typography.caption)
                    }
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                }

                // Ticket Stats - showing checked in / total for scanner app
                HStack(spacing: DesignSystem.Spacing.md) {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 11))
                        Text("\(event.safeCheckedInCount)/\(event.safeTotalTickets)")
                            .font(DesignSystem.Typography.caption)
                    }
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)

                    // Progress indicator for check-ins
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(DesignSystem.Colors.secondary)
                                .frame(height: 4)

                            RoundedRectangle(cornerRadius: 2)
                                .fill(progressColor)
                                .frame(width: geometry.size.width * CGFloat(event.checkedInPercentage / 100), height: 4)
                        }
                    }
                    .frame(width: 50, height: 4)
                }
            }

            Spacer()

            // Status Badge
            AppBadge(text: event.safeStatus.displayName, color: statusColor)
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                .stroke(DesignSystem.Colors.border, lineWidth: 1)
        )
    }

    private var statusColor: Color {
        switch event.safeStatus {
        case .published:
            return DesignSystem.Colors.success
        case .draft:
            return DesignSystem.Colors.warning
        case .cancelled:
            return DesignSystem.Colors.destructive
        }
    }

    private var progressColor: Color {
        // Color based on check-in progress - green for good progress
        if event.checkedInPercentage >= 75 {
            return DesignSystem.Colors.success
        } else if event.checkedInPercentage >= 50 {
            return DesignSystem.Colors.chartBlue
        } else {
            return DesignSystem.Colors.warning
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        EventRowView(event: Event(
            id: "1",
            businessId: "b1",
            title: "Summer Music Festival 2024",
            description: "A great music festival",
            eventDate: "2024-07-15",
            eventTime: "18:00:00",
            location: "Central Park",
            locationLatitude: nil,
            locationLongitude: nil,
            imageUrl: nil,
            ticketPrice: 50,
            availableTickets: 150,
            totalTickets: 500,
            checkedInCount: 350,
            status: .published,
            createdAt: nil,
            updatedAt: nil
        ))
    }
    .padding()
    .background(DesignSystem.Colors.background)
}
