import type { Meta, StoryObj } from "@storybook/react-vite";
import { parseSacred } from "../protocol/core";
import { SacredRenderer, commonplacePack, viberyOperationsPack } from "./react";
import { commandDarkTheme, paperTheme } from "./themes";

const source = `# Release memorandum

Two checks remain before the release can advance.

:::status {#gateway label="Gateway" value="Operational" tone="success"}
:::

:::progress {#release label="Release" value=8 max=10}
:::

:::action {#review name="open_project" projectId="release"}
Review release
:::
`;

const document = parseSacred(source, {
  sacred: "0.1",
  syntax: "sacred",
  capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
  allowedActions: ["open_project"],
}).document;

const meta = {
  title: "Protocol/SacredRenderer",
  component: SacredRenderer,
  args: { document },
  decorators: [
    (Story) => (
      <div style={{ width: "min(42rem, calc(100vw - 2rem))" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SacredRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ViberyOperations: Story = {
  args: { pack: viberyOperationsPack, theme: commandDarkTheme },
};

export const CommonplacePaper: Story = {
  args: { pack: commonplacePack, theme: paperTheme },
};
