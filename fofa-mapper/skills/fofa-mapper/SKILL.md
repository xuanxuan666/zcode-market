---
name: fofa-mapper
description: >
  FOFA 资产测绘。Use when the user mentions FOFA, 空间测绘, 资产测绘, 资产发现,
  攻击面盘点, 暴露面收敛, 子域收集, 指纹统计, 侧资, 资产表.
  Queries the FOFA official API (search / host / stats) and turns the results
  into an asset inventory. Read-only queries only; authorized security work only.
---

# FOFA 资产测绘 · fofa-mapper

通过 FOFA 官方 API 做被动测绘：所有数据来自 FOFA 已收录的互联网资产索引，不主动触碰目标系统。
仅用于授权范围内的安全工作（自有资产盘点、攻击面管理、授权渗透测试的信息收集阶段）。

## 前置

1. key：fofa.info → 个人中心 → API。三种配置方式任选：
   - 环境变量 `FOFA_KEY`
   - `node fofa-cli.mjs key <KEY>` 写入 `~/.fofa/key`（即本插件 `scripts/fofa-cli.mjs`，用安装后的绝对路径调用）
   - 手动创建 `~/.fofa/key`
2. key 缺失时工具会报错并提示配置方法，照提示让用户配置后重试，不要编造数据。
3. 查询消耗 F 点：先用 stats 摸分布，再决定 search 拉多少行。size 上限 500/页。

## 调用方式

优先用 fofa MCP 工具（安装本插件后自动可用）：

| 工具 | 用途 |
| --- | --- |
| `fofa_search` | 查询资产明细，返回总数 + 表格 |
| `fofa_stats` | 查询组成分布（标题/端口/中间件/地区 top） |
| `fofa_host` | 单主机聚合视图（端口、服务、ASN、组织） |
| `fofa_syntax` | 查询语法速查，写复杂语句前先看 |

MCP 不可用时（如子代理无 MCP），用 Bash 调 CLI：

```bash
node "<插件路径>/scripts/fofa-cli.mjs" search "domain=\"example.com\"" --size 50
node "<插件路径>/scripts/fofa-cli.mjs" stats "domain=\"example.com\""
node "<插件路径>/scripts/fofa-cli.mjs" host example.com
```

## 工作流

第一步 摸规模
对目标根域/网段跑 `fofa_stats`，看端口、组件、地区分布，判断资产体量与重点。

第二步 收资产
`fofa_search` 拉明细。典型查询：
- 自有域名面：`domain="example.com"`
- 网段面：`ip="1.2.3.0/24" && protocol="http"`
- 组件面：`org="Example Inc" && app="Nginx"`
fields 按需裁剪（host,ip,port,title,server,country,city,lastupdatetime 起步）。

第三步 做转向（pivot）
- 看到可疑 favicon/同模板系统 → `icon_hash` / `fid` 转向找同类站
- 证书 → `cert="example.com"` 找同证书资产
- 重点 IP → `fofa_host` 看端口与服务全貌

第四步 出资产表
汇总成表：资产(host:port) / 标题 / 组件 / 归属(地区、org) / 最近更新 / 备注。
收尾给 2-3 条下一步建议（哪些面值得继续测绘、哪些收敛点可以加固）。

## 边界

- 只做测绘查询与汇总，不做端口扫描、漏洞利用或任何主动探测。
- 查询语句面向授权目标；用户未授权的第三方资产只做技术演示时给出查询思路即可。
- FOFA 免费账户 size/权限有限，报错（如"会员级别不满足"）原样转告用户。
