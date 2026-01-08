import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    @State private var email: String = ""
    @State private var password: String = ""
    @State private var showPassword: Bool = false
    @FocusState private var focusedField: Field?

    enum Field {
        case email, password
    }

    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                DesignSystem.Colors.background
                    .ignoresSafeArea()

                ScrollView {
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

                        // Login Card
                        VStack(spacing: DesignSystem.Spacing.xl) {
                            // Header
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                                Text("Sign in")
                                    .font(DesignSystem.Typography.title2)
                                    .foregroundStyle(DesignSystem.Colors.foreground)

                                Text("Enter your credentials to access your account")
                                    .font(DesignSystem.Typography.subheadline)
                                    .foregroundStyle(DesignSystem.Colors.mutedForeground)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            // Form
                            VStack(spacing: DesignSystem.Spacing.lg) {
                                // Email Field
                                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                                    Text("Email")
                                        .font(DesignSystem.Typography.subheadline)
                                        .fontWeight(.medium)
                                        .foregroundStyle(DesignSystem.Colors.foreground)

                                    TextField("", text: $email, prompt: Text("Enter your email").foregroundStyle(DesignSystem.Colors.mutedForeground))
                                        .textContentType(.emailAddress)
                                        .keyboardType(.emailAddress)
                                        .autocapitalization(.none)
                                        .autocorrectionDisabled()
                                        .focused($focusedField, equals: .email)
                                        .font(DesignSystem.Typography.body)
                                        .foregroundStyle(DesignSystem.Colors.foreground)
                                        .tint(DesignSystem.Colors.foreground)
                                        .padding(.horizontal, DesignSystem.Spacing.md)
                                        .padding(.vertical, DesignSystem.Spacing.md)
                                        .background(DesignSystem.Colors.input)
                                        .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                                                .stroke(
                                                    focusedField == .email
                                                        ? DesignSystem.Colors.primary.opacity(0.5)
                                                        : DesignSystem.Colors.border,
                                                    lineWidth: 1
                                                )
                                        )
                                }

                                // Password Field
                                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                                    Text("Password")
                                        .font(DesignSystem.Typography.subheadline)
                                        .fontWeight(.medium)
                                        .foregroundStyle(DesignSystem.Colors.foreground)

                                    HStack(spacing: DesignSystem.Spacing.sm) {
                                        Group {
                                            if showPassword {
                                                TextField("", text: $password, prompt: Text("Enter your password").foregroundColor(DesignSystem.Colors.mutedForeground))
                                                    .textContentType(.password)
                                            } else {
                                                SecureField("", text: $password, prompt: Text("Enter your password").foregroundColor(DesignSystem.Colors.mutedForeground))
                                                    .textContentType(.password)
                                            }
                                        }
                                        .focused($focusedField, equals: .password)
                                        .font(DesignSystem.Typography.body)
                                        .foregroundStyle(DesignSystem.Colors.foreground)

                                        Button {
                                            showPassword.toggle()
                                        } label: {
                                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                                .font(.system(size: 16))
                                                .foregroundStyle(DesignSystem.Colors.mutedForeground)
                                        }
                                    }
                                    .padding(.horizontal, DesignSystem.Spacing.md)
                                    .padding(.vertical, DesignSystem.Spacing.md)
                                    .background(DesignSystem.Colors.input)
                                    .clipShape(RoundedRectangle(cornerRadius: DesignSystem.Radius.md))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: DesignSystem.Radius.md)
                                            .stroke(
                                                focusedField == .password
                                                    ? DesignSystem.Colors.primary.opacity(0.5)
                                                    : DesignSystem.Colors.border,
                                                lineWidth: 1
                                            )
                                    )
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

                                // Sign In Button
                                Button {
                                    Task {
                                        await authViewModel.login(email: email, password: password)
                                    }
                                } label: {
                                    HStack(spacing: DesignSystem.Spacing.sm) {
                                        if authViewModel.isLoading {
                                            ProgressView()
                                                .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.primaryForeground))
                                                .scaleEffect(0.9)
                                        }
                                        Text(authViewModel.isLoading ? "Signing in..." : "Sign in")
                                    }
                                }
                                .buttonStyle(PrimaryButtonStyle(isLoading: authViewModel.isLoading))
                                .disabled(!isFormValid || authViewModel.isLoading)
                                .opacity(isFormValid ? 1.0 : 0.5)
                            }
                        }
                        .padding(DesignSystem.Spacing.xl)
                        .cardStyle()
                        .padding(.horizontal, DesignSystem.Spacing.lg)

                        Spacer(minLength: 100)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .onSubmit {
                switch focusedField {
                case .email:
                    focusedField = .password
                case .password:
                    if isFormValid {
                        Task {
                            await authViewModel.login(email: email, password: password)
                        }
                    }
                case .none:
                    break
                }
            }
        }
    }

    private var isFormValid: Bool {
        !email.isEmpty && !password.isEmpty && email.contains("@")
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthViewModel())
}
