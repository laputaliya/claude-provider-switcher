export interface Profile {
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
}

export interface ProfilesConfig {
  profiles: Profile[];
  active: string | null;
}

export interface ProviderPreset {
  label: string;
  name: string;
  apiBaseUrl: string;
  model: string;
}

export const BUILT_IN_PRESETS: ProviderPreset[] = [
  {
    label: "阿里百炼（Token Plan）",
    name: "bailian-token",
    apiBaseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    model: "qwen3.6-plus",
  },
  {
    label: "阿里百炼（Coding Plan）",
    name: "bailian-coding",
    apiBaseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    model: "qwen3.6-plus",
  },
  {
    label: "阿里百炼（基础版）",
    name: "bailian",
    apiBaseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
    model: "qwen3.6-plus",
  },
  {
    label: "字节火山引擎（Agent Plan）",
    name: "volcano-agent",
    apiBaseUrl: "https://ark.cn-beijing.volces.com/api/plan",
    model: "ark-code-latest",
  },
  {
    label: "字节火山引擎（Coding Plan）",
    name: "volcano-coding",
    apiBaseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    model: "ark-code-latest",
  },
  {
    label: "字节火山引擎（基础版）",
    name: "volcano",
    apiBaseUrl: "https://ark.cn-beijing.volces.com/api/compatible",
    model: "gml5.1",
  },
  {
    label: "硅基流动",
    name: "siliconflow",
    apiBaseUrl: "https://api.siliconflow.cn/v1",
    model: "moonshotai/Kimi-K2-Instruct-0905",
  },
  {
    label: "硅基流动（国际站）",
    name: "siliconflow-en",
    apiBaseUrl: "https://api.siliconflow.com/v1",
    model: "moonshotai/Kimi-K2-Instruct-0905",
  },
  {
    label: "腾讯云（Coding Plan）",
    name: "tencent-coding",
    apiBaseUrl: "https://api.lkeap.cloud.tencent.com/coding/anthropic",
    model: "tc-code-latest",
  },
  {
    label: "腾讯云（Token Plan 个人版）",
    name: "tencent-token",
    apiBaseUrl: "https://api.lkeap.cloud.tencent.com/plan/anthropic",
    model: "tc-code-latest",
  },
  {
    label: "腾讯云（Token Plan 企业版）",
    name: "tencent-token-enterprise",
    apiBaseUrl: "https://tokenhub.tencentmaas.com/plan/anthropic",
    model: "auto",
  },
  {
    label: "DeepSeek",
    name: "deepseek",
    apiBaseUrl: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-pro[1m]",
  },
  {
    label: "OpenRouter",
    name: "openrouter",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4-20250514",
  },
];
