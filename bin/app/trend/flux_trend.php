<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 用户流速趋势（user_flux_trend，支持 5min/1hour/4hour）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_flux_trend')) {

function badash_flux_trend($params)
{
    list($start, $end) = badash_date_range($params);
    $period = badash_allowed(badash_param($params, 'period', '1hour'), array('5min', '1hour', '4hour'), '1hour');
    $table = badash_table('user_flux_trend', $period, $start, $end);

    $sql = 'select /* COLLECT:collector.date@core */ time_slice, '
        . 'sum(up_flux) up_flux, sum(down_flux) down_flux, sum(total_flux) total_flux, sum(`count`) cnt '
        . 'from ' . $table . ' group by time_slice';

    $ret = badash_sql(badash_query_id('flux_trend', array($start, $end, $period)), $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows($ret);

    $series = array();
    foreach ($rows as $row) {
        $slice = intval($row['time_slice']);
        $series[$slice] = array(
            'time_slice' => $slice,
            'up_flux' => isset($row['up_flux']) ? intval($row['up_flux']) : 0,
            'down_flux' => isset($row['down_flux']) ? intval($row['down_flux']) : 0,
            'total_flux' => isset($row['total_flux']) ? intval($row['total_flux']) : 0,
            'cnt' => isset($row['cnt']) ? intval($row['cnt']) : 0,
        );
    }
    ksort($series);

    return array(
        'start' => $start,
        'end' => $end,
        'period' => $period,
        'rows' => array_values($series),
    );
}

badash_register('badash_flux_trend', __FILE__);
}
