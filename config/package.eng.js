{
    "name": "Behavior Insight Cockpit",
    "category": ["/custom/"],
    "system": {
        "lang": "eng",
        "env": "all",
        "inside": false
    },
    "description": "A full-featured dashboard built on mdd midtables of the Behavior Awareness System: traffic and duration ranking, flow trend, domain and HTTP protocol analysis, web behavior, terminal access, risk terminals and user profile. Supports JSON import, view generation and schema inspection.",
    "author": "cus_insight team",
    "size": "136K",
    "last_modify": "2026-10-22 10:51:43",
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
        "20261022-v1: show traffic chart values in readable B/KB/MB/GB/TB units",
        "20261022-v1: compute total traffic as upload plus download for consistent overview and rankings",
        "20261022-v6: fix traffic, trend and profile totals truncated to 2GB on 32-bit PHP",
        "20261022-v6: add column sorting, linked filters, pagination and page-size switching",
        "20261021-v5: fix api.sql@custom arguments so queries return rows instead of only an mdd path",
        "20261021-v5: use risk_report instead of the missing risk_term table and convert count with i()",
        "20261021-v5: fix terminal/share aggregation and empty schema columns",
        "20261021-v4: fix \"not found ... in select fields\" by grouping on SELECT aliases in ranking endpoints",
        "20261021-v3: fix HTTP 500 caused by */ ending a block comment early in common.php",
        "20261021-v2: fix SQL root path, duplicate include guard and API error response"
    ]
}
