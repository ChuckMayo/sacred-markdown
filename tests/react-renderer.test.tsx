import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { parseSacred } from "../src/protocol/core";
import {
  SacredRenderer,
  commonplacePack,
  viberyOperationsPack,
} from "../src/rendering/react";
import { commandDarkTheme, paperTheme } from "../src/rendering/themes";

const source = `# Deployment\n\nTwo checks remain.\n\n:::status {#gateway label="Gateway" value="Operational" tone="success"}\n:::\n\n:::progress {#release label="Release" value=8 max=10}\n:::\n\n:::action {#review name="open_project" projectId="release"}\nReview release\n:::\n`;
const document = parseSacred(source, {
  sacred: "0.1",
  syntax: "sacred",
  capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
  allowedActions: ["open_project"],
}).document;

describe("portable React renderer", () => {
  it("renders identical meaning through two visibly distinct component packs", () => {
    const first = render(
      <SacredRenderer document={document} pack={viberyOperationsPack} theme={commandDarkTheme} />,
    );
    expect(first.container.firstElementChild).toHaveAttribute("data-pack", "vibery/operations");
    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Release" })).toHaveAttribute("value", "8");
    first.unmount();

    const second = render(
      <SacredRenderer document={document} pack={commonplacePack} theme={paperTheme} />,
    );
    expect(second.container.firstElementChild).toHaveAttribute("data-pack", "sacred/commonplace");
    expect(screen.getByText("Operational")).toBeInTheDocument();
    expect(second.container.firstElementChild).not.toHaveClass("sacred-pack--vibery");
  });

  it("emits only the host-provided action handler", () => {
    const onAction = vi.fn();
    render(
      <SacredRenderer
        document={document}
        pack={viberyOperationsPack}
        theme={commandDarkTheme}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review release" }));
    expect(onAction).toHaveBeenCalledWith("open_project", { projectId: "release" });
  });

  it("has no automated axe violations in either reference pack", async () => {
    for (const [pack, theme] of [
      [viberyOperationsPack, commandDarkTheme],
      [commonplacePack, paperTheme],
    ] as const) {
      const view = render(<SacredRenderer document={document} pack={pack} theme={theme} />);
      const results = await axe.run(view.container, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(results.violations, `${pack.name}: ${results.violations.map((v) => v.id).join(", ")}`).toEqual([]);
      view.unmount();
    }
  });
});
