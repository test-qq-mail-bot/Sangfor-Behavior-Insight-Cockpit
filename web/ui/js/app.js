(function () {
    'use strict';

    var APP_ID = 'cus_insight';
    var LAUNCH_URL = window.CUS_LAUNCH_URL || '/launch.php';
    var TOKEN = '';
    var querySeq = 0;

    function getUrlParam(name) {
        var href = window.location.href;
        try {
            href = parent.location.href;
        } catch (error) {
            href = window.location.href;
        }
        var reg = new RegExp('(^|\\?|&)' + name + '=([^&#]*)(\\s|&|$|#)', 'i');
        if (reg.test(href)) {
            return decodeURIComponent(RegExp.$2);
        }
        return '';
    }

    function uid() {
        querySeq += 1;
        return 'Query_' + (new Date()).getTime() + querySeq;
    }

    var state = {
        start: '',
        end: '',
        limit: 10,
        active: 'overview'
    };

    var panel = null;
    var statusEl = null;

    function pad(value) {
        return value < 10 ? '0' + value : '' + value;
    }

    function toInputDate(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function toApiDate(value) {
        return String(value || '').replace(/[^0-9]/g, '');
    }

    function toDash(value) {
        var text = String(value || '');
        if (text.length === 8) {
            return text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6, 8);
        }
        return text;
    }

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) {
            node.className = cls;
        }
        if (text !== undefined && text !== null) {
            node.textContent = String(text);
        }
        return node;
    }

    function clear(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function num(value) {
        var n = Number(value);
        if (!isFinite(n)) {
            n = 0;
        }
        return n.toLocaleString('zh-CN');
    }

    function bytes(value) {
        var n = Number(value);
        if (!isFinite(n) || n <= 0) {
            return '0 B';
        }
        var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        var index = 0;
        while (n >= 1024 && index < units.length - 1) {
            n = n / 1024;
            index++;
        }
        return (index === 0 ? n : n.toFixed(2)) + ' ' + units[index];
    }

    function duration(value) {
        var n = Number(value);
        if (!isFinite(n) || n <= 0) {
            return '0 秒';
        }
        if (n >= 86400) {
            return (n / 86400).toFixed(2) + ' 天';
        }
        if (n >= 3600) {
            return (n / 3600).toFixed(2) + ' 小时';
        }
        if (n >= 60) {
            return (n / 60).toFixed(1) + ' 分钟';
        }
        return Math.round(n) + ' 秒';
    }

    function params(extra) {
        var result = { start: state.start, end: state.end, limit: state.limit };
        if (extra) {
            for (var key in extra) {
                if (Object.prototype.hasOwnProperty.call(extra, key)) {
                    result[key] = extra[key];
                }
            }
        }
        return result;
    }

    function parseResponse(text) {
        var json;
        try {
            json = JSON.parse(text);
        } catch (error) {
            throw new Error('响应不是合法 JSON');
        }
        if (json && json.success === true) {
            return json.data;
        }
        if (json && json.code === 0) {
            return json.data;
        }
        throw new Error((json && (json.msg || json.message)) || '接口返回错误');
    }

    function send(url, data) {
        if (typeof window.fetch === 'function') {
            return window.fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.text();
            }).then(parseResponse);
        }
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) {
                    return;
                }
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error('HTTP ' + xhr.status));
                    return;
                }
                resolve(xhr.responseText);
            };
            xhr.onerror = function () {
                reject(new Error('network error'));
            };
            xhr.send(JSON.stringify(data));
        }).then(parseResponse);
    }

    function request(name, data) {
        var payload = {
            app_args: {
                name: name + '@' + APP_ID,
                options: {}
            },
            opr: 'default',
            filter: {
                date: {
                    start: toDash(state.start),
                    end: toDash(state.end)
                }
            },
            query_id: uid(),
            app_id: APP_ID
        };
        for (var key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key) &&
                data[key] !== undefined &&
                key !== 'start' &&
                key !== 'end') {
                payload[key] = data[key];
            }
        }
        var url = LAUNCH_URL + '?s=' + encodeURIComponent(TOKEN);
        return send(url, payload).catch(function (error) {
            if (error && error.name === 'TypeError') {
                throw new Error('接口请求失败，请确认页面由平台打开（token 缺失）');
            }
            throw error;
        });
    }

    function raf(callback) {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(callback);
        } else {
            window.setTimeout(callback, 16);
        }
    }

    function section(title, hint) {
        var node = el('div', 'section');
        var head = el('div', 'section-head');
        head.appendChild(el('h2', '', title));
        if (hint) {
            head.appendChild(el('span', 'hint', hint));
        }
        node.appendChild(head);
        var body = el('div', 'section-body');
        node.appendChild(body);
        return { node: node, body: body };
    }

    function renderTable(container, columns, rows) {
        if (!rows || rows.length === 0) {
            container.appendChild(el('div', 'empty', '暂无数据'));
            return;
        }
        var table = el('table', 'data');
        var thead = el('thead');
        var headRow = el('tr');
        for (var i = 0; i < columns.length; i++) {
            headRow.appendChild(el('th', '', columns[i].label));
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        var tbody = el('tbody');
        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var tr = el('tr');
            for (var c = 0; c < columns.length; c++) {
                var column = columns[c];
                var raw = typeof column.value === 'function' ? column.value(row) : row[column.key];
                var text;
                if (column.format) {
                    text = column.format(raw, row);
                } else if (raw === undefined || raw === null || raw === '') {
                    text = '-';
                } else {
                    text = raw;
                }
                tr.appendChild(el('td', column.num ? 'num' : '', text));
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);
    }

    function renderChart(container, type, payload) {
        var wrap = el('div', 'chart-wrap');
        var canvas = document.createElement('canvas');
        wrap.appendChild(canvas);
        container.appendChild(wrap);
        raf(function () {
            if (type === 'bar') {
                window.BadashChart.bar(canvas, payload);
            } else {
                window.BadashChart.line(canvas, payload.labels, payload.series);
            }
        });
    }

    function chips(container, items, current, onSelect) {
        clear(container);
        for (var i = 0; i < items.length; i++) {
            var chip = el('div', 'chip' + (items[i][0] === current ? ' active' : ''), items[i][1]);
            chip.setAttribute('data-value', items[i][0]);
            chip.onclick = (function (value) {
                return function () {
                    onSelect(value);
                };
            })(items[i][0]);
            container.appendChild(chip);
        }
    }

    function addCard(container, label, value, sub) {
        var card = el('div', 'card');
        card.appendChild(el('div', 'label', label));
        card.appendChild(el('div', 'value', value));
        if (sub) {
            card.appendChild(el('div', 'sub', sub));
        }
        container.appendChild(card);
    }

    function fail(root, message) {
        clear(root);
        root.appendChild(el('div', 'empty', message));
    }

    function loadOverview(root) {
        return request('app.overview.summary', params()).then(function (data) {
            var s = section('概览', data.start + ' ~ ' + data.end);
            var cards = el('div', 'cards');
            addCard(cards, '总流量', bytes(data.flux), '上下行合计');
            addCard(cards, '上行流量', bytes(data.up_flux));
            addCard(cards, '下行流量', bytes(data.down_flux));
            addCard(cards, '活跃用户', num(data.user_cnt));
            addCard(cards, '行为次数', num(data.event_cnt));
            addCard(cards, '访问域名', num(data.domain_cnt));
            addCard(cards, '风险次数', num(data.risk_cnt));
            s.body.appendChild(cards);
            root.appendChild(s.node);
        }).catch(function (error) {
            fail(root, error.message);
        });
    }

    function loadFlux(root) {
        var s = section('流量 TOP 排行', 'flux_duration_action / group_flux_midtable');
        var chipBar = el('div', 'chips');
        var body = el('div');
        s.body.appendChild(chipBar);
        s.body.appendChild(body);
        root.appendChild(s.node);

        var dim = 'user';
        var seq = 0;
        function render() {
            var current = ++seq;
            chips(chipBar, [['user', '按用户'], ['group', '按组']], dim, function (value) {
                dim = value;
                render();
            });
            clear(body);
            body.appendChild(el('div', 'loading', '加载中...'));
            request('app.rank.top_flux', params({ dim: dim })).then(function (data) {
                if (current !== seq) {
                    return;
                }
                clear(body);
                var rows = data.rows || [];
                renderChart(body, 'bar', rows.map(function (row) {
                    return { label: row.name || row.key, value: row.flux };
                }));
                var holder = el('div');
                var columns = [
                    { key: 'name', label: '名称' },
                    { key: 'flux', label: '总流量', num: true, format: bytes },
                    { key: 'up_flux', label: '上行', num: true, format: bytes },
                    { key: 'down_flux', label: '下行', num: true, format: bytes },
                    { key: 'cnt', label: '次数', num: true, format: num }
                ];
                if (dim === 'group') {
                    columns.unshift({ key: 'key', label: '组标识' });
                }
                renderTable(holder, columns, rows);
                body.appendChild(holder);
            }).catch(function (error) {
                if (current !== seq) {
                    return;
                }
                clear(body);
                body.appendChild(el('div', 'empty', error.message));
            });
        }
        render();
    }

    function loadDuration(root) {
        var s = section('应用时长 TOP 排行', 'user_serv_duration');
        root.appendChild(s.node);
        return request('app.rank.top_duration', params()).then(function (data) {
            var rows = data.rows || [];
            renderChart(s.body, 'bar', rows.map(function (row) {
                return { label: row.user_name || row.key, value: row.seconds };
            }));
            var holder = el('div');
            renderTable(holder, [
                { key: 'user_name', label: '用户' },
                { key: 'serv_name', label: '应用' },
                { key: 'seconds', label: '时长', num: true, format: duration },
                { key: 'flux', label: '流量', num: true, format: bytes }
            ], rows);
            s.body.appendChild(holder);
        }).catch(function (error) {
            fail(root, error.message);
        });
    }

    function trendModule(root, title, hint, apiName, periods, defaultPeriod, seriesBuilder) {
        var s = section(title, hint);
        var chipBar = el('div', 'chips');
        var body = el('div');
        s.body.appendChild(chipBar);
        s.body.appendChild(body);
        root.appendChild(s.node);

        var period = defaultPeriod;
        var seq = 0;
        function render() {
            var current = ++seq;
            chips(chipBar, periods, period, function (value) {
                period = value;
                render();
            });
            clear(body);
            body.appendChild(el('div', 'loading', '加载中...'));
            request(apiName, params({ period: period })).then(function (data) {
                if (current !== seq) {
                    return;
                }
                clear(body);
                var rows = data.rows || [];
                var labels = rows.map(function (row) {
                    return row.time_slice;
                });
                renderChart(body, 'line', { labels: labels, series: seriesBuilder(rows) });
            }).catch(function (error) {
                if (current !== seq) {
                    return;
                }
                clear(body);
                body.appendChild(el('div', 'empty', error.message));
            });
        }
        render();
    }

    function loadFluxTrend(root) {
        trendModule(
            root,
            '流速趋势',
            'user_flux_trend',
            'app.trend.flux_trend',
            [['5min', '5 分钟'], ['1hour', '1 小时'], ['4hour', '4 小时']],
            '1hour',
            function (rows) {
                return [
                    { name: '上行', data: rows.map(function (row) { return row.up_flux; }) },
                    { name: '下行', data: rows.map(function (row) { return row.down_flux; }) }
                ];
            }
        );
    }

    function loadUserTrend(root) {
        trendModule(
            root,
            '接入用户趋势',
            'user_access_trend',
            'app.trend.user_trend',
            [['5min', '5 分钟'], ['1hour', '1 小时'], ['4hour', '4 小时']],
            '1hour',
            function (rows) {
                return [
                    { name: '在线用户', data: rows.map(function (row) { return row.online_cnt; }) },
                    { name: '登录用户', data: rows.map(function (row) { return row.logon_cnt; }) }
                ];
            }
        );
    }

    function loadDomain(root) {
        var s = section('域名访问排行', 'domain_access');
        root.appendChild(s.node);
        return request('app.domain.access_rank', params()).then(function (data) {
            var rows = data.rows || [];
            renderChart(s.body, 'bar', rows.map(function (row) {
                return { label: row.key, value: row.flux };
            }));
            var holder = el('div');
            renderTable(holder, [
                { key: 'key', label: '域名' },
                { key: 'flux', label: '总流量', num: true, format: bytes },
                { key: 'cnt', label: '访问次数', num: true, format: num },
                { key: 'seconds', label: '时长', num: true, format: duration },
                { key: 'user_cnt', label: '用户数', num: true, format: num }
            ], rows);
            s.body.appendChild(holder);
        }).catch(function (error) {
            fail(root, error.message);
        });
    }

    function loadHttp(root) {
        var s = section('HTTP 协议分析', 'http_flux_midtable');
        var chipBar = el('div', 'chips');
        var body = el('div');
        s.body.appendChild(chipBar);
        s.body.appendChild(body);
        root.appendChild(s.node);

        var group = 'httptype';
        function render() {
            chips(chipBar, [['httptype', '协议类型'], ['filetype', '文件类型']], group, function (value) {
                group = value;
                render();
            });
            clear(body);
            body.appendChild(el('div', 'loading', '加载中...'));
            request('app.domain.http_type', params({ group: group })).then(function (data) {
                clear(body);
                var rows = data.rows || [];
                renderChart(body, 'bar', rows.map(function (row) {
                    return { label: row.key, value: row.flux };
                }));
                var holder = el('div');
                renderTable(holder, [
                    { key: 'key', label: group === 'filetype' ? '文件类型' : '协议' },
                    { key: 'flux', label: '总流量', num: true, format: bytes },
                    { key: 'user_cnt', label: '用户数', num: true, format: num }
                ], rows);
                body.appendChild(holder);
            }).catch(function (error) {
                clear(body);
                body.appendChild(el('div', 'empty', error.message));
            });
        }
        render();
    }

    function simpleRankModule(root, title, hint, apiName, columns, chartValue, chartLabel) {
        var s = section(title, hint);
        root.appendChild(s.node);
        return request(apiName, params()).then(function (data) {
            var rows = data.rows || [];
            if (chartValue) {
                renderChart(s.body, 'bar', rows.map(function (row) {
                    return { label: row[chartLabel || 'key'] || row.key, value: row[chartValue] };
                }));
            }
            var holder = el('div');
            renderTable(holder, columns, rows);
            s.body.appendChild(holder);
        }).catch(function (error) {
            fail(root, error.message);
        });
    }

    function loadBehavior(root) {
        return simpleRankModule(
            root,
            '上网行为排行',
            'action_collect',
            'app.behavior.action_rank',
            [
                { key: 'key', label: '行为类别' },
                { key: 'cnt', label: '次数', num: true, format: num },
                { key: 'user_cnt', label: '用户数', num: true, format: num }
            ],
            'cnt'
        );
    }

    function loadBbs(root) {
        return simpleRankModule(
            root,
            '论坛热帖访问',
            'web_bbs',
            'app.behavior.bbs_rank',
            [
                { key: 'title', label: '帖子标题' },
                { key: 'categories', label: '类别' },
                { key: 'cnt', label: '访问次数', num: true, format: num }
            ],
            'cnt',
            'title'
        );
    }

    function loadIm(root) {
        return simpleRankModule(
            root,
            '即时通讯排行',
            'im',
            'app.behavior.im_rank',
            [
                { key: 'key', label: '通讯工具' },
                { key: 'cnt', label: '会话次数', num: true, format: num },
                { key: 'user_cnt', label: '用户数', num: true, format: num },
                { key: 'session_cnt', label: '会话数', num: true, format: num }
            ],
            'cnt'
        );
    }

    function loadTerminal(root) {
        return simpleRankModule(
            root,
            '终端类型排行',
            'term_type',
            'app.terminal.term_rank',
            [
                { key: 'key', label: '终端类型' },
                { key: 'cnt', label: '接入数', num: true, format: num },
                { key: 'user_cnt', label: '用户数', num: true, format: num }
            ],
            'cnt'
        );
    }

    function loadShare(root) {
        return simpleRankModule(
            root,
            '共享接入排行',
            'share_access',
            'app.terminal.share_rank',
            [
                { key: 'user_name', label: '用户' },
                { key: 'terminal', label: '终端' },
                { key: 'shared_cnt', label: '共享终端数', num: true, format: num }
            ],
            'shared_cnt',
            'user_name'
        );
    }

    function loadRisk(root) {
        return simpleRankModule(
            root,
            '风险终端排行',
            'risk_term',
            'app.terminal.risk_rank',
            [
                { key: 'key', label: '威胁名称' },
                { key: 'risk_type', label: '风险类型' },
                { key: 'cnt', label: '次数', num: true, format: num },
                { key: 'user_cnt', label: '用户数', num: true, format: num }
            ],
            'cnt'
        );
    }

    function loadVirus(root) {
        return simpleRankModule(
            root,
            '网关杀毒排行',
            'virus',
            'app.terminal.virus_rank',
            [
                { key: 'key', label: '病毒类型' },
                { key: 'cnt', label: '威胁次数', num: true, format: num },
                { key: 'user_cnt', label: '用户数', num: true, format: num }
            ],
            'cnt'
        );
    }

    function loadRiskReport(root) {
        return simpleRankModule(
            root,
            '风险报表',
            'risk_report',
            'app.risk.risk_report',
            [
                { key: 'risk_type', label: '风险类别' },
                { key: 'risk_content', label: '风险内容' },
                { key: 'cnt', label: '次数', num: true, format: num },
                { key: 'user_cnt', label: '用户数', num: true, format: num }
            ],
            'cnt',
            'risk_content'
        );
    }

    function loadProfile(root) {
        return simpleRankModule(
            root,
            '人员行为画像',
            '风险权重 = 风险次数 × 3 + 行为次数',
            'app.risk.user_profile',
            [
                { key: 'user_name', label: '用户' },
                { key: 'risk_cnt', label: '风险次数', num: true, format: num },
                { key: 'action_cnt', label: '行为次数', num: true, format: num },
                { key: 'score', label: '风险分值', num: true, format: num }
            ],
            'score',
            'user_name'
        );
    }

    function formField(labelText, input) {
        var label = el('label');
        label.appendChild(el('span', '', labelText));
        label.appendChild(input);
        return label;
    }

    function loadImport(root) {
        var s = section('JSON 数据导入', 'api.t_load@custom（文档 2.3）');
        root.appendChild(s.node);

        var grid = el('div', 'form-grid');
        var tableInput = el('input');
        tableInput.value = 'badash_ext';
        var pathInput = el('input');
        pathInput.placeholder = '数据所在路径，支持目录或文件';
        var dateInput = el('input');
        dateInput.placeholder = 'YYYYMMDD，留空使用服务器当天';
        var appInput = el('input');
        appInput.value = APP_ID;

        grid.appendChild(formField('表名(table)', tableInput));
        grid.appendChild(formField('数据路径(path)', pathInput));
        grid.appendChild(formField('日期(date)', dateInput));
        grid.appendChild(formField('目标应用(app)', appInput));
        s.body.appendChild(grid);

        var actions = el('div', 'form-actions');
        var submit = el('button', 'btn-ghost', '开始导入');
        var result = el('span', 'result');
        actions.appendChild(submit);
        actions.appendChild(result);
        s.body.appendChild(actions);

        submit.onclick = function () {
            result.className = 'result';
            result.textContent = '导入中...';
            request('app.data.import', {
                table: tableInput.value,
                path: pathInput.value,
                date: dateInput.value,
                app: appInput.value
            }).then(function (data) {
                result.textContent = '导入成功：表 ' + data.table + '，日期 ' + data.date;
            }).catch(function (error) {
                result.className = 'result error';
                result.textContent = '导入失败：' + error.message;
            });
        };
    }

    function loadView(root) {
        var s = section('视图生成', 'api.t_view@custom（文档 2.4）');
        root.appendChild(s.node);

        var grid = el('div', 'form-grid');
        var textarea = el('textarea');
        textarea.value = JSON.stringify({
            table: 'badash_ext',
            view: 'bv_dept',
            key: '["dept"]',
            value: '[["cost,i,vint64"],["user"]]',
            filter: "(not_null(user) = '')",
            period: '1day',
            save_days: 180,
            forces: 1000,
            app: APP_ID,
            combine: 'ignore'
        }, null, 2);
        var wrapper = el('label');
        wrapper.appendChild(el('span', '', '视图参数（JSON，字段含义见文档 2.4.2）'));
        wrapper.appendChild(textarea);
        wrapper.style.gridColumn = '1 / -1';
        grid.appendChild(wrapper);
        s.body.appendChild(grid);

        var actions = el('div', 'form-actions');
        var submit = el('button', 'btn-ghost', '生成 DSL');
        var result = el('span', 'result');
        actions.appendChild(submit);
        actions.appendChild(result);
        s.body.appendChild(actions);

        submit.onclick = function () {
            var payload;
            try {
                payload = JSON.parse(textarea.value);
            } catch (error) {
                result.className = 'result error';
                result.textContent = 'JSON 格式错误：' + error.message;
                return;
            }
            result.className = 'result';
            result.textContent = '生成中...';
            request('app.data.view', payload).then(function (data) {
                result.textContent = 'DSL 已生成：' + (data.dsl || '');
            }).catch(function (error) {
                result.className = 'result error';
                result.textContent = '生成失败：' + error.message;
            });
        };
    }

    function loadMeta(root) {
        var s = section('可查询的 mdd 中间表', '文档 2.1.5，点击查看表结构');
        var body = el('div');
        s.body.appendChild(body);
        root.appendChild(s.node);

        var schemaSection = section('表结构', 'desc <table>');
        schemaSection.node.style.display = 'none';
        root.appendChild(schemaSection.node);

        body.appendChild(el('div', 'loading', '加载中...'));
        return request('app.meta.tables', {}).then(function (data) {
            clear(body);
            var list = el('div', 'table-list');
            var tables = data.tables || [];
            for (var i = 0; i < tables.length; i++) {
                var item = el('div', 'table-item');
                item.appendChild(el('strong', '', tables[i].title));
                item.appendChild(el('span', '', tables[i].name + ' · ' + tables[i].periods.join('/')));
                item.onclick = (function (table) {
                    return function () {
                        schemaSection.node.style.display = '';
                        clear(schemaSection.body);
                        schemaSection.body.appendChild(el('div', 'loading', '加载中...'));
                        request('app.meta.schema', { table: table }).then(function (schema) {
                            clear(schemaSection.body);
                            if (schema.columns) {
                                renderTable(schemaSection.body, [
                                    { key: 'name', label: '字段' },
                                    { key: 'type', label: '类型' },
                                    { key: 'params', label: '存储/备注' }
                                ], schema.columns);
                            } else {
                                var pre = el('pre', '', schema.raw || '');
                                schemaSection.body.appendChild(pre);
                            }
                        }).catch(function (error) {
                            clear(schemaSection.body);
                            schemaSection.body.appendChild(el('div', 'empty', error.message));
                        });
                    };
                })(tables[i].name);
                list.appendChild(item);
            }
            body.appendChild(list);
        }).catch(function (error) {
            clear(body);
            body.appendChild(el('div', 'empty', error.message));
        });
    }

    var modules = [
        { id: 'overview', title: '概览', load: loadOverview },
        { id: 'flux', title: '流量排行', load: loadFlux },
        { id: 'duration', title: '时长排行', load: loadDuration },
        { id: 'flux-trend', title: '流速趋势', load: loadFluxTrend },
        { id: 'user-trend', title: '用户趋势', load: loadUserTrend },
        { id: 'domain', title: '域名访问', load: loadDomain },
        { id: 'http', title: 'HTTP 分析', load: loadHttp },
        { id: 'behavior', title: '上网行为', load: loadBehavior },
        { id: 'bbs', title: '论坛热帖', load: loadBbs },
        { id: 'im', title: '即时通讯', load: loadIm },
        { id: 'terminal', title: '终端类型', load: loadTerminal },
        { id: 'share', title: '共享接入', load: loadShare },
        { id: 'risk', title: '风险终端', load: loadRisk },
        { id: 'virus', title: '网关杀毒', load: loadVirus },
        { id: 'risk-report', title: '风险报表', load: loadRiskReport },
        { id: 'profile', title: '人员画像', load: loadProfile },
        { id: 'import', title: '数据导入', load: loadImport },
        { id: 'view', title: '视图生成', load: loadView },
        { id: 'meta', title: '表结构', load: loadMeta }
    ];

    function setStatus(text, isError) {
        statusEl.textContent = text || '';
        statusEl.className = 'status' + (isError ? ' error' : '');
    }

    function renderTabs() {
        var tabs = document.getElementById('tabs');
        clear(tabs);
        for (var i = 0; i < modules.length; i++) {
            var tab = el('div', 'tab' + (modules[i].id === state.active ? ' active' : ''), modules[i].title);
            tab.onclick = (function (module) {
                return function () {
                    activate(module);
                };
            })(modules[i]);
            tabs.appendChild(tab);
        }
    }

    var activateSeq = 0;

    function activate(module) {
        var current = ++activateSeq;
        state.active = module.id;
        renderTabs();
        clear(panel);
        var view = el('div', 'view');
        var loading = el('div', 'loading', '加载中...');
        panel.appendChild(loading);
        panel.appendChild(view);
        setStatus('加载中...', false);
        var done = function () {
            if (loading.parentNode) {
                loading.parentNode.removeChild(loading);
            }
        };
        var result = module.load(view);
        if (result && typeof result.then === 'function') {
            result.then(function () {
                done();
                if (current === activateSeq) {
                    setStatus('已更新 ' + new Date().toLocaleTimeString('zh-CN'), false);
                }
            }).catch(function (error) {
                done();
                if (current === activateSeq) {
                    setStatus(error.message || '加载失败', true);
                }
            });
        } else {
            done();
            if (current === activateSeq) {
                setStatus('已更新 ' + new Date().toLocaleTimeString('zh-CN'), false);
            }
        }
    }

    function readFilters() {
        var start = toApiDate(document.getElementById('start-date').value);
        var end = toApiDate(document.getElementById('end-date').value);
        if (start.length === 8) {
            state.start = start;
        }
        if (end.length === 8) {
            state.end = end;
        }
        if (state.start > state.end) {
            var tmp = state.start;
            state.start = state.end;
            state.end = tmp;
        }
        state.limit = parseInt(document.getElementById('limit').value, 10) || 10;
    }

    function init() {
        panel = document.getElementById('panel');
        statusEl = document.getElementById('status');
        TOKEN = getUrlParam('token');

        var end = new Date();
        var start = new Date(end.getTime() - 6 * 86400000);
        document.getElementById('start-date').value = toInputDate(start);
        document.getElementById('end-date').value = toInputDate(end);
        document.getElementById('generated-at').textContent = '生成时间：' + new Date().toLocaleString('zh-CN');

        readFilters();
        renderTabs();

        document.getElementById('refresh').onclick = function () {
            readFilters();
            activate(modules.filter(function (item) {
                return item.id === state.active;
            })[0] || modules[0]);
        };

        document.getElementById('limit').onchange = function () {
            readFilters();
            activate(modules.filter(function (item) {
                return item.id === state.active;
            })[0] || modules[0]);
        };

        activate(modules[0]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
