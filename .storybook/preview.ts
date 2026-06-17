import type { Preview } from "@storybook/nextjs";
import { initialize, mswLoader } from "msw-storybook-addon";

import "../app/globals.css";

initialize({
  onUnhandledRequest: "error",
});

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    msw: {},
  },
};

export default preview;
