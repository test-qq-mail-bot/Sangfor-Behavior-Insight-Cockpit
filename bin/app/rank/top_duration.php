<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 应用时长 TOP 排行（user_serv_duration）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';
require_once dirname(dirname(__DIR__)) . '/lib/reverse.php';

if (!function_exists('badash_top_duration')) {

function badash_top_duration($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 50);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . '`user` `key`, serv, sum(i(seconds)) seconds, sum(i(total_flux)) flux '
        . 'from ' . badash_table('user_serv_duration', '1day', $start, $end)
        . ' group by `user`, serv order by seconds limit ' . $limit;

    $ret = badash_sql(badash_query_id('top_duration', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows_int(badash_rows($ret), 'seconds');

    $servs = array();
    foreach ($rows as $row) {
        if (isset($row['serv'])) {
            $servs[] = $row['serv'];
        }
    }
    $servNames = badash_reverse_app($servs);

    $users = array();
    foreach ($rows as $row) {
        $users[] = $row['key'];
    }
    $userNames = badash_reverse_user($users);

    foreach ($rows as $index => $row) {
        $rows[$index]['user_name'] = badash_display_name($userNames, $row['key']);
        $rows[$index]['serv_name'] = badash_display_name($servNames, $row['serv']);
    }

    return array('start' => $start, 'end' => $end, 'rows' => $rows);
}

badash_register('badash_top_duration', __FILE__);
}
