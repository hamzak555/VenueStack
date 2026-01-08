import SwiftUI
import AVFoundation

struct QRCameraView: UIViewControllerRepresentable {
    @Binding var isScanning: Bool
    let onCodeScanned: (String) -> Void

    func makeUIViewController(context: Context) -> QRCameraViewController {
        let controller = QRCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: QRCameraViewController, context: Context) {
        if isScanning {
            uiViewController.startScanning()
        } else {
            uiViewController.stopScanning()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onCodeScanned: onCodeScanned)
    }

    class Coordinator: NSObject, QRCameraViewControllerDelegate {
        let onCodeScanned: (String) -> Void

        init(onCodeScanned: @escaping (String) -> Void) {
            self.onCodeScanned = onCodeScanned
        }

        func didScanCode(_ code: String) {
            onCodeScanned(code)
        }
    }
}

protocol QRCameraViewControllerDelegate: AnyObject {
    func didScanCode(_ code: String)
}

class QRCameraViewController: UIViewController {
    weak var delegate: QRCameraViewControllerDelegate?

    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var isSessionRunning = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        setupCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopScanning()
    }

    private func setupCamera() {
        // Check authorization
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            setupCaptureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                if granted {
                    DispatchQueue.main.async {
                        self?.setupCaptureSession()
                    }
                }
            }
        case .denied, .restricted:
            showPermissionDeniedUI()
        @unknown default:
            break
        }
    }

    private func setupCaptureSession() {
        let session = AVCaptureSession()
        session.sessionPreset = .high

        guard let videoCaptureDevice = AVCaptureDevice.default(for: .video) else {
            showNoCameraUI()
            return
        }

        do {
            let videoInput = try AVCaptureDeviceInput(device: videoCaptureDevice)

            if session.canAddInput(videoInput) {
                session.addInput(videoInput)
            } else {
                return
            }

            let metadataOutput = AVCaptureMetadataOutput()

            if session.canAddOutput(metadataOutput) {
                session.addOutput(metadataOutput)

                metadataOutput.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
                metadataOutput.metadataObjectTypes = [.qr]
            } else {
                return
            }

            // Setup preview layer
            let previewLayer = AVCaptureVideoPreviewLayer(session: session)
            previewLayer.frame = view.bounds
            previewLayer.videoGravity = .resizeAspectFill
            view.layer.addSublayer(previewLayer)

            self.captureSession = session
            self.previewLayer = previewLayer

        } catch {
            print("Error setting up camera: \(error)")
        }
    }

    func startScanning() {
        guard let session = captureSession, !isSessionRunning else { return }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            session.startRunning()
            DispatchQueue.main.async {
                self?.isSessionRunning = true
            }
        }
    }

    func stopScanning() {
        guard let session = captureSession, isSessionRunning else { return }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            session.stopRunning()
            DispatchQueue.main.async {
                self?.isSessionRunning = false
            }
        }
    }

    private func showPermissionDeniedUI() {
        let label = UILabel()
        label.text = "Camera access is required to scan QR codes.\n\nPlease enable camera access in Settings."
        label.textColor = .white
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false

        let button = UIButton(type: .system)
        button.setTitle("Open Settings", for: .normal)
        button.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView(arrangedSubviews: [label, button])
        stack.axis = .vertical
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 40),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -40)
        ])
    }

    private func showNoCameraUI() {
        let label = UILabel()
        label.text = "No camera available on this device"
        label.textColor = .white
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(label)

        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    @objc private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - AVCaptureMetadataOutputObjectsDelegate

extension QRCameraViewController: AVCaptureMetadataOutputObjectsDelegate {
    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let metadataObject = metadataObjects.first,
              let readableObject = metadataObject as? AVMetadataMachineReadableCodeObject,
              let stringValue = readableObject.stringValue else {
            return
        }

        // Notify delegate
        delegate?.didScanCode(stringValue)
    }
}
