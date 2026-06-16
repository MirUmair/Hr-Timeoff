import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  stories: ["../**/*.stories.@(ts|tsx|mdx)"],
  addons: [],
  staticDirs: ["../public"],
};

export default config;
