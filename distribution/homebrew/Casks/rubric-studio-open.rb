cask "rubric-studio-open" do
  # STAGED ONLY: intentionally invalid until signed 0.2.0 DMG evidence exists.
  # Do not publish this file with either blocked field unchanged.
  version "0.2.0"
  sha256 "BLOCKED_UNTIL_SIGNED_DMG_SHA256"
  url "BLOCKED_UNTIL_SIGNED_DMG_RELEASE_URL"
  name "Rubric Studio Open"
  desc "Local-first IDE for authoring, testing, calibrating, diffing, and exporting AI evaluation rubrics"
  homepage "https://auraone.ai/open/rubric-studio-open"
  depends_on arch: :arm64
  depends_on macos: ">= :monterey"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Rubric Studio Open.app"
  binary "#{appdir}/Rubric Studio Open.app/Contents/MacOS/rubric-studio-open", target: "rubricstudio"

  zap trash: [
    "~/Library/Application Support/ai.auraone.rubricstudio",
    "~/Library/Caches/ai.auraone.rubricstudio",
    "~/Library/Logs/ai.auraone.rubricstudio",
    "~/Library/Preferences/ai.auraone.rubricstudio.plist"
  ]
end
