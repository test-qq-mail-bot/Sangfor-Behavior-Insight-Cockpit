<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 域名访问排行（domain_access）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_domain_rank')) {

function badash_domain_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 500);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . 'domain `key`, sum(i(total_flux)) sort_flux, sum(i(up_flux)) up_flux, '
        . 'sum(i(down_flux)) down_flux, sum(i(`count`)) cnt, '
        . 'sum(i(seconds)) seconds, distinct_count(`user`) user_cnt '
        . 'from ' . badash_table('domain_access', '1day', $start, $end)
        . ' group by `key` order by sort_flux limit ' . $limit;

    $ret = badash_sql(badash_query_id('domain_rank', array($start, $end, $limit)), $sql, false, array());
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
        $rows[$index]['cnt'] = isset($row['cnt']) ? badash_num($row['cnt']) : 0;
        $rows[$index]['seconds'] = isset($row['seconds']) ? badash_num($row['seconds']) : 0;
        $rows[$index]['user_cnt'] = isset($row['user_cnt']) ? badash_num($row['user_cnt']) : 0;
        unset($rows[$index]['sort_flux']);
    }
    usort($rows, function ($a, $b) {
        if ($a['flux'] == $b['flux']) {
            return 0;
        }
        return $a['flux'] < $b['flux'] ? 1 : -1;
    });

    return array('start' => $start, 'end' => $end, 'rows' => $rows);
}

badash_register('badash_domain_rank', __FILE__);
}
