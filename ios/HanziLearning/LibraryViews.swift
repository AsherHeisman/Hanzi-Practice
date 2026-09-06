import SwiftUI

struct LibraryView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var query = ""
    @State private var session: StudySession?
    private var matches: [SearchWord] {
        store.searchWords.filter {
            "\($0.word.char) \($0.word.pinyin) \($0.word.meaning)".folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
                .contains(query.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current))
        }
    }
    var body: some View {
        List {
            if query.isEmpty {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("A character at a time.").font(.title2.bold())
                        Text("Explore a lesson, follow the strokes, and make it stick.").foregroundStyle(.secondary)
                    }.padding(.vertical, 10)
                }
                Section("Your textbooks") {
                    ForEach(store.books) { book in
                        NavigationLink {
                            BookView(book: book)
                        } label: {
                            HStack(spacing: 16) {
                                Text("中文").font(.title2).foregroundStyle(HanziTheme.green)
                                    .frame(width: 58, height: 72).background(HanziTheme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(book.title).font(.headline)
                                    Text("\(book.units.count) units · \(book.words.count) words").font(.subheadline).foregroundStyle(.secondary)
                                }
                            }.padding(.vertical, 6)
                        }
                    }
                }
            } else {
                Section("Vocabulary") {
                    ForEach(matches.prefix(100)) { match in
                        Button { session = StudySession(title: match.source, words: [match.word], guided: true) } label: {
                            WordRow(word: match.word)
                        }.buttonStyle(.plain)
                    }
                    if matches.isEmpty { Text("No matching vocabulary.").foregroundStyle(.secondary) }
                }
            }
        }
        .navigationTitle("Hanzi Learning")
        .searchable(text: $query, prompt: "Hanzi, pinyin, or meaning")
        .fullScreenCover(item: $session) { PracticeSessionView(session: $0) }
    }
}
struct BookView: View {
    let book: Book
    @State private var session: StudySession?
    var body: some View {
        List {
            ForEach(book.units) { unit in
                Section(unit.title) {
                    ForEach(unit.chapters) { chapter in
                        DisclosureGroup(chapter.title) {
                            ForEach(chapter.sections) { lesson in
                                NavigationLink {
                                    LessonView(lesson: lesson, bookTitle: book.title)
                                } label: {
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(lesson.title)
                                        Text("\(lesson.characters.count) words").font(.caption).foregroundStyle(.secondary)
                                    }.padding(.vertical, 4)
                                }
                            }
                        }
                    }
                }
            }
        }.navigationTitle(book.title).navigationBarTitleDisplayMode(.inline)
    }
}
struct WordRow: View {
    let word: Vocabulary
    var body: some View {
        HStack(spacing: 16) {
            Text(word.char).font(.title2).frame(minWidth: 54, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(word.pinyin).foregroundStyle(HanziTheme.green)
                Text(word.meaning).font(.subheadline).foregroundStyle(.secondary)
            }
        }.padding(.vertical, 5)
    }
}
struct LessonView: View {
    let lesson: Lesson
    let bookTitle: String
    @State private var session: StudySession?
    var body: some View {
        List {
            Section {
                Button { session = StudySession(title: "\(bookTitle) · \(lesson.title)", words: lesson.characters, guided: true) } label: {
                    Label("Learn the characters", systemImage: "play.circle")
                }.disabled(lesson.characters.isEmpty)
                Button { session = StudySession(title: "\(bookTitle) · \(lesson.title)", words: lesson.characters, guided: false) } label: {
                    Label("Test your recall", systemImage: "pencil.tip")
                }.disabled(lesson.characters.isEmpty)
            }
            Section("Vocabulary") {
                ForEach(Array(lesson.characters.enumerated()), id: \.offset) { _, word in
                    Button { session = StudySession(title: word.char, words: [word], guided: true) } label: { WordRow(word: word) }.buttonStyle(.plain)
                }
            }
        }
        .navigationTitle(lesson.title).navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $session) { PracticeSessionView(session: $0) }
    }
}
struct QuizSetupView: View {
    @EnvironmentObject private var store: LearningStore
    @State private var bookID = 0
    @State private var count = 10
    @State private var session: StudySession?
    private var pool: [Vocabulary] { store.books.filter { bookID == 0 || $0.id == bookID }.flatMap(\.words) }
    var body: some View {
        Form {
            Section {
                Picker("Textbook", selection: $bookID) {
                    Text("All textbooks").tag(0)
                    ForEach(store.books) { Text($0.title).tag($0.id) }
                }
                Stepper("\(count) words", value: $count, in: 5...100, step: 5)
                Text("\(pool.count) words available. Small pools repeat to fill a quiz.").foregroundStyle(.secondary).font(.subheadline)
            }
            Section {
                Button {
                    guard !pool.isEmpty else { return }
                    var words: [Vocabulary] = []
                    while words.count < count { words += pool.shuffled() }
                    session = StudySession(title: bookID == 0 ? "All textbooks" : "Go Far with Chinese \(bookID)", words: Array(words.prefix(count)), guided: false)
                } label: { Label("Start quiz", systemImage: "pencil.tip") }
                .disabled(pool.isEmpty)
            } footer: { Text("Write each stroke in order. Hints help you after a mistake. Radical strokes appear in orange.") }
        }.navigationTitle("Pop quiz")
            .fullScreenCover(item: $session) { PracticeSessionView(session: $0) }
    }
}
struct ProgressViewScreen: View {
    @EnvironmentObject private var store: LearningStore
    @State private var exporting = false
    @State private var clearing = false
    var body: some View {
        List {
            Section {
                LabeledContent("Completed sessions", value: "\(store.scores.count)")
                LabeledContent("Total points", value: "\(store.scores.reduce(0) { $0 + $1.points })")
            }
            Section("History") {
                if store.scores.isEmpty { Text("Complete a lesson or quiz to save your first score.").foregroundStyle(.secondary) }
                ForEach(store.scores.reversed()) { score in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(score.title).font(.headline)
                            Text(score.mode).font(.subheadline).foregroundStyle(.secondary)
                            Text(score.date, format: .dateTime.month().day().hour().minute()).font(.caption).foregroundStyle(.secondary)
                            Text("\(score.correct)/\(score.total) first try · \(score.skipped) skipped").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(score.percent)%").font(.title3.bold()).foregroundStyle(HanziTheme.green)
                    }.padding(.vertical, 6)
                }
            }
            Section {
                Button { exporting = true } label: { Label("Export scores", systemImage: "square.and.arrow.up") }.disabled(store.scores.isEmpty)
                Button("Clear history", role: .destructive) { clearing = true }.disabled(store.scores.isEmpty)
            } footer: { Text("The latest 200 sessions are saved on this iPhone. They are separate from your browser history.") }
        }.navigationTitle("My progress")
            .confirmationDialog("Clear all scores on this iPhone?", isPresented: $clearing, titleVisibility: .visible) {
                Button("Clear history", role: .destructive) { store.clearHistory() }
            }
            .fileExporter(isPresented: $exporting, document: ScoreDocument(records: store.scores), contentType: .json, defaultFilename: "hanzi-scores") { result in
                if case .failure(let error) = result { store.errorMessage = error.localizedDescription }
            }
    }
}
struct AboutView: View {
    var body: some View {
        List {
            Section {
                Text("Hanzi Learning").font(.title2.bold())
                Text("Produced by 康建宁 in association with 何锐颖")
            }
            Section("Practice anywhere") {
                Text("Textbooks, interface fonts, and the writing tool are bundled in the app. Character stroke data loads over HTTPS when needed.")
                Text("Radicals are orange. Other strokes use blue ink. The interface follows your device's light or dark appearance.")
            }
            Section("Your scores") {
                Text("100 points on the first try, 50 with corrections, and 0 if skipped. Only complete sessions are saved.")
                Text("Scores stay on this device. Export them from My progress to keep a copy.")
            }
            Section("Credits") {
                Text("Mozilla Text: SIL Open Font License. Hanzi Writer: MIT license. Native interface icons: SF Symbols.")
            }
        }.navigationTitle("About")
    }
}
