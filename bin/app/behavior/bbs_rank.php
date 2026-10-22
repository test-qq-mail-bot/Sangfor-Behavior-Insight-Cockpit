<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 论坛热帖访问排行（web_bbs）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_bbs_rank')) {

function badash_bbs_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 500);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . 'bbs_title title, categories, sum(i(`count`)) cnt '
        . 'from ' . badash_table('web_bbs', '1day', $start, $end)
        . ' group by `title`, categories order by cnt limit ' . $limit;

    $ret = badash_sql(badash_query_id('bbs_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    return array('start' => $start, 'end' => $end, 'rows' => badash_rows_int(badash_rows($ret), 'cnt'));
}

badash_register('badash_bbs_rank', __FILE__);
}
