# cus_insight 行为洞察驾驶舱

依据《自定义应用开发说明文档》（深信服行为感知系统 BA）实现，接口与目录结构对照示例应用 `cus_demo`。
应用 id：`cus_insight`（满足 `cus_` + 4~28 位小写字母约定）。

## 一、功能

| 模块 | 接口（app.xxx@cus_insight） | 数据来源 |
| --- | --- | --- |
| 概览 | `app.overview.summary` | flux_duration_action / domain_access / risk_term |
| 流量排行 | `app.rank.top_flux` | flux_duration_action、group_flux_midtable |
| 时长排行 | `app.rank.top_duration` | user_serv_duration |
| 流速趋势 | `app.trend.flux_trend` | user_flux_trend（5min/1hour/4hour） |
| 用户趋势 | `app.trend.user_trend` | user_access_trend |
| 域名访问 | `app.domain.access_rank` | domain_access |
| HTTP 分析 | `app.domain.http_type` | http_flux_midtable |
| 上网行为 | `app.behavior.action_rank` | action_collect |
| 论坛热帖 | `app.behavior.bbs_rank` | web_bbs |
| 即时通讯 | `app.behavior.im_rank` | im |
| 终端类型 | `app.terminal.term_rank` | term_type |
| 共享接入 | `app.terminal.share_rank` | share_access |
| 风险终端 | `app.terminal.risk_rank` | risk_term |
| 网关杀毒 | `app.terminal.virus_rank` | virus |
| 风险报表 | `app.risk.risk_report` | risk_report |
| 人员画像 | `app.risk.user_profile` | risk_report + action_collect |
| 数据导入 | `app.data.import` | api.t_load@custom（文档 2.3） |
| 视图生成 | `app.data.view` | api.t_view@custom（文档 2.4） |
| 表结构 | `app.meta.schema` / `app.meta.tables` | desc / 文档 2.1.5 |
| 定时任务 | `crond.collect@cus_insight` → `procedure.collect@cus_insight` | 每日汇总前一天数据 |

接口实现遵循示例应用约定：

- `bin/app/**.php` 用 `ldb_mapreduce_invoke("register", ..., $constructor)` 注册，`main($object, $params)` 内通过
  `ldb_output_arr(array("success" => true, "data" => ...))` 输出；失败设置 `$object->lasterr` 并返回 -1。
- 前端统一 `POST /launch.php?s=<token>`，请求体包含 `app_args.name`、`opr`、`filter.date`、`query_id`、`app_id`。

其他能力：

- 应用 id 反查：`api.core.result.reverse.app`（文档 2.2.1）
- 用户显示名反查：`api.core.result.reverse.user`（文档 2.2.2）
- SQL 语法遵循文档 2.1.4：`limit` TOPN、`group by`/`having`、`/* COLLECT: */`、`/* ORDER:int64_desc */`、
  `i()`/`b()`/`distinct_count`/`top_detail`/`ts_h` 等 UDF
- 大结果集可改用 `mdd=true` + `api.slice_utils@custom`（`badash_sql()` 已预留 `mdd` 参数；当前接口结果集较小，
  统一使用默认 JSON 输出）

## 二、目录结构

```
cus_insight/
├── version.js
├── config/
│   ├── package.chs.js / package.eng.js
│   └── status.default.chs.js / status.default.eng.js
├── bin/
│   ├── regedit.conf            注册表：task.crond
│   ├── lib/
│   │   ├── common.php          参数校验、日期区间、SQL 封装、JSON 清洗
│   │   ├── endpoint.php        接口注册 helper（对照 cus_demo 写法）
│   │   ├── reverse.php         应用/用户反查封装
│   │   └── tables.php          中间表元数据与白名单
│   ├── crond/collect.php       定时任务入口（拉起 procedure）
│   ├── procedure/collect.php   定时采集过程
│   └── app/
│       ├── overview/ rank/ trend/ domain/ behavior/ terminal/ risk/
│       ├── data/import.php     api.t_load@custom
│       ├── data/view.php       api.t_view@custom
│       ├── meta/schema.php     desc
│       ├── meta/tables.php     表清单
│       └── dsl/import.js       定时拉起采集过程的启动 DSL
└── web/ui/
    ├── index.html              前端入口
    ├── build.conf              构建配置（copy）
    ├── css/app.css
    ├── js/chart.js             纯 Canvas 图表（无第三方依赖）
    ├── js/app.js               单页多 Tab 看板
    └── img/logo.png、app_bg.jpg、preview-1~3.png
```

## 三、安装与打包

1. 将 `cus_insight` 目录压缩为 `cus_insight.zip`（压缩包名即应用 id，包内顶层目录为 `cus_insight/`）。
2. 在行为感知系统“自定义应用”页面上传，或放入 `store/cus_insight` 后重启对应服务。
3. 页面由平台以 `?token=...` 打开，前端自动请求 `/launch.php?s=<token>`；如需自建调试入口，
   可在加载前设置 `window.CUS_LAUNCH_URL` 覆盖请求地址。

## 四、接口参数

前端请求体（平台约定）：

```json
{
  "app_args": { "name": "app.overview.summary@cus_insight", "options": {} },
  "opr": "default",
  "filter": { "date": { "start": "2026-10-14", "end": "2026-10-20" } },
  "limit": 10,
  "query_id": "Query_...",
  "app_id": "cus_insight"
}
```

通用参数：

| 参数 | 说明 | 默认 |
| --- | --- | --- |
| filter.date.start / end | 起止日期，支持 `YYYY-MM-DD` 或 `YYYYMMDD` | 6 天前 / 今天 |
| limit | 排行条数 1~50 | 10 |

扩展参数：

- `app.rank.top_flux`：`dim=user|group`、`period=1day|1week|1month`
- `app.trend.flux_trend`、`app.trend.user_trend`：`period=5min|1hour|4hour`
- `app.domain.http_type`：`group=httptype|filetype`
- `app.data.import`：`table`、`path`、`date`、`app`
- `app.data.view`：文档 2.4.2 全部参数（`table`、`view`、`key`、`value`、`filter`、`period` 等）
- `app.meta.schema`：`table`

## 五、文档未明确处的处理

1. 目录结构与接口写法以 `示例应用/开发包/cus_demo.zip` 为准，不采用文档第 6 页图片推断的布局。
2. `bin/app/dsl/import.js` 为启动采集过程的真实 DSL 结构；`bv.js` 需通过页面“视图生成”调用
   `api.t_view@custom` 生成后，再按文档 1.2.2.3 加入 `task.build_mdd`（`import` / `bv`）配置。
3. `version.js`、`status.default.*.js` 内容按示例应用格式给出，`status.default` 默认不启用。
4. mdd 中的二进制字段使用 `i()` 提取器转换后再聚合；若现场版本提供自定义提取器
   （如 `extractor.base@cus_insight`），可在 `bin/lib/common.php` 中替换。
5. SQL 查询根路径按示例应用方式通过 `api.core.function` 的 `ldb_get_logdata_path()` 计算
   （Linux 为 `log_data/aclog/`，Windows 为 `log_data/dc/devid_00000000/`），不使用空路径。

## 六、安全说明

- SQL 查询的表名走 `bin/lib/tables.php` 白名单，避免拼接任意表名。
- 数据导入的表名按文档允许 `:` 分隔的多级路径，并做字符过滤；`path` 仅管理员可见。
- 日期、limit、枚举参数均做格式校验与范围限制。
- 视图生成面向管理员：`filter` 需按文档 2.4.2 的语法原样传入平台接口，请勿把该能力暴露给不可信用户。
- 前端所有输出使用 `textContent`，避免 XSS。
