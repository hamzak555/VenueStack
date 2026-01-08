import SwiftUI

struct EventListView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = EventsViewModel()
    @Binding var navigationPath: NavigationPath

    @State private var searchText = ""
    @State private var selectedSort: EventSortOption = .dateAsc
    @State private var showSortOptions = false

    init(navigationPath: Binding<NavigationPath>) {
        self._navigationPath = navigationPath
    }

    enum EventSortOption: String, CaseIterable {
        case dateAsc = "Date (Earliest)"
        case dateDesc = "Date (Latest)"
        case nameAsc = "Name (A-Z)"
        case nameDesc = "Name (Z-A)"

        var icon: String {
            switch self {
            case .dateAsc: return "calendar.badge.clock"
            case .dateDesc: return "calendar"
            case .nameAsc: return "textformat.abc"
            case .nameDesc: return "textformat.abc"
            }
        }
    }

    private var filteredAndSortedEvents: [Event] {
        var events = viewModel.upcomingEvents

        // Filter by search text
        if !searchText.isEmpty {
            events = events.filter { event in
                event.title.localizedCaseInsensitiveContains(searchText) ||
                (event.location?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        // Sort
        switch selectedSort {
        case .dateAsc:
            events.sort { $0.eventDate < $1.eventDate }
        case .dateDesc:
            events.sort { $0.eventDate > $1.eventDate }
        case .nameAsc:
            events.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case .nameDesc:
            events.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedDescending }
        }

        return events
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ZStack {
                // Background
                DesignSystem.Colors.background
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header with Title
                    HStack {
                        Text("UPCOMING EVENTS")
                            .font(DesignSystem.Typography.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(DesignSystem.Colors.mutedForeground)
                            .tracking(1.2)

                        Spacer()
                    }
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.top, DesignSystem.Spacing.md)
                    .padding(.bottom, DesignSystem.Spacing.sm)

                    // Search Bar and Sort in one row
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        // Search Bar
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 14))
                                .foregroundStyle(.white.opacity(0.6))

                            TextField("Search...", text: $searchText)
                                .font(DesignSystem.Typography.subheadline)
                                .foregroundStyle(.white)

                            if !searchText.isEmpty {
                                Button {
                                    searchText = ""
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
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.bottom, DesignSystem.Spacing.sm)

                    // Content
                    if viewModel.isLoading && viewModel.events.isEmpty {
                        Spacer()
                        VStack(spacing: DesignSystem.Spacing.md) {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.foreground))
                            Text("Loading events...")
                                .font(DesignSystem.Typography.subheadline)
                                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                        }
                        Spacer()
                    } else if let error = viewModel.error, viewModel.events.isEmpty {
                        Spacer()
                        ErrorView(message: error) {
                            await refreshEvents()
                        }
                        Spacer()
                    } else if filteredAndSortedEvents.isEmpty {
                        Spacer()
                        if !searchText.isEmpty {
                            EmptyStateView(
                                icon: "magnifyingglass",
                                title: "No Results",
                                message: "No events match '\(searchText)'"
                            )
                        } else {
                            EmptyStateView(
                                icon: "calendar.badge.exclamationmark",
                                title: "No Upcoming Events",
                                message: "No upcoming events scheduled"
                            )
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: DesignSystem.Spacing.md) {
                                ForEach(filteredAndSortedEvents) { event in
                                    NavigationLink(value: event) {
                                        EventRowView(event: event)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, DesignSystem.Spacing.lg)
                            .padding(.top, DesignSystem.Spacing.md)
                            .padding(.bottom, 100) // Extra space for floating tab bar
                        }
                        .refreshable {
                            await refreshEvents()
                        }
                    }
                }
            }
            .navigationBarHidden(true)
            .navigationDestination(for: Event.self) { event in
                EventDetailView(event: event)
            }
            .task {
                await loadEvents()
            }
            .confirmationDialog("Sort By", isPresented: $showSortOptions, titleVisibility: .visible) {
                ForEach(EventSortOption.allCases, id: \.self) { option in
                    Button(option.rawValue) {
                        selectedSort = option
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .tint(DesignSystem.Colors.foreground)
    }

    private func loadEvents() async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await viewModel.loadEvents(businessId: businessId, token: token)
    }

    private func refreshEvents() async {
        guard let businessId = authViewModel.currentBusinessId,
              let token = authViewModel.currentToken else { return }

        await viewModel.refresh(businessId: businessId, token: token)
    }
}

struct ErrorView: View {
    let message: String
    let retryAction: () async -> Void

    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundStyle(DesignSystem.Colors.warning)

            Text("Error")
                .font(DesignSystem.Typography.title3)
                .foregroundStyle(DesignSystem.Colors.foreground)

            Text(message)
                .font(DesignSystem.Typography.subheadline)
                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                .multilineTextAlignment(.center)
                .padding(.horizontal, DesignSystem.Spacing.xl)

            Button {
                Task { await retryAction() }
            } label: {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    Image(systemName: "arrow.clockwise")
                    Text("Try Again")
                }
            }
            .buttonStyle(SecondaryButtonStyle())
            .frame(width: 150)
        }
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 50))
                .foregroundStyle(DesignSystem.Colors.mutedForeground)

            Text(title)
                .font(DesignSystem.Typography.title3)
                .foregroundStyle(DesignSystem.Colors.foreground)

            Text(message)
                .font(DesignSystem.Typography.subheadline)
                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                .multilineTextAlignment(.center)
        }
        .padding(DesignSystem.Spacing.xl)
    }
}

#Preview {
    EventListView(navigationPath: .constant(NavigationPath()))
        .environmentObject(AuthViewModel())
}
