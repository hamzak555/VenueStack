import SwiftUI

struct EventDetailView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var ticketsViewModel = TicketsViewModel()
    @State private var showCopiedFeedback = false

    let event: Event

    // Base URL for public event pages (matches APIClient)
    private var baseURL: String {
        #if DEBUG
        return "http://10.88.111.10:3000"
        #else
        return "https://your-domain.com"
        #endif
    }

    private var publicEventURL: String? {
        guard let businessSlug = authViewModel.currentBusiness?.slug else { return nil }
        return "\(baseURL)/\(businessSlug)/events/\(event.id)"
    }

    var body: some View {
        ZStack {
            DesignSystem.Colors.background
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Event Header
                    eventHeader

                    // Statistics Card
                    statisticsCard

                    // Ticket Type Breakdown
                    if !ticketsViewModel.statisticsByTicketType.isEmpty {
                        ticketTypeBreakdown
                    }

                    // Tickets List
                    ticketsList
                }
                .padding(DesignSystem.Spacing.lg)
                .padding(.bottom, 100) // Extra padding for pill navigation
            }
        }
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(DesignSystem.Colors.background, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .tint(DesignSystem.Colors.foreground)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: DesignSystem.Spacing.lg) {
                    // Copy Link Button
                    Button {
                        copyEventLink()
                    } label: {
                        Image(systemName: showCopiedFeedback ? "checkmark" : "link")
                            .font(.system(size: 16))
                            .foregroundStyle(showCopiedFeedback ? DesignSystem.Colors.success : .white)
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .buttonStyle(.plain)
                    .disabled(publicEventURL == nil)

                    // Refresh Button
                    Button {
                        Task { await refreshTickets() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 16))
                            .foregroundStyle(.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(ticketsViewModel.isLoading)
                }
                .padding(.horizontal, DesignSystem.Spacing.md)
                .padding(.vertical, DesignSystem.Spacing.sm)
                .glassEffect(.regular, in: Capsule())
            }
        }
        .task {
            await loadTickets()
        }
    }

    // MARK: - Button Labels

    private var scanButtonLabel: some View {
        HStack {
            Image(systemName: "qrcode.viewfinder")
            Text("Scan")
        }
        .font(DesignSystem.Typography.subheadline)
        .fontWeight(.medium)
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignSystem.Spacing.md)
        .glassEffect(.regular.tint(DesignSystem.Colors.success.opacity(0.4)).interactive(), in: RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
    }

    private var viewAllButtonLabel: some View {
        HStack {
            Image(systemName: "list.bullet")
            Text("View All")
        }
        .font(DesignSystem.Typography.subheadline)
        .fontWeight(.medium)
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignSystem.Spacing.md)
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
    }

    // MARK: - Event Header

    private var eventHeader: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            // Image and Action Buttons Row
            HStack(spacing: DesignSystem.Spacing.md) {
                // Event Image - Square on the left
                if let imageUrl = event.imageUrl, let url = URL(string: imageUrl) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(DesignSystem.Colors.secondary)
                            .overlay {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                            }
                    }
                    .frame(width: 100, height: 100)
                    .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
                } else {
                    RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                        .fill(DesignSystem.Colors.secondary)
                        .frame(width: 100, height: 100)
                        .overlay {
                            Image(systemName: "calendar")
                                .font(.title2)
                                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                        }
                }

                // Action Buttons - Stacked on the right
                VStack(spacing: DesignSystem.Spacing.sm) {
                    NavigationLink {
                        ScannerView(preselectedEvent: event)
                    } label: {
                        scanButtonLabel
                    }

                    NavigationLink {
                        TicketListView(event: event)
                    } label: {
                        viewAllButtonLabel
                    }
                }
            }

            // Event Details - Date and Time only
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: "calendar")
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                Text(event.formattedDate)
                if let time = event.formattedTime {
                    Text("at \(time)")
                }
            }
            .font(DesignSystem.Typography.subheadline)
            .foregroundStyle(DesignSystem.Colors.mutedForeground)
        }
    }

    // MARK: - Statistics Card

    private var statisticsCard: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            HStack {
                Text("Check-in Statistics")
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                Spacer()
            }

            // Progress Ring
            HStack(spacing: DesignSystem.Spacing.xl) {
                ZStack {
                    Circle()
                        .stroke(DesignSystem.Colors.secondary, lineWidth: 12)

                    Circle()
                        .trim(from: 0, to: ticketsViewModel.statistics.checkedInPercentage / 100)
                        .stroke(DesignSystem.Colors.success, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))

                    VStack(spacing: DesignSystem.Spacing.xs) {
                        Text("\(Int(ticketsViewModel.statistics.checkedInPercentage))%")
                            .font(DesignSystem.Typography.title2)
                            .foregroundStyle(DesignSystem.Colors.foreground)
                        Text("Checked In")
                            .font(DesignSystem.Typography.caption)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    }
                }
                .frame(width: 100, height: 100)

                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    StatRow(label: "Total Tickets", value: "\(ticketsViewModel.statistics.total)", color: DesignSystem.Colors.chartBlue)
                    StatRow(label: "Checked In", value: "\(ticketsViewModel.statistics.checkedIn)", color: DesignSystem.Colors.success)
                    StatRow(label: "Remaining", value: "\(ticketsViewModel.statistics.valid)", color: DesignSystem.Colors.warning)
                    StatRow(label: "Cancelled", value: "\(ticketsViewModel.statistics.cancelled)", color: DesignSystem.Colors.destructive)
                }
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

    // MARK: - Ticket Type Breakdown

    private var ticketTypeBreakdown: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack {
                Text("Check-ins by Ticket Type")
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                Spacer()
            }

            VStack(spacing: DesignSystem.Spacing.sm) {
                ForEach(ticketsViewModel.statisticsByTicketType) { typeStat in
                    TicketTypeRow(stats: typeStat)
                }
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

    // MARK: - Tickets List Preview

    private var ticketsList: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            HStack {
                Text("Recent Check-ins")
                    .font(DesignSystem.Typography.headline)
                    .foregroundStyle(DesignSystem.Colors.foreground)
                Spacer()
                NavigationLink {
                    TicketListView(event: event)
                } label: {
                    Text("View All")
                        .font(DesignSystem.Typography.subheadline)
                        .foregroundStyle(DesignSystem.Colors.primary)
                }
            }

            if ticketsViewModel.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                    Spacer()
                }
                .padding(DesignSystem.Spacing.lg)
            } else if ticketsViewModel.tickets.isEmpty {
                Text("No tickets yet")
                    .font(DesignSystem.Typography.subheadline)
                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    .padding(DesignSystem.Spacing.lg)
            } else {
                let recentCheckins = ticketsViewModel.tickets
                    .filter { $0.isCheckedIn }
                    .prefix(5)

                if recentCheckins.isEmpty {
                    Text("No check-ins yet")
                        .font(DesignSystem.Typography.subheadline)
                        .foregroundStyle(DesignSystem.Colors.mutedForeground)
                        .padding(DesignSystem.Spacing.lg)
                } else {
                    VStack(spacing: DesignSystem.Spacing.md) {
                        ForEach(Array(recentCheckins), id: \.id) { ticket in
                            TicketRowView(ticket: ticket)
                        }
                    }
                }
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

    // MARK: - Actions

    private func loadTickets() async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await ticketsViewModel.loadTickets(eventId: event.id, businessId: businessId, token: token)
    }

    private func refreshTickets() async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await ticketsViewModel.refresh(eventId: event.id, businessId: businessId, token: token)
    }

    private func copyEventLink() {
        guard let url = publicEventURL else { return }

        UIPasteboard.general.string = url

        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()

        // Show checkmark feedback
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            showCopiedFeedback = true
        }

        // Reset after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                showCopiedFeedback = false
            }
        }
    }
}

struct StatRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(label)
                .font(DesignSystem.Typography.caption)
                .foregroundStyle(DesignSystem.Colors.mutedForeground)
            Spacer()
            Text(value)
                .font(DesignSystem.Typography.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(DesignSystem.Colors.foreground)
        }
    }
}

struct ActionButton: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: icon)
                .font(.title2)
            Text(title)
                .font(DesignSystem.Typography.caption)
        }
        .frame(maxWidth: .infinity)
        .padding(DesignSystem.Spacing.lg)
        .background(color.opacity(0.15))
        .foregroundStyle(color)
        .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: DesignSystem.Radius.lg)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }
}

struct TicketTypeRow: View {
    let stats: TicketTypeStatistics

    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xs) {
            HStack {
                Text(stats.typeName)
                    .font(DesignSystem.Typography.subheadline)
                    .foregroundStyle(DesignSystem.Colors.foreground)

                Spacer()

                Text("\(stats.checkedIn)/\(stats.total)")
                    .font(DesignSystem.Typography.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(DesignSystem.Colors.foreground)
            }

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(DesignSystem.Colors.secondary)
                        .frame(height: 4)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(DesignSystem.Colors.success)
                        .frame(width: geometry.size.width * (stats.checkedInPercentage / 100), height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(.vertical, DesignSystem.Spacing.xs)
    }
}

#Preview {
    NavigationStack {
        EventDetailView(event: Event(
            id: "1",
            businessId: "b1",
            title: "Summer Music Festival",
            description: nil,
            eventDate: "2024-07-15",
            eventTime: "18:00:00",
            location: "Central Park, NYC",
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
    .environmentObject(AuthViewModel())
}
