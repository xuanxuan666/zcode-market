#!/usr/bin/env node
// fofa-cli.mjs — FOFA 资产测绘命令行后备（与 MCP 服务共用 fofa-core.mjs）。
// 用法：
//   node fofa-cli.mjs search "domain=\"example.com\"" [--size 20] [--page 1] [--fields host,ip,...] [--full] [--raw]
//   node fofa-cli.mjs host example.com
//   node fofa-cli.mjs stats "domain=\"example.com\"" [--fields title,port,server,country]
//   node fofa-cli.mjs key <YOUR_FOFA_KEY>      保存 key 到 ~/.fofa/key
//   node fofa-cli.mjs syntax                   打印查询语法速查
// 退出码：0 成功，1 执行失败，2 用法错误。
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_STATS_FIELDS,
  QUERY_CHEATSHEET,
  fofaHost,
  fofaSearch,
  fofaStats,
  formatSearchTable,
  noKeyHint,
} from "./fofa-core.mjs";

const USAGE = `FOFA 资产测绘 CLI
用法：
  node fofa-cli.mjs search "<查询>" [--size 20] [--page 1] [--fields ${DEFAULT_SEARCH_FIELDS}] [--full] [--raw]
  node fofa-cli.mjs host <域名或IP>
  node fofa-cli.mjs stats "<查询>" [--fields ${DEFAULT_STATS_FIELDS}]
  node fofa-cli.mjs key <FOFA_KEY>
  node fofa-cli.mjs syntax`;

function parseArgs(argv) {
  const flags = { size: 20, page: 1 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") flags.full = true;
    else if (a === "--raw") flags.raw = true;
    else if (a === "--size") flags.size = Number(argv[++i]);
    else if (a === "--page") flags.page = Number(argv[++i]);
    else if (a === "--fields") flags.fields = argv[++i];
    else rest.push(a);
  }
  return { flags, rest };
}

async function main() {
  const [, , cmd, ...argv] = process.argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    console.log(USAGE);
    process.exit(0);
  }

  if (cmd === "syntax") {
    console.log(QUERY_CHEATSHEET);
    return;
  }

  if (cmd === "key") {
    const key = (argv[0] || "").trim();
    if (!key) {
      console.error("用法：node fofa-cli.mjs key <FOFA_KEY>");
      process.exit(2);
    }
    const dir = join(homedir(), ".fofa");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "key"), key + "\n", "utf8");
    console.log(`key 已写入 ${join(dir, "key")}`);
    return;
  }

  const { flags, rest } = parseArgs(argv);

  if (cmd === "search") {
    const query = rest[0];
    const result = await fofaSearch({
      query,
      fields: flags.fields || DEFAULT_SEARCH_FIELDS,
      size: flags.size,
      page: flags.page,
      full: flags.full,
    });
    console.log(
      `FOFA 命中总数：${result.total}（第 ${result.page} 页，本次返回 ${result.returned} 行）`
    );
    console.log(formatSearchTable(result));
    if (flags.raw) console.log(JSON.stringify(result.rows, null, 2));
    return;
  }

  if (cmd === "host") {
    const data = await fofaHost(rest[0]);
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (cmd === "stats") {
    const data = await fofaStats({ query: rest[0], fields: flags.fields || DEFAULT_STATS_FIELDS });
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.error(`未知命令：${cmd}\n${USAGE}`);
  process.exit(2);
}

main().catch((e) => {
  const msg = String(e.message || e);
  console.error(msg.includes("未找到 FOFA API key") ? noKeyHint() : msg);
  process.exit(1);
});
