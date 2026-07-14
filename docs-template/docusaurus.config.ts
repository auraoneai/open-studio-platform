import type { Config } from "@docusaurus/types";
import { themes } from "prism-react-renderer";
import { getFlagshipConfig } from "./src/flagship.config";

const flagship = getFlagshipConfig(process.env.DOCUSAURUS_FLAGSHIP);
const docSearchAppId = process.env.AURAONE_DOCSEARCH_APP_ID;
const docSearchApiKey = process.env.AURAONE_DOCSEARCH_SEARCH_KEY;
const docsBaseUrl = process.env.DOCUSAURUS_BASE_URL ?? "/";

const config: Config = {
  title: flagship.title,
  tagline: flagship.tagline,
  favicon: "img/logo.svg",
  url: flagship.url,
  baseUrl: docsBaseUrl,
  organizationName: "auraoneai",
  projectName: flagship.repo,
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  trailingSlash: false,
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "/",
          editUrl: `https://github.com/auraoneai/${flagship.repo}/tree/main/docs/`,
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      },
    ],
  ],
  themeConfig: {
    image: "img/logo.svg",
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: false,
      disableSwitch: false,
    },
    navbar: {
      title: flagship.shortTitle,
      logo: {
        alt: "AuraOne",
        src: "img/logo.svg",
        href: docsBaseUrl,
      },
      items: [
        { to: "/next/install", label: "Install", position: "left" },
        { to: "/next/quickstart", label: "Quickstart", position: "left" },
        {
          to: "/next/concepts/project-as-folder",
          label: "Concepts",
          position: "left",
        },
        { to: "/next/features/shell", label: "Features", position: "left" },
        { to: "/next/api/ipc", label: "API", position: "left" },
        {
          to: "/next/cookbook/deep-links",
          label: "Cookbook",
          position: "left",
        },
        { to: "/next/changelog", label: "Changelog", position: "left" },
        { href: flagship.githubUrl, label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Rubric Studio",
          items: [
            {
              label: "Launch browser IDE",
              href: "https://rubric-studio.auraone.ai",
            },
            {
              label: "Download macOS DMG",
              href: "https://github.com/auraoneai/rubric-studio-open/releases/download/v0.2.0/Rubric.Studio.Open_0.2.0_aarch64.dmg",
            },
            {
              label: "Open product page",
              href: "https://auraone.ai/open/rubric-studio-open",
            },
            { label: "Quickstart", to: "/next/quickstart" },
            { label: "Install", to: "/next/install" },
          ],
        },
        {
          title: "Open Source",
          items: [
            { label: "GitHub", href: flagship.githubUrl },
            { label: "Security", href: "https://auraone.ai/legal/security" },
            {
              label: "MIT License",
              href: `${flagship.githubUrl}/blob/main/LICENSE`,
            },
          ],
        },
        {
          title: "AuraOne",
          items: [
            { label: "Open catalog", href: "https://auraone.ai/open" },
            {
              label: "Agent Studio Open",
              href: "https://auraone.ai/open/agent-studio-open",
            },
            {
              label: "Robotics Studio Open",
              href: "https://auraone.ai/open/robotics-studio",
            },
            { label: "Contact", href: "https://auraone.ai/contact" },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} AuraOne. All rights reserved.`,
    },
    ...(docSearchAppId && docSearchApiKey
      ? {
          algolia: {
            appId: docSearchAppId,
            apiKey: docSearchApiKey,
            indexName: flagship.algoliaIndex,
            contextualSearch: true,
            searchParameters: {
              facetFilters: [`flagship:${flagship.id}`],
            },
          },
        }
      : {}),
    prism: {
      theme: themes.github,
      darkTheme: themes.dracula,
    },
    metadata: [
      { name: "auraone:flagship", content: flagship.id },
      { name: "auraone:docs-template", content: "open-studio-platform@0.1.0" },
    ],
  },
};

export default config;
