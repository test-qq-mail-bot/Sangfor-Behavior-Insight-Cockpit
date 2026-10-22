<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * HTTP 协议 / 文件类型分布（http_flux_midtable）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_http_type')) {

function badash_http_type($params)
{
    list($start, $end) = badash_date_range($params);
    $group = badash_allowed(badash_param($params, 'group', 'httptype'), array('httptype', 'filetype'), 'httptype');

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . $group . ' `key`, sum(i(total_flux)) sort_flux, sum(i(up_flux)) up_flux, '
        . 'sum(i(down_flux)) down_flux, distinct_count(`user`) user_cnt '
        . 'from ' . badash_table('http_flux_midtable', '1day', $start, $end)
        . ' group by `key` order by sort_flux';

    $ret = badash_sql(badash_query_id('http_type', array($start, $end, $group)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    $rows = badash_rows($ret);
    foreach ($rows as $index => $row) {
        $up = isset($row['up_flux']) ? badash_num($row['up_flux']) : 0;
        $down = isset($row['down_flux']) ? badash_num($row['down_flux']) : 0;
        $rows[$index]['up_flux'] = $up;
        $rows[$index]['down_flux'] = $down;
        $rows[$index]['flux'] = $up + $down;
        $rows[$index]['user_cnt'] = isset($row['user_cnt']) ? badash_num($row['user_cnt']) : 0;
        unset($rows[$index]['sort_flux']);
    }
    usort($rows, function ($a, $b) {
        if ($a['flux'] == $b['flux']) {
            return 0;
        }
        return $a['flux'] < $b['flux'] ? 1 : -1;
    });

    return array(
        'start' => $start,
        'end' => $end,
        'group' => $group,
        'rows' => $rows,
    );
}

badash_register('badash_http_type', __FILE__);
}
