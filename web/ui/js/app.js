(function () {
    'use strict';

    var APP_ID = 'cus_insight';
    var LAUNCH_URL = window.CUS_LAUNCH_URL || '/launch.php';
    var TABLE_LIMIT = 500;
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
        var result = { start: state.start, end: state.end, limit: TABLE_LIMIT };
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

    function tableRaw(column, row) {
        return typeof column.value === 'function' ? column.value(row) : row[column.key];
    }

    function tableRawString(column, row) {
        var raw = tableRaw(column, row);
        return raw === undefined || raw === null ? '' : String(raw);
    }

    function tableCellText(column, row) {
        var raw = tableRaw(column, row);
        if (column.format) {
            return column.format(raw, row);
        }
        if (raw === undefined || raw === null || raw === '') {
            return '-';
        }
        return String(raw);
    }

    function tableNumber(value) {
        if (value === undefined || value === null || value === '') {
            return null;
        }
        var number = Number(value);
        return isFinite(number) ? number : null;
    }

    function tableTextCompare(a, b) {
        var left = String(a === undefined || a === null ? '' : a);
        var right = String(b === undefined || b === null ? '' : b);
        try {
            return left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' });
        } catch (error) {
            left = left.toLowerCase();
            right = right.toLowerCase();
            if (left < right) {
                return -1;
            }
            if (left > right) {
                return 1;
            }
            return 0;
        }
    }

    function tablePageWindow(page, totalPages) {
        if (totalPages <= 5) {
            var all = [];
            for (var i = 1; i <= totalPages; i++) {
                all.push(i);
            }
            return all;
        }
        var start;
        var end;
        if (page <= 2) {
            start = 1;
            end = 5;
        } else if (page >= totalPages - 1) {
            start = totalPages - 4;
            end = totalPages;
        } else {
            start = page - 2;
            end = page + 2;
        }
        var pages = [];
        for (var n = start; n <= end; n++) {
            pages.push(n);
        }
        return pages;
    }

    function stopTableEvent(event) {
        event = event || window.event;
        if (event.stopPropagation) {
            event.stopPropagation();
        }
    }

    function renderTable(container, columns, rows, options) {
        columns = columns || [];
        rows = rows || [];
        options = options || {};

        var pageSize = options.pageSize || 10;
        var sortKey = options.defaultSortKey || (columns[0] ? columns[0].key : '');
        var sortDir = options.defaultSortDir === 'desc' ? 'desc' : 'asc';
        var page = 1;
        var openKey = null;
        var draft = null;
        var filters = {};

        for (var f = 0; f < columns.length; f++) {
            filters[columns[f].key] = [];
        }

        function findColumn(key) {
            for (var i = 0; i < columns.length; i++) {
                if (columns[i].key === key) {
                    return columns[i];
                }
            }
            return null;
        }

        function hasFilter(key) {
            return filters[key] && filters[key].length > 0;
        }

        function filteredRows(ignoreKey) {
            var result = [];
            for (var r = 0; r < rows.length; r++) {
                var row = rows[r];
                var keep = true;
                for (var c = 0; c < columns.length; c++) {
                    var column = columns[c];
                    var selected = filters[column.key];
                    if (column.key !== ignoreKey && selected && selected.length > 0) {
                        if (selected.indexOf(tableRawString(column, row)) === -1) {
                            keep = false;
                            break;
                        }
                    }
                }
                if (keep) {
                    result.push(row);
                }
            }
            return result;
        }

        function sortedRows(list) {
            var decorated = [];
            for (var i = 0; i < list.length; i++) {
                decorated.push({ row: list[i], index: i });
            }
            var column = findColumn(sortKey);
            decorated.sort(function (a, b) {
                var result = 0;
                if (column) {
                    var left = tableRaw(column, a.row);
                    var right = tableRaw(column, b.row);
                    var leftNumber = tableNumber(left);
                    var rightNumber = tableNumber(right);
                    if (leftNumber !== null && rightNumber !== null) {
                        if (leftNumber < rightNumber) {
                            result = -1;
                        } else if (leftNumber > rightNumber) {
                            result = 1;
                        }
                    } else {
                        result = tableTextCompare(left, right);
                    }
                }
                if (result === 0) {
                    return a.index - b.index;
                }
                return sortDir === 'asc' ? result : -result;
            });
            var output = [];
            for (var d = 0; d < decorated.length; d++) {
                output.push(decorated[d].row);
            }
            return output;
        }

        function tableOptions(key) {
            var column = findColumn(key);
            var list = filteredRows(key);
            var seen = {};
            var opts = [];
            for (var i = 0; i < list.length; i++) {
                var value = tableRawString(column, list[i]);
                if (!Object.prototype.hasOwnProperty.call(seen, value)) {
                    seen[value] = true;
                    opts.push({ value: value, label: tableCellText(column, list[i]) });
                }
            }
            opts.sort(function (a, b) {
                var left = tableNumber(a.value);
                var right = tableNumber(b.value);
                if (column.num && left !== null && right !== null) {
                    return left - right;
                }
                return tableTextCompare(a.label, b.label);
            });
            return opts;
        }

        function optionCounts(key) {
            var column = findColumn(key);
            var list = filteredRows(key);
            var counts = {};
            for (var i = 0; i < list.length; i++) {
                var value = tableRawString(column, list[i]);
                counts[value] = (counts[value] || 0) + 1;
            }
            return counts;
        }

        function pageCount() {
            return Math.max(1, Math.ceil(filteredRows().length / pageSize));
        }

        function changePage(value) {
            page = Math.min(Math.max(1, value), pageCount());
            openKey = null;
            draft = null;
            render();
        }

        function toggleSort(key) {
            if (sortKey === key) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortKey = key;
                sortDir = 'asc';
            }
            render();
        }

        function toggleFilter(key) {
            if (openKey === key) {
                openKey = null;
                draft = null;
            } else {
                openKey = key;
                draft = (filters[key] || []).slice();
            }
            render();
        }

        function setDraft(action) {
            if (!openKey) {
                return;
            }
            var opts = tableOptions(openKey);
            var values = [];
            for (var i = 0; i < opts.length; i++) {
                values.push(opts[i].value);
            }
            if (action === 'all') {
                draft = values;
            } else if (action === 'inverse') {
                var inverse = [];
                for (var v = 0; v < values.length; v++) {
                    if (draft.indexOf(values[v]) === -1) {
                        inverse.push(values[v]);
                    }
                }
                draft = inverse;
            } else if (action === 'duplicates' || action === 'unique') {
                var counts = optionCounts(openKey);
                var picked = [];
                for (var p = 0; p < values.length; p++) {
                    var count = counts[values[p]] || 0;
                    if ((action === 'duplicates' && count > 1) ||
                        (action === 'unique' && count === 1)) {
                        picked.push(values[p]);
                    }
                }
                draft = picked;
            }
            render();
        }

        function selectDraft(value, checked) {
            if (!draft) {
                draft = [];
            }
            var index = draft.indexOf(value);
            if (checked && index === -1) {
                draft.push(value);
            } else if (!checked && index !== -1) {
                draft.splice(index, 1);
            }
        }

        function applyDraft() {
            if (!openKey) {
                return;
            }
            filters[openKey] = draft ? draft.slice() : [];
            openKey = null;
            draft = null;
            var last = pageCount();
            if (page > last) {
                page = last;
            }
            render();
        }

        function clearDraft() {
            draft = [];
            render();
        }

        function sortFromPanel(direction) {
            if (!openKey) {
                return;
            }
            sortKey = openKey;
            sortDir = direction;
            render();
        }

        function buildFilterPanel(column) {
            var panel = el('div', 'filter-panel');
            panel.onclick = stopTableEvent;

            var head = el('div', 'filter-panel-head');
            head.appendChild(el('span', 'filter-title', column.label + ' 筛选'));
            panel.appendChild(head);

            var sortActions = el('div', 'filter-sort');
            var asc = el('button', 'filter-link' + (sortKey === column.key && sortDir === 'asc' ? ' active' : ''), '升序');
            asc.type = 'button';
            asc.onclick = function () {
                sortFromPanel('asc');
            };
            var desc = el('button', 'filter-link' + (sortKey === column.key && sortDir === 'desc' ? ' active' : ''), '降序');
            desc.type = 'button';
            desc.onclick = function () {
                sortFromPanel('desc');
            };
            sortActions.appendChild(asc);
            sortActions.appendChild(desc);
            panel.appendChild(sortActions);

            var tools = el('div', 'filter-tools');
            var toolActions = [
                ['all', '全选'],
                ['inverse', '反选'],
                ['duplicates', '重复项'],
                ['unique', '唯一项']
            ];
            for (var t = 0; t < toolActions.length; t++) {
                (function (action, label) {
                    var button = el('button', 'filter-link', label);
                    button.type = 'button';
                    button.onclick = function () {
                        setDraft(action);
                    };
                    tools.appendChild(button);
                })(toolActions[t][0], toolActions[t][1]);
            }
            panel.appendChild(tools);

            var list = el('div', 'filter-list');
            var opts = tableOptions(column.key);
            if (opts.length === 0) {
                list.appendChild(el('div', 'filter-empty', '暂无可选项'));
            } else {
                for (var o = 0; o < opts.length; o++) {
                    (function (item) {
                        var label = el('label', 'filter-option');
                        var input = document.createElement('input');
                        input.type = 'checkbox';
                        input.checked = draft.indexOf(item.value) !== -1;
                        input.onchange = function () {
                            selectDraft(item.value, input.checked);
                        };
                        label.appendChild(input);
                        label.appendChild(el('span', '', item.label));
                        list.appendChild(label);
                    })(opts[o]);
                }
            }
            panel.appendChild(list);

            var foot = el('div', 'filter-foot');
            var apply = el('button', 'btn-primary filter-apply', '应用');
            apply.type = 'button';
            apply.onclick = applyDraft;
            var clearButton = el('button', 'filter-clear', '清空');
            clearButton.type = 'button';
            clearButton.onclick = clearDraft;
            foot.appendChild(apply);
            foot.appendChild(clearButton);
            panel.appendChild(foot);

            return panel;
        }

        function render() {
            var filtered = sortedRows(filteredRows());
            var total = filtered.length;
            var totalPages = Math.max(1, Math.ceil(total / pageSize));
            if (page > totalPages) {
                page = totalPages;
            }
            if (page < 1) {
                page = 1;
            }
            var start = (page - 1) * pageSize;
            var visible = filtered.slice(start, start + pageSize);

            clear(container);
            var table = el('table', 'data');
            var thead = el('thead');
            var headRow = el('tr');

            for (var c = 0; c < columns.length; c++) {
                (function (column) {
                    var th = el('th');
                    var wrap = el('div', 'th-wrap');
                    var area = el('div', 'sort-area');
                    area.appendChild(el('span', 'sort-label', column.label));
                    if (sortKey === column.key) {
                        area.appendChild(el('span', 'sort-icon', sortDir === 'asc' ? '↑' : '↓'));
                    }
                    wrap.appendChild(area);

                    var button = el('button', 'filter-btn' + (hasFilter(column.key) ? ' active' : ''), hasFilter(column.key) ? '已筛选' : '筛选');
                    button.type = 'button';
                    button.onclick = function (event) {
                        stopTableEvent(event);
                        toggleFilter(column.key);
                    };
                    wrap.appendChild(button);

                    if (openKey === column.key) {
                        wrap.appendChild(buildFilterPanel(column));
                    }

                    th.appendChild(wrap);
                    th.onclick = function () {
                        toggleSort(column.key);
                    };
                    headRow.appendChild(th);
                })(columns[c]);
            }

            thead.appendChild(headRow);
            table.appendChild(thead);

            var tbody = el('tbody');
            if (visible.length === 0) {
                var emptyRow = el('tr');
                var emptyCell = el('td', 'table-empty');
                emptyCell.colSpan = columns.length;
                emptyCell.appendChild(el('div', 'empty', '暂无符合条件的数据'));
                emptyRow.appendChild(emptyCell);
                tbody.appendChild(emptyRow);
            } else {
                for (var r = 0; r < visible.length; r++) {
                    var row = visible[r];
                    var tr = el('tr');
                    for (var col = 0; col < columns.length; col++) {
                        tr.appendChild(el('td', columns[col].num ? 'num' : '', tableCellText(columns[col], row)));
                    }
                    tbody.appendChild(tr);
                }
            }
            table.appendChild(tbody);
            container.appendChild(table);

            var footer = el('div', 'table-footer');
            footer.appendChild(el('div', 'table-total', '共 ' + total + ' 条'));

            var sizeBox = el('label', 'page-size');
            sizeBox.appendChild(el('span', '', '每页'));
            var sizeSelect = document.createElement('select');
            var sizes = [10, 20, 50, 100];
            for (var s = 0; s < sizes.length; s++) {
                var option = document.createElement('option');
                option.value = String(sizes[s]);
                option.textContent = sizes[s] + ' 条/页';
                if (sizes[s] === pageSize) {
                    option.selected = true;
                }
                sizeSelect.appendChild(option);
            }
            sizeSelect.onchange = function () {
                pageSize = parseInt(sizeSelect.value, 10) || 10;
                page = 1;
                openKey = null;
                draft = null;
                render();
            };
            sizeBox.appendChild(sizeSelect);
            footer.appendChild(sizeBox);

            var pager = el('div', 'pager');
            var prev = el('button', 'page-arrow', '‹');
            prev.type = 'button';
            prev.title = '上一页';
            prev.disabled = page <= 1;
            prev.onclick = function () {
                changePage(page - 1);
            };
            pager.appendChild(prev);

            function appendPage(number) {
                var button = el('button', 'page-number' + (number === page ? ' active' : ''), number);
                button.type = 'button';
                button.onclick = function () {
                    changePage(number);
                };
                pager.appendChild(button);
            }

            function appendEllipsis() {
                pager.appendChild(el('span', 'page-ellipsis', '...'));
            }

            var windowPages = tablePageWindow(page, totalPages);
            if (windowPages[0] > 1) {
                appendPage(1);
                if (windowPages[0] > 2) {
                    appendEllipsis();
                }
            }
            for (var w = 0; w < windowPages.length; w++) {
                appendPage(windowPages[w]);
            }
            var windowLast = windowPages[windowPages.length - 1];
            if (windowLast < totalPages) {
                if (windowLast < totalPages - 1) {
                    appendEllipsis();
                }
                appendPage(totalPages);
            }

            var next = el('button', 'page-arrow', '›');
            next.type = 'button';
            next.title = '下一页';
            next.disabled = page >= totalPages;
            next.onclick = function () {
                changePage(page + 1);
            };
            pager.appendChild(next);
            footer.appendChild(pager);

            container.appendChild(footer);
        }

        document.addEventListener('click', function (event) {
            if (!container.parentNode || !openKey) {
                return;
            }
            var target = event.target;
            while (target) {
                if (target === container) {
                    return;
                }
                target = target.parentNode;
            }
            openKey = null;
            draft = null;
            render();
        });

        render();
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
                renderChart(body, 'bar', rows.slice(0, 10).map(function (row) {
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
            renderChart(s.body, 'bar', rows.slice(0, 10).map(function (row) {
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
            renderChart(s.body, 'bar', rows.slice(0, 10).map(function (row) {
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
                renderChart(body, 'bar', rows.slice(0, 10).map(function (row) {
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
                renderChart(s.body, 'bar', rows.slice(0, 10).map(function (row) {
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

        activate(modules[0]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
