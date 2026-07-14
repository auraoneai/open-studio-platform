export type FlagshipId = "rubric-studio" | "robotics-studio" | "agent-studio";

export type FlagshipDocsConfig = {
  id: FlagshipId;
  title: string;
  shortTitle: string;
  tagline: string;
  url: string;
  repo: string;
  githubUrl: string;
  algoliaIndex: string;
};

const configs: Record<FlagshipId, FlagshipDocsConfig> = {
  "rubric-studio": {
    id: "rubric-studio",
    title: "Rubric Studio Open Docs",
    shortTitle: "Rubric Studio Open",
    tagline: "The local-first IDE for criterion-level evaluation rubrics.",
    url: "https://docs.rubricstudio.auraone.ai",
    repo: "rubric-studio-open",
    githubUrl: "https://github.com/auraoneai/rubric-studio-open",
    algoliaIndex: "auraone_rubric_studio_open",
  },
  "robotics-studio": {
    id: "robotics-studio",
    title: "Robotics Studio Open Docs",
    shortTitle: "Robotics Studio",
    tagline: "The open IDE for robotics dataset review.",
    url: "https://robotics-studio.auraone.ai",
    repo: "robotics-studio-open",
    githubUrl: "https://github.com/auraoneai/robotics-studio-open",
    algoliaIndex: "auraone_robotics_studio_open",
  },
  "agent-studio": {
    id: "agent-studio",
    title: "Agent Studio Open Docs",
    shortTitle: "Agent Studio",
    tagline: "The open IDE for MCP agent debugging.",
    url: "https://agentstudio.auraone.ai",
    repo: "agent-studio-open",
    githubUrl: "https://github.com/auraoneai/agent-studio-open",
    algoliaIndex: "auraone_agent_studio_open",
  },
};

export function getFlagshipConfig(value?: string): FlagshipDocsConfig {
  if (
    value === "robotics-studio" ||
    value === "agent-studio" ||
    value === "rubric-studio"
  ) {
    return configs[value];
  }
  return configs["rubric-studio"];
}
