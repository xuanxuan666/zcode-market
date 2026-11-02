#!/usr/bin/env node
// fofa-mcp.mjs — FOFA 资产测绘 MCP 服务（stdio，换行分隔 JSON-RPC 2.0，无第三方依赖）。
// 仅输出 JSON-RPC 到 stdout；诊断信息走 stderr。
import { createInterface } from "node:readline";
import {
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_STATS_FIELDS,
  QUERY_CHEATSHEET,
  fofaHost,
  fofaSearch,
  fofaStats,
  formatSearchTable,
} from "./fofa-core.mjs";

const SERVER_INFO = { name: "fofa-mapper", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "fofa_search",
    description:
      "查询 FOFA 网络空间资产库（官方 API /search/all），返回命中总数与资产明细。仅用于授权范围内的资产测绘（攻击面盘点、暴露面收敛）。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'FOFA 查询语句，如 domain="example.com"、ip="1.2.3.0/24"、app="Apache-Shiro" && country="CN"。不确定语法时先调 fofa_syntax。',
        },
        fields: {
          type: "string",
          description: `返回字段，逗号分隔，默认 ${DEFAULT_SEARCH_FIELDS}`,
        },
        size: { type: "number", description: "本页条数，默认 20，最大 500", default: 20 },
        page: { type: "number", description: "页码，从 1 开始", default: 1 },
        full: {
          type: "boolean",
          description: "true 查全量历史数据（需对应会员权限），默认只查近一年",
          default: false,
        },
        raw: {
          type: "boolean",
          description: "true 时在表格后附 JSON 原始行，便于程序化处理",
          default: false,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fofa_host",
    description:
      "查询某主机/IP 在 FOFA 的聚合视图（官方 API /host/{host}）：开放端口、服务、所属 ASN/组织、历史解析。用于对重点资产做深挖。",
    inputSchema: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "域名或 IP，如 example.com 或 1.2.3.4",
        },
      },
      required: ["host"],
    },
  },
  {
    name: "fofa_stats",
    description:
      "对一条 FOFA 查询做组成统计（官方 API /search/stats）：标题/端口/中间件/地区的 top 分布。用于先摸规模再决定搜索策略，消耗比翻页搜索低。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "FOFA 查询语句" },
        fields: {
          type: "string",
          description: `统计维度，逗号分隔，默认 ${DEFAULT_STATS_FIELDS}；可选 title,ip,port,server,protocol,country,region,city,app,banner,header,icp,fid`,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fofa_syntax",
    description: "返回 FOFA 查询语法速查表（定位、指纹、地域、组合、可用返回字段）。写复杂查询前先调用它。",
    inputSchema: { type: "object", properties: {} },
  },
];

function toolResult(text, { isError = false } = {}) {
  return { isError, content: [{ type: "text", text }] };
}

async function callTool(name, args = {}) {
  if (name === "fofa_search") {
    const result = await fofaSearch(args);
    const parts = [
      `FOFA 命中总数：${result.total}（第 ${result.page} 页，本次返回 ${result.returned} 行）`,
      `查询：${result.query}`,
      "",
      formatSearchTable(result),
    ];
    if (args.raw) parts.push("", "```json", JSON.stringify(result.rows, null, 2), "```");
    parts.push(
      "",
      "翻页用 page 参数；看组成分布用 fofa_stats；深挖单台主机用 fofa_host。"
    );
    return toolResult(parts.join("\n"));
  }
  if (name === "fofa_host") {
    const data = await fofaHost(args.host);
    return toolResult("```json\n" + JSON.stringify(data, null, 2) + "\n```");
  }
  if (name === "fofa_stats") {
    const data = await fofaStats(args);
    return toolResult("```json\n" + JSON.stringify(data, null, 2) + "\n```");
  }
  if (name === "fofa_syntax") {
    return toolResult(QUERY_CHEATSHEET);
  }
  return toolResult(`未知工具：${name}`, { isError: true });
}

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return;
  const { id, method, params } = msg;

  if (method === "initialize") {
    reply(id, {
      protocolVersion: params && params.protocolVersion ? params.protocolVersion : PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }
  if (id === undefined) return; // notification，不回包（如 notifications/initialized）
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (method === "tools/list") {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === "resources/list") {
    reply(id, { resources: [] });
    return;
  }
  if (method === "prompts/list") {
    reply(id, { prompts: [] });
    return;
  }
  if (method === "tools/call") {
    const name = params && params.name;
    try {
      const result = await callTool(name, (params && params.arguments) || {});
      reply(id, result);
    } catch (e) {
      reply(id, toolResult(`工具 ${name} 执行失败：${e.message}`, { isError: true }));
    }
    return;
  }
  replyError(id, -32601, `Method not found: ${method}`);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch (e) {
    replyError(null, -32700, `Parse error: ${e.message}`);
    return;
  }
  handleMessage(msg).catch((e) => {
    process.stderr.write(`fofa-mcp internal error: ${e.stack || e.message}\n`);
    if (msg && msg.id !== undefined) {
      replyError(msg.id, -32603, `Internal error: ${e.message}`);
    }
  });
});
rl.on("close", () => process.exit(0));
