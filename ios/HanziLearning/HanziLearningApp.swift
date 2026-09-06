import SwiftUI

@main
struct HanziLearningApp: App {
    @StateObject private var store = LearningStore()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(HanziTheme.green)
                .font(HanziTheme.font())
                .alert("Hanzi Learning", isPresented: Binding(
                    get: { store.errorMessage != nil },
                    set: { if !$0 { store.errorMessage = nil } }
                )) { Button("OK") { store.errorMessage = nil } }
                message: { Text(store.errorMessage ?? "") }
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack { LibraryView() }
                .tabItem { Label("Learn", systemImage: "books.vertical") }
            NavigationStack { QuizSetupView() }
                .tabItem { Label("Quiz", systemImage: "pencil.tip") }
            NavigationStack { ProgressViewScreen() }
                .tabItem { Label("Progress", systemImage: "chart.bar") }
            NavigationStack { AboutView() }
                .tabItem { Label("About", systemImage: "info.circle") }
        }
    }
}
