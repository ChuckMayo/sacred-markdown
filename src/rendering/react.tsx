import type { CSSProperties, ComponentType } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SacredDocument, SacredNode } from "../protocol/types";
import type { SacredTheme } from "../registry";

export interface SacredComponentPack {
  name: string;
  version: string;
  className: string;
  components?: Partial<Record<SacredNode["kind"], ComponentType<never>>>;
}

export interface SacredRendererProps {
  document: SacredDocument;
  pack: SacredComponentPack;
  theme: SacredTheme;
  onAction?: (name: string, payload: Record<string, unknown>) => void;
}

export const viberyOperationsPack: SacredComponentPack = {
  name: "vibery/operations",
  version: "0.1.0",
  className: "sacred-pack--vibery",
};

export const commonplacePack: SacredComponentPack = {
  name: "sacred/commonplace",
  version: "0.1.0",
  className: "sacred-pack--commonplace",
};

function themeStyle(theme: SacredTheme): CSSProperties {
  return Object.fromEntries(
    Object.entries(theme.tokens).map(([key, value]) => [`--sacred-${key.replaceAll(".", "-")}`, value]),
  ) as CSSProperties;
}

function toneClass(tone = "neutral") {
  return `sacred-tone--${tone}`;
}

export function SacredRenderer({ document, pack, theme, onAction }: SacredRendererProps) {
  const root = document.nodes[document.root];
  if (!root || root.kind !== "document") {
    return <p role="alert">This Sacred document has no renderable root.</p>;
  }

  return (
    <section
      className={`sacred-renderer ${pack.className}`}
      data-pack={pack.name}
      data-pack-version={pack.version}
      data-theme={theme.name}
      style={themeStyle(theme)}
      aria-label="Sacred interface preview"
    >
      {root.children.map((id) => {
        const node = document.nodes[id];
        if (!node) return null;
        if (node.kind === "prose") {
          return (
            <div className="sacred-prose" key={id}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.markdown}</ReactMarkdown>
            </div>
          );
        }
        if (node.kind === "status") {
          return (
            <dl className={`sacred-status ${toneClass(node.props.tone)}`} key={id}>
              <dt>{node.props.label}</dt>
              <dd>
                <span aria-hidden="true" className="sacred-status__mark" />
                {node.props.value}
              </dd>
            </dl>
          );
        }
        if (node.kind === "progress") {
          const progressLabel = node.props.label ?? "Progress";
          return (
            <div className={`sacred-progress ${toneClass(node.props.tone)}`} key={id}>
              <div className="sacred-progress__label">
                <span>{progressLabel}</span>
                <span className="sacred-progress__value">
                  {node.props.value} / {node.props.max}
                </span>
              </div>
              <progress aria-label={progressLabel} value={node.props.value} max={node.props.max} />
            </div>
          );
        }
        if (node.kind === "action") {
          return (
            <button
              className="sacred-action"
              key={id}
              type="button"
              onClick={() => onAction?.(node.props.name, node.props.payload)}
            >
              {node.props.label}
              <span aria-hidden="true">↗</span>
            </button>
          );
        }
        if (node.kind === "unsupported") {
          return (
            <p className="sacred-unsupported" data-capability={node.capability} key={id}>
              {node.fallback}
            </p>
          );
        }
        return null;
      })}
    </section>
  );
}
