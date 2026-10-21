<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 共享接入排行（share_access）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';
require_once dirname(dirname(__DIR__)) . '/lib/reverse.php';

if (!function_exists('badash_share_rank')) {

function badash_share_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 50);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . '`user` `key`, sum(i(shared_tm_count)) shared_cnt, terminal '
        . 'from ' . badash_table('share_access', '1day', $start, $end)
        . ' group by `key`, terminal order by shared_cnt limit ' . $limit;

    $ret = badash_sql(badash_query_id('share_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows_int(badash_rows($ret), 'shared_cnt');

    $users = array();
    foreach ($rows as $row) {
        $users[] = $row['key'];
    }
    $names = badash_reverse_user($users);
    foreach ($rows as $index => $row) {
        $rows[$index]['user_name'] = badash_display_name($names, $row['key']);
    }

    return array('start' => $start, 'end' => $end, 'rows' => $rows);
}

badash_register('badash_share_rank', __FILE__);
}
