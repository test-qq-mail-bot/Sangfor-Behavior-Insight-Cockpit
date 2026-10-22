<?php
/**
 * cus_insight 公共函数库
 * 依据《自定义应用开发说明文档》第 2.1 节 api.sql@custom 接口实现。
 */

if (!function_exists('badash_params')) {

    function badash_params()
    {
        $params = array();
        if (isset($GLOBALS['params']) && is_array($GLOBALS['params'])) {
            $params = $GLOBALS['params'];
        }
        $sources = array($_GET, $_POST);
        foreach ($sources as $src) {
            if (is_array($src)) {
                foreach ($src as $key => $value) {
                    if ($value !== null && $value !== '') {
                        $params[$key] = $value;
                    }
                }
            }
        }
        $raw = file_get_contents('php://input');
        if (is_string($raw) && strlen($raw) > 0) {
            $json = json_decode($raw, true);
            if (is_array($json)) {
                foreach ($json as $key => $value) {
                    $params[$key] = $value;
                }
            }
        }
        return $params;
    }

    function badash_param($params, $key, $default)
    {
        if (isset($params[$key]) && !is_array($params[$key]) && $params[$key] !== '') {
            return $params[$key];
        }
        return $default;
    }

    function badash_int($params, $key, $default, $min, $max)
    {
        $value = intval(badash_param($params, $key, $default));
        if ($value < $min) {
            $value = $min;
        }
        if ($value > $max) {
            $value = $max;
        }
        return $value;
    }

    function badash_escape($value)
    {
        $value = (string)$value;
        $value = str_replace('\\', '', $value);
        $value = str_replace("\0", '', $value);
        $value = str_replace("\r", ' ', $value);
        $value = str_replace("\n", ' ', $value);
        $value = str_replace("'", "''", $value);
        return $value;
    }

    function badash_allowed($value, $allowed, $default)
    {
        $value = strtolower(trim((string)$value));
        if (in_array($value, $allowed, true)) {
            return $value;
        }
        return $default;
    }

    /**
     * 校验 YYYYMMDD 日期，返回起止日期（含首尾）。
     */
    function badash_valid_date($value)
    {
        if (strlen($value) !== 8) {
            return false;
        }
        return checkdate(
            intval(substr($value, 4, 2)),
            intval(substr($value, 6, 2)),
            intval(substr($value, 0, 4))
        );
    }

    function badash_date_range($params)
    {
        $filter = isset($params['filter']) && is_array($params['filter']) ? $params['filter'] : array();
        $date = isset($filter['date']) && is_array($filter['date']) ? $filter['date'] : array();
        $start = isset($date['start']) && !is_array($date['start']) ? $date['start'] : badash_param($params, 'start', date('Ymd', time() - 6 * 86400));
        $end = isset($date['end']) && !is_array($date['end']) ? $date['end'] : badash_param($params, 'end', date('Ymd'));
        $start = preg_replace('/[^0-9]/', '', (string)$start);
        $end = preg_replace('/[^0-9]/', '', (string)$end);
        if (!badash_valid_date($end)) {
            $end = date('Ymd');
        }
        if (!badash_valid_date($start)) {
            $start = date('Ymd', time() - 6 * 86400);
        }
        if ($start > $end) {
            $tmp = $start;
            $start = $end;
            $end = $tmp;
        }
        return array($start, $end);
    }

    /**
     * 构造 mdd 中间表路径，语法见文档 2.1.5 与 2.5.2.1.1：
     * 形如 [0-9]* 前缀 + /midtable/<table>/<period>,<start>-<end>
     */
    function badash_table($table, $period, $start, $end)
    {
        $table = preg_replace('/[^a-z0-9_]/', '', strtolower($table));
        $period = preg_replace('/[^a-z0-9_]/', '', strtolower($period));
        return '`[0-9]*/midtable/' . $table . '/' . $period . ',' . $start . '-' . $end . '`';
    }

    function badash_query_id($name, $params)
    {
        return 'cus_insight_' . $name . '_' . md5(json_encode($params)) . '_' . uniqid();
    }

    /**
     * 查询数据根路径，写法对照示例应用 cus_demo。
     */
    function badash_root()
    {
        static $root = null;
        if ($root !== null) {
            return $root;
        }
        $root = '';
        if (!function_exists('ldb_require')) {
            return $root;
        }
        $funcs = ldb_require('api.core.function');
        if (!is_object($funcs) || !isset($funcs->ldb_get_logdata_path)) {
            return $root;
        }
        $log_dir = call_user_func($funcs->ldb_get_logdata_path);
        if (!is_string($log_dir) || $log_dir === '') {
            return $root;
        }
        $is_linux = true;
        if (isset($funcs->ldb_is_linux)) {
            $is_linux = call_user_func($funcs->ldb_is_linux);
        }
        if ($is_linux === false) {
            $root = $log_dir . '/log_data/dc/devid_00000000/';
        } else {
            $root = $log_dir . '/log_data/aclog/';
        }
        return $root;
    }

    function badash_error($message)
    {
        if (function_exists('ldb_error')) {
            ldb_error('[cus_insight] ' . $message);
        }
    }

    function badash_info($message)
    {
        if (function_exists('ldb_info')) {
            ldb_info('[cus_insight] ' . $message);
        }
    }

    function badash_last_error($message = null)
    {
        static $last = '';
        if ($message !== null) {
            $last = (string)$message;
        }
        return $last;
    }

    /**
     * 调用平台 SQL 查询组件 api.sql@custom（文档 2.1.2 示例写法）。
     */
    function badash_sql($query_id, $sql_str, $mdd, $output)
    {
        $args = array(
            'query_id' => $query_id,
            'app_args' => array(
                'options' => array(badash_root(), $sql_str),
            ),
        );
        if (is_array($output) && count($output) > 0) {
            $args['output'] = $output;
        }
        if ($mdd) {
            $args['mdd'] = true;
        }

        $sql = ldb_invoke('call_func', 'api.sql@custom');
        if (!is_object($sql)) {
            badash_last_error('invoke api.sql@custom failed');
            badash_error('invoke api.sql@custom failed');
            return null;
        }
        $ret = call_user_func($sql->main, $sql, $args);
        if ($ret === -1) {
            $err = call_user_func($sql->error, $sql);
            badash_last_error('execute sql failed: ' . $err);
            badash_error('execute sql failed: ' . $err . ' root=' . badash_root() . ' sql=' . $sql_str);
            return null;
        }
        if (is_string($ret)) {
            $decoded = json_decode($ret, true);
            if ($decoded === null) {
                return $ret;
            }
            $ret = $decoded;
        }
        return $ret;
    }

    /**
     * 将结果集规范化为行数组，去掉平台自带的 $ID 字段。
     */
    function badash_rows($ret)
    {
        $rows = array();
        if (!is_array($ret)) {
            return $rows;
        }
        foreach ($ret as $row) {
            if (!is_array($row)) {
                continue;
            }
            if (array_key_exists('$ID', $row)) {
                unset($row['$ID']);
            }
            $rows[] = $row;
        }
        return $rows;
    }

    function badash_num($value)
    {
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value)) {
            return is_finite($value) ? $value : 0;
        }
        $text = trim((string)$value);
        if ($text === '' || !is_numeric($text)) {
            return 0;
        }
        $number = (float)$text;
        if (!is_finite($number)) {
            return 0;
        }
        if ($number >= -2147483647.0 && $number <= 2147483647.0) {
            return (int)$number;
        }
        return $number;
    }

    function badash_i64($value)
    {
        if (is_int($value) || is_float($value)) {
            return $value;
        }
        $text = (string)$value;
        $length = strlen($text);
        if ($length === 8) {
            $part = unpack('V2', $text);
            return $part[1] + $part[2] * 4294967296.0;
        }
        if ($length === 4) {
            $part = unpack('V', $text);
            return $part[1];
        }
        if ($length === 2) {
            $part = unpack('n', $text);
            return $part[1];
        }
        if ($length === 1) {
            return ord($text);
        }
        $trimmed = trim($text);
        if ($trimmed !== '' && is_numeric($trimmed)) {
            return (float)$trimmed;
        }
        return 0;
    }

    function badash_i64set($value)
    {
        $text = (string)$value;
        $length = strlen($text);
        if ($length >= 3 && (($length - 1) % 2) === 0) {
            $count = ord($text[0]);
            if ($count === (($length - 1) / 2)) {
                $sum = 0;
                for ($index = 0; $index < $count; $index++) {
                    $part = unpack('n', substr($text, 1 + $index * 2, 2));
                    $sum += $part[1];
                }
                return $sum;
            }
        }
        return badash_i64($value);
    }

    function badash_period_slices($period)
    {
        if ($period === '5min') {
            return 288;
        }
        if ($period === '4hour') {
            return 6;
        }
        return 24;
    }

    function badash_terminal_label($value)
    {
        $number = badash_i64($value);
        $high = ((int)floor($number / 65536)) & 0xFFFF;
        $low = ((int)$number) & 0xFFFF;
        $types = array(0x0100 => 'PC', 0x0300 => 'Android', 0x0B00 => 'iOS', 1 => 'PC', 3 => 'Android', 11 => 'iOS');
        $platforms = array(0x2000 => 'Web', 0x4000 => '客户端', 0x4400 => '其他');
        $type = isset($types[$high]) ? $types[$high] : '终端' . $high;
        if (isset($platforms[$low])) {
            return $type . '（' . $platforms[$low] . '）';
        }
        if ($low === 0) {
            return $type;
        }
        return $type . '（0x' . dechex($low) . '）';
    }

    /**
     * 把某列转成数值（mdd 结果都是字符串）。
     */
    function badash_rows_int($rows, $field)
    {
        foreach ($rows as $index => $row) {
            if (isset($row[$field])) {
                $rows[$index][$field] = badash_num($row[$field]);
            }
        }
        return $rows;
    }

    /**
     * mdd 中可能存在的非 UTF-8 字节串会让 json_encode 返回 false，
     * 这里递归清洗后再输出，避免前端收到空响应。
     */
    function badash_scrub_utf8($value)
    {
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $value);
            if (is_string($converted) && preg_match('//u', $converted) === 1) {
                return $converted;
            }
            $converted = @iconv('GBK', 'UTF-8//IGNORE', $value);
            if (is_string($converted) && $converted !== '' && preg_match('//u', $converted) === 1) {
                return $converted;
            }
        }
        return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value);
    }

    function badash_json_safe($value)
    {
        if (is_array($value)) {
            $safe = array();
            foreach ($value as $key => $item) {
                $safe[is_string($key) ? badash_json_safe($key) : $key] = badash_json_safe($item);
            }
            return $safe;
        }
        if (is_string($value) && preg_match('//u', $value) !== 1) {
            return badash_scrub_utf8($value);
        }
        return $value;
    }

}
