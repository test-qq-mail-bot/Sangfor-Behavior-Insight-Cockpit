{
    "name": "行为洞察驾驶舱",
    "category": ["/custom/"],
    "system": {
        "lang": "chs",
        "env": "all",
        "inside": false
    },
    "description": "基于行为感知系统 mdd 中间表的全功能分析看板：流量与时长排行、流速趋势、域名与 HTTP 协议分析、上网行为、终端接入、风险终端与人员画像，并支持 JSON 数据导入、视图生成与表结构查看。",
    "author": "cus_insight 开发组",
    "size": "136K",
    "last_modify": "2026-10-22 00:00:00",
    "logo": "./img/logo.png",
    "background": "./img/app_bg.jpg",
    "color": "#2c58c9",
    "bbs_href": "",
    "preview": [
        "./img/preview-1.png",
        "./img/preview-2.png",
        "./img/preview-3.png"
    ],
    "history": [],
    "update_log": [
        "20261022-v6：修复 32 位 PHP 下流量、趋势与画像统计被截断为 2GB 的问题",
        "20261022-v6：数据表格新增字段排序、筛选联动、分页及每页条数切换",
        "20261021-v5：修复 api.sql@custom 参数传递错误，普通查询不再只返回 mdd 路径，恢复全站数据",
        "20261021-v5：修复风险概览、风险终端、人员画像误用 risk_term，改查 risk_report 并对 count 使用 i()",
        "20261021-v5：修复终端类型/共享接入使用 max 聚合、表结构接口返回空列的问题",
        "20261021-v4：修复排行类接口中 GROUP BY 字段与 SELECT 别名不一致导致的 not found ... in select fields 错误",
        "20261021-v3：修复 common.php 注释中的 */ 提前结束块注释，导致 launch.php 返回 HTTP 500 的问题",
        "20261021-v2：修复 SQL 根路径、重复加载保护与接口错误返回"
    ]
}
