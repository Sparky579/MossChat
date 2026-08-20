"use client";

import { cjk } from "@streamdown/cjk";
import { memo, useEffect, useMemo, useState } from "react";
import { Streamdown, type PluginConfig } from "streamdown";

type StreamingMarkdownProps = {
  content: string;
  streaming?: boolean;
};

type Features = {
  code: boolean;
  math: boolean;
};

const BASE_PLUGINS: PluginConfig = { cjk };
const CODE_FENCE = /(^|\n)\s*(```|~~~)/;
const MATH_DELIMITER = /\$\$[\s\S]*?(\$\$|$)|(?<!\\)\$[^$\n]+(?<!\\)\$/;

function detectFeatures(content: string): Features {
  return {
    code: CODE_FENCE.test(content),
    math: MATH_DELIMITER.test(content),
  };
}

/**
 * DEEIX Chat lazily enables Streamdown extensions. We keep that approach so
 * Shiki and KaTeX are only downloaded for messages that actually need them.
 */
function usePlugins(content: string): PluginConfig {
  const features = useMemo(() => detectFeatures(content), [content]);
  const key = `${features.code ? "code" : ""}:${features.math ? "math" : ""}`;
  const [plugins, setPlugins] = useState<PluginConfig>(BASE_PLUGINS);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: PluginConfig = { ...BASE_PLUGINS };
      const [codeModule, mathModule] = await Promise.all([
        features.code ? import("@streamdown/code") : Promise.resolve(null),
        features.math ? import("@streamdown/math") : Promise.resolve(null),
      ]);
      if (codeModule) next.code = codeModule.code;
      if (mathModule) next.math = mathModule.createMathPlugin({ singleDollarTextMath: true });
      if (!cancelled) setPlugins(next);
    };
    void load().catch(() => {
      if (!cancelled) setPlugins(BASE_PLUGINS);
    });
    return () => { cancelled = true; };
  }, [features.code, features.math, key]);

  return plugins;
}

export const StreamingMarkdown = memo(function StreamingMarkdown({ content, streaming = false }: StreamingMarkdownProps) {
  const plugins = usePlugins(content);
  // Streamdown caches unified processors by plugin configuration. Remount once
  // an on-demand extension arrives so an initially plain markdown pass cannot
  // retain its processor during the same streamed message.
  const pluginRevision = `${plugins.code ? "code" : ""}:${plugins.math ? "math" : ""}`;

  return <div className={`markdown markdown-renderer ${streaming ? "is-streaming" : ""}`} data-streaming={streaming || undefined}>
    <Streamdown
      key={pluginRevision}
      caret="circle"
      controls={{ code: { copy: true, download: false }, mermaid: false, table: false }}
      isAnimating={streaming}
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
      plugins={plugins}
      shikiTheme={["github-light", "github-dark"]}
      animated={false}
    >
      {content}
    </Streamdown>
    {streaming && <span className="stream-caret" aria-label="Generating" />}
  </div>;
}, (previous, next) => previous.content === next.content && previous.streaming === next.streaming);
