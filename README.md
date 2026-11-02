# coldcoffee-market · ZCode 插件市场

自建 ZCode 插件市场仓库。当前收录：

| 插件 | 版本 | 说明 |
| --- | --- | --- |
| [fofa-mapper](./fofa-mapper) | 0.1.0 | 基于 FOFA 官方 API 的资产测绘：资产搜索、主机聚合、组成统计（MCP 工具 + 技能 + 命令）。仅限授权安全工作使用 |

## 安装

1. 在 ZCode 打开 **Plugin Marketplace → 添加 → 添加插件市场**，粘贴本仓库的地址
   （形如 `https://github.com/<你的用户名>/<仓库名>`；若当前版本只支持目录源，先克隆到本地再粘贴克隆目录）
2. **个人 → coldcoffee-market → FOFA 资产测绘 → 安装**
3. 配置 FOFA key（fofa.info 个人中心获取）：设环境变量 `FOFA_KEY`，或
   `node <插件目录>/scripts/fofa-cli.mjs key <KEY>`

## 更新

插件源码更新并升版本后，在插件市场 **齿轮 → 市场源** 里刷新本市场，再回「个人」点更新。
