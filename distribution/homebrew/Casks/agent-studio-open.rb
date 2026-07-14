cask "agent-studio-open" do
  # STAGED ONLY: intentionally invalid until signed 0.2.0 DMG evidence exists.
  # Do not publish this file with either blocked field unchanged.
  version "0.2.0"
  sha256 "BLOCKED_UNTIL_SIGNED_DMG_SHA256"
  url "BLOCKED_UNTIL_SIGNED_DMG_RELEASE_URL"
  name "Agent Studio Open"
  desc "Open-source desktop IDE for MCP server debugging and agent trace replay"
  homepage "https://auraone.ai/open/agent-studio-open"
  depends_on arch: :arm64
  depends_on macos: ">= :monterey"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Agent Studio Open.app"
  binary "#{appdir}/Agent Studio Open.app/Contents/MacOS/agentstudio", target: "agentstudio"

  zap trash: [
    "~/Library/Application Support/ai.auraone.agentstudio",
    "~/Library/Preferences/ai.auraone.agentstudio.plist",
    "~/Library/Saved Application State/ai.auraone.agentstudio.savedState"
  ]
end
