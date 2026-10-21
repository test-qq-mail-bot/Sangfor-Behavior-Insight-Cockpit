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
    $limit = badash_int($params, 'limit', 10, 1, 50);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . 'domain `key`, sum(i(total_flux)) flux, sum(i(`count`)) cnt, '
        . 'sum(i(seconds)) seconds, distinct_count(`user`) user_cnt '
        . 'from ' . badash_table('domain_access', '1day', $start, $end)
        . ' group by `key` order by flux limit ' . $limit;

    $ret = badash_sql(badash_query_id('domain_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows_int(badash_rows($ret), 'flux');

    return array('start' => $start, 'end' => $end, 'rows' => $rows);
}

badash_register('badash_domain_rank', __FILE__);
}
