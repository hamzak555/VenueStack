import SwiftUI

struct TicketListView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = TicketsViewModel()
    @State private var showSortOptions = false
    @State private var ticketToCheckIn: Ticket? = nil
    @State private var showCheckInConfirmation = false

    let event: Event

    var body: some View {
        ZStack {
            // Background
            DesignSystem.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Search and Filter
                VStack(spacing: DesignSystem.Spacing.md) {
                    // Search Bar and Sort
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        // Search Bar
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 14))
                                .foregroundStyle(.white.opacity(0.6))

                            TextField("Search...", text: $viewModel.searchText)
                                .autocorrectionDisabled()
                                .font(DesignSystem.Typography.subheadline)
                                .foregroundStyle(.white)

                            if !viewModel.searchText.isEmpty {
                                Button {
                                    viewModel.searchText = ""
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.system(size: 14))
                                        .foregroundStyle(.white.opacity(0.6))
                                }
                            }
                        }
                        .padding(.horizontal, DesignSystem.Spacing.md)
                        .padding(.vertical, DesignSystem.Spacing.sm)
                        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: DesignSystem.Radius.md))

                        // Sort Button
                        Button {
                            showSortOptions = true
                        } label: {
                            Image(systemName: "arrow.up.arrow.down")
                                .font(.system(size: 14))
                                .foregroundStyle(.white)
                                .frame(width: 36, height: 36)
                                .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
                        }
                    }

                    // Filter Picker with counts - 2x2 grid
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        // Row 1: All, Valid
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            filterButton(for: .all)
                            filterButton(for: .valid)
                        }
                        // Row 2: Checked In, Cancelled
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            filterButton(for: .checkedIn)
                            filterButton(for: .cancelled)
                        }
                    }
                }
                .padding(DesignSystem.Spacing.lg)

                // Content
                if viewModel.isLoading && viewModel.tickets.isEmpty {
                    Spacer()
                    VStack(spacing: DesignSystem.Spacing.md) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                        Text("Loading tickets...")
                            .font(DesignSystem.Typography.subheadline)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                    }
                    Spacer()
                } else if let error = viewModel.error, viewModel.tickets.isEmpty {
                    Spacer()
                    ErrorView(message: error) {
                        await refreshTickets()
                    }
                    Spacer()
                } else if viewModel.filteredTickets.isEmpty {
                    EmptyStateView(
                        icon: "ticket",
                        title: "No Tickets Found",
                        message: viewModel.searchText.isEmpty
                            ? "No tickets match the selected filter"
                            : "No tickets match '\(viewModel.searchText)'"
                    )
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.top, 120)
                } else {
                    List {
                        ForEach(viewModel.filteredTickets) { ticket in
                            TicketRowView(ticket: ticket)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(
                                    top: DesignSystem.Spacing.xs,
                                    leading: DesignSystem.Spacing.lg,
                                    bottom: DesignSystem.Spacing.xs,
                                    trailing: DesignSystem.Spacing.lg
                                ))
                                .listRowSeparator(.hidden)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    if !ticket.isCheckedIn && ticket.safeStatus == .valid {
                                        Button {
                                            ticketToCheckIn = ticket
                                            showCheckInConfirmation = true
                                        } label: {
                                            Image(systemName: "checkmark")
                                                .font(.system(size: 16, weight: .bold))
                                        }
                                        .tint(DesignSystem.Colors.success)
                                    }
                                }
                                .contextMenu {
                                    if !ticket.isCheckedIn && ticket.safeStatus == .valid {
                                        Button {
                                            ticketToCheckIn = ticket
                                            showCheckInConfirmation = true
                                        } label: {
                                            Label("Mark as Used", systemImage: "checkmark.circle")
                                        }
                                    }
                                }
                        }

                        // Bottom padding for pill navigation
                        Color.clear
                            .frame(height: 80)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .refreshable {
                        await refreshTickets()
                    }
                }
            }
        }
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(DesignSystem.Colors.background, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .tint(DesignSystem.Colors.foreground)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await refreshTickets() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundStyle(DesignSystem.Colors.foreground)
                }
                .disabled(viewModel.isLoading)
            }
        }
        .task {
            await loadTickets()
        }
        .confirmationDialog("Sort By", isPresented: $showSortOptions, titleVisibility: .visible) {
            ForEach(TicketsViewModel.TicketSortOption.allCases, id: \.self) { option in
                Button(option.rawValue) {
                    withAnimation {
                        viewModel.selectedSort = option
                    }
                }
            }
        }
        .alert("Mark Ticket as Used?", isPresented: $showCheckInConfirmation) {
            Button("Cancel", role: .cancel) {
                ticketToCheckIn = nil
            }
            Button("Mark as Used") {
                if let ticket = ticketToCheckIn {
                    Task {
                        await checkInTicket(ticket)
                        ticketToCheckIn = nil
                    }
                }
            }
        } message: {
            if let ticket = ticketToCheckIn {
                Text("This will check in the ticket for \(ticket.customerName ?? "Unknown") (\(ticket.ticketNumber)).")
            }
        }
    }

    private func loadTickets() async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await viewModel.loadTickets(eventId: event.id, businessId: businessId, token: token)
    }

    private func refreshTickets() async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await viewModel.refresh(eventId: event.id, businessId: businessId, token: token)
    }

    private func checkInTicket(_ ticket: Ticket) async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        let result = await viewModel.manualCheckIn(ticket: ticket, businessId: businessId, token: token)

        // Show feedback
        let generator = UINotificationFeedbackGenerator()
        if result.type == .success {
            generator.notificationOccurred(.success)
        } else {
            generator.notificationOccurred(.warning)
        }
    }

    private func countForFilter(_ filter: TicketsViewModel.TicketFilter) -> Int {
        switch filter {
        case .all:
            return viewModel.statistics.total
        case .valid:
            return viewModel.statistics.valid
        case .checkedIn:
            return viewModel.statistics.checkedIn
        case .cancelled:
            return viewModel.statistics.cancelled
        }
    }

    @ViewBuilder
    private func filterButton(for filter: TicketsViewModel.TicketFilter) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                viewModel.selectedFilter = filter
            }
        } label: {
            Text("\(filter.rawValue) (\(countForFilter(filter)))")
                .font(DesignSystem.Typography.caption)
                .fontWeight(viewModel.selectedFilter == filter ? .semibold : .regular)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(
                    viewModel.selectedFilter == filter
                        ? DesignSystem.Colors.primary
                        : DesignSystem.Colors.secondary
                )
                .foregroundStyle(
                    viewModel.selectedFilter == filter
                        ? DesignSystem.Colors.primaryForeground
                        : DesignSystem.Colors.mutedForeground
                )
                .clipShape(Capsule())
        }
    }
}

#Preview {
    NavigationStack {
        TicketListView(event: Event(
            id: "1",
            businessId: "b1",
            title: "Summer Festival",
            description: nil,
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
    .environmentObject(AuthViewModel())
}
