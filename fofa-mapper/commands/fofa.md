---
description: FOFA 快速查询并汇总资产表
argument-hint: <FOFA查询语句> [size=N]
---

对查询「$ARGUMENTS」执行 FOFA 资产测绘：

1. 优先调用 fofa MCP 的 `fofa_search` 工具（未指定 size 时用 20；语法拿不准先调 `fofa_syntax`）。
2. 把结果整理成资产表：host、ip:port、标题、server/组件、地区、最近更新。
3. 报告命中总数；若结果量大或分布不明，补一次 `fofa_stats` 给出端口/组件/地区 top 分布。
4. 给 2-3 条下一步测绘建议（可用的转向查询，如 cert、icon_hash、fid）。
5. 若报缺 key 或会员权限不足，原样转告并给出配置方法：环境变量 `FOFA_KEY`，或
   `node <插件目录>/scripts/fofa-cli.mjs key <KEY>`。

边界：只做 FOFA 测绘查询，不做主动扫描或利用。
