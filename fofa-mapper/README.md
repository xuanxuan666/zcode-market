# fofa-mapper · FOFA 资产测绘插件

通过 FOFA 官方 API（fofa.info）做被动资产测绘：搜索资产、主机聚合、组成统计。
适用于自有资产攻击面盘点与授权渗透测试的信息收集阶段。**只读查询，不主动探测目标。**

## 组件

- MCP 服务（`scripts/fofa-mcp.mjs`）：`fofa_search` / `fofa_host` / `fofa_stats` / `fofa_syntax`
- 技能 `fofa-mapper`：测绘工作流与查询语法
- 命令 `/fofa <查询语句>`：快速查询并汇总资产表
- CLI 后备 `scripts/fofa-cli.mjs`：子代理或无 MCP 场景下用 Bash 调用

## 配置 key

fofa.info → 个人中心 → API 获取 key，然后任选其一：

```bash
# 方式一：环境变量
set FOFA_KEY=你的key        (Windows cmd)
export FOFA_KEY=你的key     (bash)

# 方式二：写入文件（一次性）
node <插件目录>/scripts/fofa-cli.mjs key 你的key
```

## 直接用 CLI

```bash
node scripts/fofa-cli.mjs search "domain=\"example.com\"" --size 50
node scripts/fofa-cli.mjs stats "domain=\"example.com\""
node scripts/fofa-cli.mjs host example.com
node scripts/fofa-cli.mjs syntax
```

## 依赖

Node >= 18（内置 fetch），无第三方依赖，无需 npm install。
