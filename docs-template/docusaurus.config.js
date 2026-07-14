const config = {
  title: 'AuraOne Open Studio',
  tagline: 'Local-first AuraOne Open Studio docs',
  favicon: 'img/favicon.ico',
  url: 'https://auraone.ai',
  baseUrl: '/open/docs/',
  organizationName: 'auraoneai',
  projectName: 'open-studio',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/auraoneai/open-studio-platform/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'AuraOne Open Studio',
      items: [
        { type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: 'Docs' },
        { href: 'https://auraone.ai/open', label: 'Open', position: 'right' },
      ],
    },
    algolia: {
      appId: 'AURAONE_DOCSEARCH_APP_ID',
      apiKey: 'AURAONE_DOCSEARCH_SEARCH_KEY',
      indexName: 'auraone-open-studio',
    },
  },
};

export default config;
