(function (global) {
    'use strict';

    var COLORS = ['#2c58c9', '#22a06b', '#e07b39', '#8e44ad', '#c0392b', '#0f8b8d'];

    function colorAt(index) {
        return COLORS[index % COLORS.length];
    }

    function prepare(canvas) {
        var dpr = window.devicePixelRatio || 1;
        var width = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 640;
        var height = canvas.clientHeight || parseInt(canvas.getAttribute('height'), 10) || 280;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        return { ctx: ctx, width: width, height: height };
    }

    function niceMax(value) {
        if (!isFinite(value) || value <= 0) {
            return 1;
        }
        var exp = Math.pow(10, Math.floor(Math.log(value) / Math.LN10));
        var unit = value / exp;
        var step = 1;
        if (unit > 5) {
            step = 10;
        } else if (unit > 2) {
            step = 5;
        } else if (unit > 1) {
            step = 2;
        }
        return step * exp;
    }

    function shorten(label, max) {
        var text = String(label === undefined || label === null ? '' : label);
        if (text.length <= max) {
            return text;
        }
        return text.slice(0, max - 1) + '…';
    }

    function compact(value) {
        var num = Number(value) || 0;
        var abs = Math.abs(num);
        if (abs >= 100000000) {
            return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
        }
        if (abs >= 10000) {
            return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万';
        }
        return String(Math.round(num * 10) / 10);
    }

    function fitLabel(ctx, label, maxWidth, minChars) {
        var text = String(label === undefined || label === null ? '' : label);
        if (ctx.measureText(text).width <= maxWidth) {
            return text;
        }
        while (text.length > minChars && ctx.measureText(text + '…').width > maxWidth) {
            text = text.slice(0, text.length - 1);
        }
        return text + '…';
    }

    function drawEmpty(state, message) {
        var ctx = state.ctx;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px "Microsoft YaHei", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(message || '暂无数据', state.width / 2, state.height / 2);
    }

    function drawYAxis(state, box, maxValue, steps, formatValue) {
        var ctx = state.ctx;
        ctx.strokeStyle = '#e6ebf2';
        ctx.fillStyle = '#7b8794';
        ctx.font = '11px "Microsoft YaHei", Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.lineWidth = 1;
        for (var i = 0; i <= steps; i++) {
            var y = box.top + (box.height / steps) * i;
            var value = maxValue - (maxValue / steps) * i;
            var text = formatValue ? formatValue(value) : compact(value);
            ctx.beginPath();
            ctx.moveTo(box.left, y);
            ctx.lineTo(box.left + box.width, y);
            ctx.stroke();
            ctx.fillText(shorten(text, 12), box.left - 6, y + 4);
        }
    }

    function bar(canvas, items, options) {
        var state = prepare(canvas);
        var ctx = state.ctx;
        if (!items || items.length === 0) {
            drawEmpty(state, (options && options.emptyText) || '暂无数据');
            return;
        }
        var formatValue = (options && options.formatValue) || compact;
        var box = { left: 56, top: 16, width: state.width - 76, height: state.height - 52 };
        var maxValue = 0;
        for (var i = 0; i < items.length; i++) {
            var v = Number(items[i].value) || 0;
            if (v > maxValue) {
                maxValue = v;
            }
        }
        maxValue = niceMax(maxValue);
        drawYAxis(state, box, maxValue, 5, formatValue);

        var slot = box.width / items.length;
        var barWidth = Math.max(6, Math.min(42, slot * 0.55));
        ctx.textAlign = 'center';
        ctx.font = '11px "Microsoft YaHei", Arial, sans-serif';

        for (var j = 0; j < items.length; j++) {
            var value = Number(items[j].value) || 0;
            var h = maxValue === 0 ? 0 : (value / maxValue) * box.height;
            var x = box.left + slot * j + (slot - barWidth) / 2;
            var y = box.top + box.height - h;

            var gradient = ctx.createLinearGradient(0, y, 0, box.top + box.height);
            gradient.addColorStop(0, colorAt(j));
            gradient.addColorStop(1, '#a9c0f5');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, h);

            ctx.fillStyle = '#5b6b7c';
            ctx.fillText(fitLabel(ctx, items[j].label, Math.max(26, slot * 0.6), 2), x + barWidth / 2, box.top + box.height + 16);
            if (h > 18) {
                ctx.fillStyle = '#334155';
                ctx.fillText(formatValue(value), x + barWidth / 2, y - 4);
            }
        }
    }

    function line(canvas, labels, series, options) {
        var state = prepare(canvas);
        var ctx = state.ctx;
        if (!labels || labels.length === 0 || !series || series.length === 0) {
            drawEmpty(state, (options && options.emptyText) || '暂无数据');
            return;
        }
        var formatValue = (options && options.formatValue) || compact;
        var box = { left: 56, top: 40, width: state.width - 76, height: state.height - 76 };
        var maxValue = 0;
        for (var s = 0; s < series.length; s++) {
            for (var p = 0; p < series[s].data.length; p++) {
                var v = Number(series[s].data[p]) || 0;
                if (v > maxValue) {
                    maxValue = v;
                }
            }
        }
        maxValue = niceMax(maxValue);
        drawYAxis(state, box, maxValue, 5, formatValue);

        var stepX = labels.length > 1 ? box.width / (labels.length - 1) : 0;

        ctx.textAlign = 'center';
        ctx.font = '11px "Microsoft YaHei", Arial, sans-serif';
        var labelStep = Math.ceil(labels.length / 6);
        for (var l = 0; l < labels.length; l++) {
            if (l % labelStep !== 0 && l !== labels.length - 1) {
                continue;
            }
            ctx.fillStyle = '#7b8794';
            var text = String(labels[l]);
            var labelX = box.left + stepX * l;
            var half = ctx.measureText(text).width / 2;
            if (labelX + half > box.left + box.width) {
                labelX = box.left + box.width - half;
            }
            if (labelX - half < box.left) {
                labelX = box.left + half;
            }
            ctx.fillText(text, labelX, box.top + box.height + 16);
        }

        for (var k = 0; k < series.length; k++) {
            ctx.strokeStyle = colorAt(k);
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (var m = 0; m < series[k].data.length; m++) {
                var value = Number(series[k].data[m]) || 0;
                var x = box.left + stepX * m;
                var y = box.top + box.height - (maxValue === 0 ? 0 : (value / maxValue) * box.height);
                if (m === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();

            ctx.fillStyle = colorAt(k);
            for (var n = 0; n < series[k].data.length; n++) {
                var val = Number(series[k].data[n]) || 0;
                var px = box.left + stepX * n;
                var py = box.top + box.height - (maxValue === 0 ? 0 : (val / maxValue) * box.height);
                ctx.beginPath();
                ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        var legendX = box.left;
        var legendY = box.top - 18;
        ctx.textAlign = 'left';
        for (var t = 0; t < series.length; t++) {
            ctx.fillStyle = colorAt(t);
            ctx.fillRect(legendX, legendY - 7, 10, 10);
            ctx.fillStyle = '#475569';
            ctx.fillText(series[t].name, legendX + 15, legendY + 2);
            legendX += 18 + ctx.measureText(series[t].name).width + 16;
        }
    }

    global.BadashChart = {
        bar: bar,
        line: line,
        colorAt: colorAt
    };
})(window);
