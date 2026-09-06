import deepSeekLogo from "../assets/providers/deepseek.svg?url";
import geminiLogo from "../assets/providers/gemini.svg?url";
import minimaxLogo from "../assets/providers/minimax.svg?url";
import moonshotLogo from "../assets/providers/moonshot.svg?url";
import openAiLogo from "../assets/providers/openai.svg?url";
import openRouterLogo from "../assets/providers/openrouter.svg?url";
import qwenLogo from "../assets/providers/qwen.svg?url";
import siliconFlowLogo from "../assets/providers/siliconflow.svg?url";
import xAiLogo from "../assets/providers/xai.svg?url";
import xiaomiMimoLogo from "../assets/providers/xiaomi-mimo.png?url";
import zhipuLogo from "../assets/providers/zhipu.svg?url";
import type { ChatSession } from "./types";
import type { SavedEndpoint } from "../services/storage";

export type ProviderLogo = {
  src: string;
  monochrome?: boolean;
  darkBackground?: boolean;
};

type ProviderDefinition = {
  short: string;
  full: string;
  logo?: ProviderLogo;
};

const PROVIDERS = new Map<string, ProviderDefinition>([
  [
    "https://api.openai.com/v1",
    { short: "GPT", full: "OpenAI", logo: { src: openAiLogo, monochrome: true } },
  ],
  [
    "https://openrouter.ai/api/v1",
    {
      short: "OR",
      full: "OpenRouter",
      logo: { src: openRouterLogo, darkBackground: true },
    },
  ],
  [
    "https://open.bigmodel.cn/api/paas/v4",
    { short: "GLM", full: "GLM / 智谱", logo: { src: zhipuLogo } },
  ],
  [
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
    { short: "Qwen", full: "Qwen / 通义千问", logo: { src: qwenLogo } },
  ],
  [
    "https://api.minimax.io/v1",
    { short: "MM", full: "MiniMax Global", logo: { src: minimaxLogo } },
  ],
  [
    "https://api.minimaxi.com/v1",
    { short: "MM", full: "MiniMax China", logo: { src: minimaxLogo } },
  ],
  [
    "https://api.xiaomimimo.com/v1",
    { short: "MiMo", full: "Xiaomi MiMo", logo: { src: xiaomiMimoLogo } },
  ],
  [
    "https://api.deepseek.com/v1",
    { short: "DS", full: "DeepSeek", logo: { src: deepSeekLogo } },
  ],
  [
    "https://api.moonshot.cn/v1",
    { short: "Kimi", full: "Moonshot / Kimi", logo: { src: moonshotLogo, monochrome: true } },
  ],
  [
    "https://api.siliconflow.cn/v1",
    { short: "SF", full: "SiliconFlow / 硅基流动", logo: { src: siliconFlowLogo } },
  ],
  [
    "https://generativelanguage.googleapis.com/v1beta/openai",
    { short: "Gemini", full: "Google Gemini", logo: { src: geminiLogo } },
  ],
  [
    "https://api.x.ai/v1",
    { short: "xAI", full: "xAI", logo: { src: xAiLogo, monochrome: true } },
  ],
]);

export type TabLabel = {
  provider: string;
  providerFull: string;
  model: string;
  logo?: ProviderLogo;
};

export function normalizedBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function isBuiltInEndpoint(baseUrl: string): boolean {
  return PROVIDERS.has(normalizedBaseUrl(baseUrl));
}

export function tabLabel(
  session: ChatSession,
  index: number,
  customEndpoints: SavedEndpoint[],
): TabLabel {
  const baseUrl = normalizedBaseUrl(session.config.baseUrl);
  const builtIn = PROVIDERS.get(baseUrl);
  const savedEndpoint = customEndpoints.find(
    (endpoint) => normalizedBaseUrl(endpoint.baseUrl) === baseUrl,
  );

  if (builtIn) {
    return {
      provider: builtIn.short,
      providerFull: builtIn.full,
      model: session.config.model.trim() || `Chat ${index + 1}`,
      logo: builtIn.logo,
    };
  }

  let fallbackName = "API";
  try {
    const hostname = new URL(baseUrl).hostname;
    fallbackName = hostname.split(".").find((part) => part !== "api" && part !== "www") || "API";
  } catch {
    // Keep the generic label for an invalid or incomplete URL.
  }

  const fullName = savedEndpoint?.name || fallbackName;
  return {
    provider: fullName.slice(0, 7),
    providerFull: fullName,
    model: session.config.model.trim() || `Chat ${index + 1}`,
  };
}
