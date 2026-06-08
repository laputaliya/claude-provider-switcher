export type ToolType = "claude-code" | "opencode";

export interface Profile {
  tool: ToolType;
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  smallFastModel: string;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
  subagentModel: string;
}

export interface ProfilesConfig {
  profiles: Profile[];
  active: Record<ToolType, string | null>;
}

export interface ProviderPreset {
  label: string;
  name: string;
  /** Claude Code 使用的 API Base URL（Anthropic 兼容端点） */
  apiBaseUrl: string;
  /** OpenCode 使用的 API Base URL（OpenAI 兼容端点） */
  apiBaseUrlOC: string;
  model: string;
}

export const BUILT_IN_PRESETS: ProviderPreset[] = [
  {
    label: "阿里百炼（Token Plan）",
    name: "bailian-token",
    apiBaseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    apiBaseUrlOC: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-plus",
  },
  {
    label: "阿里百炼（Coding Plan）",
    name: "bailian-coding",
    apiBaseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    apiBaseUrlOC: "https://coding.dashscope.aliyuncs.com/v1",
    model: "qwen3.6-plus",
  },
  {
    label: "阿里百炼（基础版）",
    name: "bailian",
    apiBaseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
    apiBaseUrlOC: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-plus",
  },
  {
    label: "字节火山引擎（Agent Plan）",
    name: "volcano-agent",
    apiBaseUrl: "https://ark.cn-beijing.volces.com/api/plan",
    apiBaseUrlOC: "https://ark.cn-beijing.volces.com/api/v3",
    model: "ark-code-latest",
  },
  {
    label: "字节火山引擎（Coding Plan）",
    name: "volcano-coding",
    apiBaseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    apiBaseUrlOC: "https://ark.cn-beijing.volces.com/api/coding/v3",
    model: "ark-code-latest",
  },
  {
    label: "字节火山引擎（基础版）",
    name: "volcano",
    apiBaseUrl: "https://ark.cn-beijing.volces.com/api/compatible",
    apiBaseUrlOC: "https://ark.cn-beijing.volces.com/api/v3",
    model: "gml5.1",
  },
  {
    label: "硅基流动",
    name: "siliconflow",
    apiBaseUrl: "https://api.siliconflow.cn/v1",
    apiBaseUrlOC: "https://api.siliconflow.cn/v1",
    model: "moonshotai/Kimi-K2-Instruct-0905",
  },
  {
    label: "硅基流动（国际站）",
    name: "siliconflow-en",
    apiBaseUrl: "https://api.siliconflow.com/v1",
    apiBaseUrlOC: "https://api.siliconflow.com/v1",
    model: "moonshotai/Kimi-K2-Instruct-0905",
  },
  {
    label: "腾讯云（Coding Plan）",
    name: "tencent-coding",
    apiBaseUrl: "https://api.lkeap.cloud.tencent.com/coding/anthropic",
    apiBaseUrlOC: "https://api.lkeap.cloud.tencent.com/v1",
    model: "tc-code-latest",
  },
  {
    label: "腾讯云（Token Plan 个人版）",
    name: "tencent-token",
    apiBaseUrl: "https://api.lkeap.cloud.tencent.com/plan/anthropic",
    apiBaseUrlOC: "https://api.lkeap.cloud.tencent.com/v1",
    model: "tc-code-latest",
  },
  {
    label: "腾讯云（Token Plan 企业版）",
    name: "tencent-token-enterprise",
    apiBaseUrl: "https://tokenhub.tencentmaas.com/plan/anthropic",
    apiBaseUrlOC: "https://tokenhub.tencentmaas.com/v1",
    model: "auto",
  },
  {
    label: "MiniMax（国内站）",
    name: "minimax",
    apiBaseUrl: "https://api.minimaxi.com/anthropic",
    apiBaseUrlOC: "https://api.minimaxi.com/v1",
    model: "MiniMax-M2.7",
  },
  {
    label: "MiniMax（国际站）",
    name: "minimax-en",
    apiBaseUrl: "https://api.minimax.io/anthropic",
    apiBaseUrlOC: "https://api.minimax.io/v1",
    model: "MiniMax-M2.7",
  },
  {
    label: "月之暗面（Kimi Code Plan）",
    name: "moonshot-code",
    apiBaseUrl: "https://api.kimi.com/coding",
    apiBaseUrlOC: "https://api.kimi.com/coding/v1",
    model: "kimi-k2.6",
  },
  {
    label: "月之暗面（开放平台）",
    name: "moonshot",
    apiBaseUrl: "https://api.moonshot.cn/anthropic",
    apiBaseUrlOC: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
  },
  {
    label: "智谱",
    name: "zhipu",
    apiBaseUrl: "https://open.bigmodel.cn/api/anthropic",
    apiBaseUrlOC: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm5.1",
  },
  {
    label: "DeepSeek",
    name: "deepseek",
    apiBaseUrl: "https://api.deepseek.com/anthropic",
    apiBaseUrlOC: "https://api.deepseek.com/v1",
    model: "deepseek-v4-pro[1m]",
  },
  {
    label: "OpenRouter",
    name: "openrouter",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    apiBaseUrlOC: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4-20250514",
  },
];
