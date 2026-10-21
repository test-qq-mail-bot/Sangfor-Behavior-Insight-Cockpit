<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 上网行为类别排行（action_collect）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_action_rank')) {

function badash_action_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 50);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . 'categories `key`, sum(i(`count`)) cnt, distinct_count(`user`) user_cnt '
        . 'from ' . badash_table('action_collect', '1day', $start, $end)
        . ' group by categories order by cnt limit ' . $limit;

    $ret = badash_sql(badash_query_id('action_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    return array('start' => $start, 'end' => $end, 'rows' => badash_rows_int(badash_rows($ret), 'cnt'));
}

badash_register('badash_action_rank', __FILE__);
}
