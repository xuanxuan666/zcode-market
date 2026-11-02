// FOFA 官方 API 客户端。仅依赖 Node >= 18 内置模块（fetch / fs / path / buffer）。
// 凭据来源（按序）：环境变量 FOFA_KEY（或 FOFA_API_KEY）→ ~/.fofa/key → ~/.fofa.key
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const FOFA_BASE = "https://fofa.info/api/v1";
export const DEFAULT_SEARCH_FIELDS =
  "host,ip,port,title,domain,protocol,server,country,city,lastupdatetime";
export const DEFAULT_STATS_FIELDS = "title,port,server,country";
export const MAX_SIZE = 500;

export const QUERY_CHEATSHEET = `# FOFA 查询语法速查（查询语法以 fofa.info 帮助页为准）

## 定位资产
- domain="example.com"            根域与子域
- host=".gov.cn"                  主机名后缀匹配
- ip="1.2.3.4" / ip="1.2.3.0/24"  单 IP / CIDR 网段；ip!="1.2.3.4" 排除
- port="443"                      端口；区间用 port>="8000" && port<="9000"
- protocol="https"                协议（http/https/ssh/redis/rdp/vnc...）

## 指纹与内容
- title="管理后台"                 网页标题
- body="rememberMe"               响应体关键字
- header="JSESSIONID"             响应头关键字
- server="nginx"                  中间件
- app="Apache-Shiro"              组件指纹（名称取 FOFA 组件库，如 app="ATLASSIAN-Confluence"）
- icon_hash="-247387890"          favicon 哈希（用于找同套系统）
- js_name="jquery.min.js" / js_md5="..."   前端 JS 指纹
- cert="example.com"              证书；cert.subject="Example Inc"、cert.issuer="DigiCert"
- fid="s_xxxxx"                   站点指纹聚合（同模板站点的父指纹）
- banner="..."                    服务横幅（非 HTTP 协议）
- os="Windows"、status_code="200"、after="2024-01-01"（更新时间过滤）

## 归属与地域
- country="CN"、region="Beijing"、city="Beijing"
- org="..."、icp="京ICP备xxxx号"、is_domain=true、is_ipv6=true

## 组合
- 与或非：&&、||、!=
  例：app="Apache-Shiro" && country="US"、domain="example.com" && protocol="https"

## search/all 可用返回字段（fields，逗号分隔）
host, ip, port, title, domain, domain_name, link, protocol, server, os,
icp, banner, cert, cert.subject, cert.issuer, header, org,
country, country_name, region, city, latitude, longitude,
as_number, as_organization, banner_num, port_size, ip_size,
lastupdatetime, fid, icon_hash, jarm

## 消耗提示
每次查询按 FOFA 计费规则消耗 F 点；size 越大、翻页越深消耗越多。先用 fofa_stats 看分布再决定拉多少行。`;

export function resolveKey() {
  const fromEnv = process.env.FOFA_KEY || process.env.FOFA_API_KEY;
  if (fromEnv && fromEnv.trim()) return { key: fromEnv.trim(), source: "环境变量 FOFA_KEY" };
  for (const p of [join(homedir(), ".fofa", "key"), join(homedir(), ".fofa.key")]) {
    try {
      const v = readFileSync(p, "utf8").trim();
      if (v) return { key: v, source: p };
    } catch {
      // 文件不存在则尝试下一个位置
    }
  }
  return null;
}

export function noKeyHint() {
  return [
    "未找到 FOFA API key。三选一配置：",
    '1. 设环境变量：FOFA_KEY=<你的key>（fofa.info 个人中心获取）',
    "2. 运行：node fofa-cli.mjs key <你的key>（写入 ~/.fofa/key）",
    "3. 手动创建文件 ~/.fofa/key 并粘贴 key",
  ].join("\n");
}

async function apiGet(pathname, params, timeoutMs = 30000) {
  const qs = new URLSearchParams(params);
  let res;
  try {
    res = await fetch(`${FOFA_BASE}${pathname}?${qs}`, {
      headers: { "User-Agent": "fofa-mapper-zcode/0.1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const cause = e && e.cause ? e.cause.message || String(e.cause) : "";
    throw new Error(`访问 FOFA 失败（网络或超时）：${cause || e.message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FOFA HTTP ${res.status} ${res.statusText} ${body.slice(0, 200)}`.trim());
  }
  const data = await res.json();
  if (data.error) throw new Error(`FOFA 返回错误：${data.errmsg || JSON.stringify(data)}`);
  return data;
}

function requireQuery(query) {
  const q = String(query ?? "").trim();
  if (!q) throw new Error('query 不能为空，例如 domain="example.com"');
  return q;
}

export async function fofaSearch({
  query,
  fields = DEFAULT_SEARCH_FIELDS,
  size = 20,
  page = 1,
  full = false,
} = {}) {
  const q = requireQuery(query);
  const key = resolveKey();
  if (!key) throw new Error(noKeyHint());
  const n = Math.min(Math.max(Math.trunc(Number(size) || 20), 1), MAX_SIZE);
  const p = Math.max(Math.trunc(Number(page) || 1), 1);
  const data = await apiGet("/search/all", {
    key: key.key,
    qbase64: Buffer.from(q, "utf8").toString("base64"),
    fields: String(fields || DEFAULT_SEARCH_FIELDS),
    size: String(n),
    page: String(p),
    full: full ? "true" : "false",
  });
  const cols = String(fields || DEFAULT_SEARCH_FIELDS).split(",").map((s) => s.trim());
  const rows = (data.results || []).map((r) =>
    Object.fromEntries(cols.map((c, i) => [c, r[i]]))
  );
  return {
    total: data.size,
    page: data.page ?? p,
    returned: rows.length,
    mode: data.mode,
    query: data.query ?? q,
    fields: cols,
    rows,
  };
}

export async function fofaHost(host) {
  const h = String(host ?? "").trim();
  if (!h) throw new Error("host 不能为空，例如 example.com 或 1.2.3.4");
  const key = resolveKey();
  if (!key) throw new Error(noKeyHint());
  const data = await apiGet(`/host/${encodeURIComponent(h)}`, {
    key: key.key,
    detail: "true",
  });
  return data;
}

export async function fofaStats({ query, fields = DEFAULT_STATS_FIELDS } = {}) {
  const q = requireQuery(query);
  const key = resolveKey();
  if (!key) throw new Error(noKeyHint());
  const data = await apiGet("/search/stats", {
    key: key.key,
    qbase64: Buffer.from(q, "utf8").toString("base64"),
    fields: String(fields || DEFAULT_STATS_FIELDS),
  });
  return data;
}

export function formatSearchTable(result, { maxTitle = 48 } = {}) {
  const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const trunc = (v) => {
    const s = String(v ?? "");
    return s.length > maxTitle ? s.slice(0, maxTitle - 1) + "…" : s;
  };
  const cols = result.fields || [];
  const head = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const lines = result.rows.map((row) =>
    `| ${cols.map((c) => esc(trunc(row[c]))).join(" | ")} |`
  );
  return [head, sep, ...lines].join("\n");
}
