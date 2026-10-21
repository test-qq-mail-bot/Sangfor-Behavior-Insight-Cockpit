<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 即时通讯工具会话排行（im，1day 表）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_im_rank')) {

function badash_im_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 50);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . 'chatype `key`, sum(i(`count`)) cnt, distinct_count(`user`) user_cnt, '
        . 'distinct_count(session) session_cnt '
        . 'from ' . badash_table('im', '1day', $start, $end)
        . ' group by `key` order by cnt limit ' . $limit;

    $ret = badash_sql(badash_query_id('im_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    return array('start' => $start, 'end' => $end, 'rows' => badash_rows_int(badash_rows($ret), 'cnt'));
}

badash_register('badash_im_rank', __FILE__);
}
