<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 接入用户数趋势（user_access_trend）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_user_trend')) {

function badash_user_trend($params)
{
    list($start, $end) = badash_date_range($params);
    $period = badash_allowed(badash_param($params, 'period', '1hour'), array('5min', '1hour', '4hour'), '1hour');
    $table = badash_table('user_access_trend', $period, $start, $end);

    $sql = 'select /* COLLECT:collector.date@core */ time_slice, log_type, '
        . 'max(usr_online_count) online_cnt, sum(usr_logon_count) logon_cnt '
        . 'from ' . $table . ' group by time_slice, log_type';

    $ret = badash_sql(badash_query_id('user_trend', array($start, $end, $period)), $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows($ret);

    $slices = badash_period_slices($period);
    $series = array();
    for ($index = 0; $index < $slices; $index++) {
        $series[$index] = array('time_slice' => $index, 'online_cnt' => 0, 'logon_cnt' => 0);
    }
    foreach ($rows as $row) {
        $slice = (int)badash_i64set($row['time_slice']);
        if ($slice < 0 || $slice >= $slices) {
            continue;
        }
        $online = isset($row['online_cnt']) ? badash_num($row['online_cnt']) : 0;
        $logon = isset($row['logon_cnt']) ? badash_num($row['logon_cnt']) : 0;
        if ($online > $series[$slice]['online_cnt']) {
            $series[$slice]['online_cnt'] = $online;
        }
        $series[$slice]['logon_cnt'] += $logon;
    }
    ksort($series);

    return array(
        'start' => $start,
        'end' => $end,
        'period' => $period,
        'rows' => array_values($series),
    );
}

badash_register('badash_user_trend', __FILE__);
}
