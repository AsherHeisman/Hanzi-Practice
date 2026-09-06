import SwiftUI

struct PracticeSessionView: View {
    let session: StudySession
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dismiss) private var dismiss
    @State private var wordIndex = 0
    @State private var characterIndex = 0
    @State private var preview: Bool
    @State private var revision = UUID()
    @State private var characterComplete = false
    @State private var correct = 0
    @State private var completed = 0
    @State private var skipped = 0
    @State private var mistakes = 0
    @State private var wordMistakes = 0
    @State private var feedback = "Loading stroke data…"
    @State private var loadError = false
    @State private var result: PracticeScore?
    @State private var exporting = false

    init(session: StudySession) {
        self.session = session
        _preview = State(initialValue: session.guided)
    }
    private var word: Vocabulary { session.words[min(wordIndex, session.words.count - 1)] }
    private var characters: [String] {
        word.char.unicodeScalars.filter { $0.properties.isIdeographic }.map(String.init)
    }
    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    ScrollView {
                        VStack(spacing: 20) {
                            Text("Practice complete").font(.title.bold())
                            Text("\(result.percent)%").font(.system(size: 64, weight: .semibold, design: .rounded)).foregroundStyle(HanziTheme.green)
                            Text("\(result.points) / \(result.total * 100) points").font(.title3)
                            Text("\(result.correct) first try · \(result.completed - result.correct) with corrections · \(result.skipped) skipped")
                                .multilineTextAlignment(.center).foregroundStyle(.secondary)
                            Text("Saved in My progress.").foregroundStyle(.secondary)
                            Button("Done") { dismiss() }.buttonStyle(.borderedProminent).controlSize(.large)
                            Button { exporting = true } label: { Label("Export this session", systemImage: "square.and.arrow.up") }
                        }.padding(28)
                    }
                } else if !session.words.isEmpty && !characters.isEmpty {
                    ScrollView {
                        VStack(spacing: 14) {
                            SwiftUI.ProgressView(value: Double(wordIndex), total: Double(session.words.count))
                            Text("Word \(wordIndex + 1) of \(session.words.count)").font(.subheadline).foregroundStyle(.secondary)
                            if preview { Text(word.char).font(.largeTitle) }
                            Text(word.pinyin).font(.title2.weight(.medium))
                            Text(word.meaning).foregroundStyle(.secondary).multilineTextAlignment(.center)
                            Text("\(preview ? "Watch" : "Draw") character \(characterIndex + 1) of \(characters.count)")
                                .font(.subheadline).foregroundStyle(.secondary)
                            StrokePad(character: characters[characterIndex], preview: preview, revision: revision, onEvent: handleEvent)
                                .aspectRatio(1, contentMode: .fit)
                                .frame(maxWidth: 440)
                                .clipShape(RoundedRectangle(cornerRadius: 18))
                                .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.secondary.opacity(0.25)))
                                .accessibilityLabel(preview ? "Stroke animation for \(characters[characterIndex])" : "Character writing pad")
                            Text(feedback).font(.subheadline).foregroundStyle(loadError ? Color.red : Color.secondary)
                                .frame(minHeight: 24).multilineTextAlignment(.center).accessibilityAddTraits(.updatesFrequently)
                            if loadError {
                                Button("Retry loading") { restartPad() }.buttonStyle(.bordered)
                            }
                            HStack(spacing: 16) {
                                if preview {
                                    Button("Replay") { restartPad() }.buttonStyle(.bordered)
                                    Button(characterIndex + 1 < characters.count ? "Next character" : "Try writing") { advancePreview() }.buttonStyle(.borderedProminent)
                                } else if characterComplete {
                                    Button(characterIndex + 1 < characters.count ? "Next character" : wordIndex + 1 < session.words.count ? "Next word" : "See results") { advanceQuiz() }.buttonStyle(.borderedProminent)
                                } else {
                                    Button("Skip word") { skipped += 1; nextWord() }.buttonStyle(.bordered)
                                }
                            }.controlSize(.large)
                            Text("Orange strokes show the radical.").font(.caption).foregroundStyle(.secondary)
                        }.padding(.horizontal, 16).padding(.vertical, 18)
                    }
                } else {
                    ContentUnavailableView("No characters to practice", systemImage: "character.book.closed")
                }
            }
            .navigationTitle(session.mode).navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .fileExporter(isPresented: $exporting, document: ScoreDocument(records: result.map { [$0] } ?? []), contentType: .json, defaultFilename: "hanzi-session") { export in
                if case .failure(let error) = export { store.errorMessage = error.localizedDescription }
            }
        }.tint(HanziTheme.green).font(HanziTheme.font())
    }
    private func handleEvent(_ event: String, _ message: String?) {
        switch event {
        case "ready":
            loadError = false
            feedback = preview ? "Follow each stroke in order." : "Draw the first stroke."
        case "error":
            loadError = true
            feedback = message ?? "Stroke data could not load. Check your connection and tap Retry."
        case "mistake":
            guard !preview && !characterComplete else { return }
            mistakes += 1
            wordMistakes += 1
            feedback = "Try that stroke again."
        case "stroke":
            if !characterComplete { feedback = "Good stroke!" }
        case "complete":
            guard !preview && !characterComplete else { return }
            characterComplete = true
            if characterIndex + 1 == characters.count {
                completed += 1
                if wordMistakes == 0 { correct += 1 }
                feedback = wordMistakes == 0 ? "Word complete. +100 points" : "Completed with corrections. +50 points"
            } else { feedback = "Character complete. Keep going." }
        default: break
        }
    }
    private func restartPad() {
        revision = UUID()
        characterComplete = false
        loadError = false
        feedback = "Loading stroke data…"
    }
    private func advancePreview() {
        if characterIndex + 1 < characters.count { characterIndex += 1 }
        else { characterIndex = 0; preview = false }
        restartPad()
    }
    private func advanceQuiz() {
        if characterIndex + 1 < characters.count { characterIndex += 1; restartPad() }
        else { nextWord() }
    }
    private func nextWord() {
        if wordIndex + 1 == session.words.count {
            let score = PracticeScore(title: session.title, mode: session.mode, total: session.words.count, correct: correct, completed: completed, skipped: skipped, mistakes: mistakes)
            result = score
            store.save(score)
        } else {
            wordIndex += 1
            characterIndex = 0
            wordMistakes = 0
            preview = session.guided
            restartPad()
        }
    }
}
