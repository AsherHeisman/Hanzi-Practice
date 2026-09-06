import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct Vocabulary: Codable, Hashable {
    let char: String
    let pinyin: String
    let meaning: String
}
struct Lesson: Codable, Identifiable {
    let id: String
    let title: String
    let characters: [Vocabulary]
}
struct Chapter: Codable, Identifiable {
    let id: String
    let title: String
    let sections: [Lesson]
}
struct BookUnit: Codable, Identifiable {
    let id: String
    let title: String
    let chapters: [Chapter]
}
struct Textbook: Codable {
    let units: [BookUnit]
}
struct Book: Identifiable {
    let id: Int
    let units: [BookUnit]
    var title: String { "Go Far with Chinese \(id)" }
    var words: [Vocabulary] { units.flatMap(\.chapters).flatMap(\.sections).flatMap(\.characters) }
    var chapterCount: Int { units.reduce(0) { $0 + $1.chapters.count } }
}
struct SearchWord: Identifiable {
    let id: String
    let word: Vocabulary
    let source: String
}
struct StudySession: Identifiable {
    let id = UUID()
    let title: String
    let words: [Vocabulary]
    let guided: Bool
    var mode: String { guided ? "Guided learning" : "Recall quiz" }
}
struct PracticeScore: Codable, Identifiable {
    var id = UUID()
    var date = Date()
    let title: String
    let mode: String
    let total: Int
    let correct: Int
    let completed: Int
    let skipped: Int
    let mistakes: Int
    var points: Int { correct * 100 + (completed - correct) * 50 }
    var percent: Int { total > 0 ? Int((Double(points) / Double(total)).rounded()) : 0 }
}

@MainActor final class LearningStore: ObservableObject {
    @Published var books: [Book] = []
    @Published var scores: [PracticeScore] = []
    @Published var errorMessage: String?
    private let scoreURL: URL
    private var historyReadable = true

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        scoreURL = support.appendingPathComponent("hanzi-scores.json")
        do {
            for id in 1...2 {
                guard let url = Bundle.main.url(forResource: "data-textbook\(id)", withExtension: "json", subdirectory: "LearningResources") else {
                    throw CocoaError(.fileNoSuchFile)
                }
                let book = try JSONDecoder().decode(Textbook.self, from: Data(contentsOf: url))
                books.append(Book(id: id, units: book.units))
            }
        } catch { errorMessage = "Could not load the bundled textbooks: \(error.localizedDescription)" }
        if FileManager.default.fileExists(atPath: scoreURL.path) {
            do { scores = try JSONDecoder().decode([PracticeScore].self, from: Data(contentsOf: scoreURL)) }
            catch {
                historyReadable = false
                errorMessage = "Saved history could not be read. New results will remain available this session, but won't replace that file."
            }
        }
    }
    var searchWords: [SearchWord] {
        books.flatMap { book in
            book.units.flatMap { unit in
                unit.chapters.flatMap { chapter in
                    chapter.sections.flatMap { lesson in
                        lesson.characters.enumerated().map { index, word in
                            SearchWord(id: "\(book.id)-\(lesson.id)-\(index)", word: word, source: "\(book.title) · \(lesson.title)")
                        }
                    }
                }
            }
        }
    }
    func save(_ score: PracticeScore) {
        guard !scores.contains(where: { $0.id == score.id }) else { return }
        scores.append(score)
        scores = Array(scores.suffix(200))
        guard historyReadable else { return }
        persist()
    }
    func clearHistory() {
        scores = []
        historyReadable = true
        persist()
    }
    private func persist() {
        do {
            try FileManager.default.createDirectory(at: scoreURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(scores).write(to: scoreURL, options: .atomic)
        } catch { errorMessage = "Couldn't save your scores. You can export the results from My progress. \(error.localizedDescription)" }
    }
}

struct ScoreDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var records: [PracticeScore]
    init(records: [PracticeScore]) { self.records = records }
    init(configuration: ReadConfiguration) throws {
        records = try JSONDecoder().decode([PracticeScore].self, from: configuration.file.regularFileContents ?? Data())
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return FileWrapper(regularFileWithContents: try encoder.encode(records))
    }
}

enum HanziTheme {
    static let green = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(red: 0.65, green: 0.85, blue: 0.55, alpha: 1) : UIColor(red: 0.14, green: 0.45, blue: 0.30, alpha: 1)
    })
    static let orange = Color(red: 1, green: 0.59, blue: 0.18)
    static func font(_ size: CGFloat = 17) -> Font { .custom("MozillaText-Regular", size: size, relativeTo: .body) }
}
