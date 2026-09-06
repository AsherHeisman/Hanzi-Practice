# Hanzi Learning for iPhone and iPad

Open `HanziLearning.xcodeproj` in Xcode. Select the HanziLearning scheme, select your connected iPhone, and choose your development team under Signing & Capabilities. Run with Command-R. The app supports iOS 17 and later.

The SwiftUI app includes both textbooks, searchable vocabulary, guided stroke practice, recall quizzes, saved progress, and JSON export. It follows the device's light/dark appearance and uses bundled Mozilla Text fonts. Stroke practice uses a local Hanzi Writer view inside the native practice screen, with blue strokes and orange radicals. Stroke data requires an internet connection.

Scores stay on this device and are separate from the website's browser history. Completed words earn 100 points without corrections, 50 with corrections, or 0 when skipped. Progress keeps the latest 200 completed sessions. Use Export in the Progress tab to save a JSON copy.

The app bundles curriculum snapshots from `data/data-textbook1.json` and `data/data-textbook2.json`. After updating the curriculum, copy the desired JSON files into `HanziLearning/LearningResources/` and rebuild. Website admin edits do not automatically sync to the app. Curriculum administration remains on the website.

To check an unsigned simulator build:

```sh
xcodebuild -project ios/HanziLearning.xcodeproj -scheme HanziLearning \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/HanziLearningDerivedData CODE_SIGNING_ALLOWED=NO build
```

Run that command from the repository root. Hanzi Writer 3.7.3 and its MIT license are bundled in LearningResources, alongside the Mozilla font license.
