cask "robotics-studio-open" do
  # STAGED ONLY: intentionally invalid until signed 0.2.0 DMG evidence exists.
  # Do not publish this file with either blocked field unchanged.
  version "0.2.0"
  sha256 "BLOCKED_UNTIL_SIGNED_DMG_SHA256"
  url "BLOCKED_UNTIL_SIGNED_DMG_RELEASE_URL"
  name "Robotics Studio Open"
  desc "Open-source desktop IDE for reviewing robotics datasets and failure clusters"
  homepage "https://auraone.ai/open/robotics-studio"
  depends_on arch: :arm64
  depends_on macos: ">= :monterey"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Robotics Studio Open.app"
  binary "#{appdir}/Robotics Studio Open.app/Contents/MacOS/robotics-studio-open", target: "robostudio"

  zap trash: [
    "~/Library/Application Support/ai.auraone.roboticsstudio",
    "~/Library/Preferences/ai.auraone.roboticsstudio.plist",
    "~/Library/Saved Application State/ai.auraone.roboticsstudio.savedState"
  ]
end
