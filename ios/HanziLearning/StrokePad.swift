import SwiftUI
import WebKit

struct StrokePad: UIViewRepresentable {
    let character: String
    let preview: Bool
    let revision: UUID
    let onEvent: (String, String?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "practice")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        if let url = Bundle.main.url(forResource: "stroke-pad", withExtension: "html", subdirectory: "LearningResources") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }
    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.configure(webView)
    }
    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "practice")
        webView.navigationDelegate = nil
        webView.stopLoading()
    }
    @MainActor final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: StrokePad
        var ready = false
        var appliedRevision: UUID?
        init(parent: StrokePad) { self.parent = parent }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            ready = true
            configure(webView)
        }
        func configure(_ webView: WKWebView) {
            guard ready, appliedRevision != parent.revision else { return }
            let configuration: [String: Any] = ["character": parent.character, "preview": parent.preview, "revision": parent.revision.uuidString]
            guard let data = try? JSONSerialization.data(withJSONObject: configuration), let json = String(data: data, encoding: .utf8) else { return }
            appliedRevision = parent.revision
            webView.evaluateJavaScript("startPractice(\(json))") { [weak self] _, error in
                if error != nil { self?.parent.onEvent("error", "The writing tool could not start. Tap Retry.") }
            }
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame,
                  let body = message.body as? [String: Any],
                  body["revision"] as? String == parent.revision.uuidString,
                  let event = body["event"] as? String else { return }
            parent.onEvent(event, body["message"] as? String)
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
        }
    }
}
