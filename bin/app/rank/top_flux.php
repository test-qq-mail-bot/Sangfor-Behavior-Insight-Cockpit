<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 流量 TOP 排行（按用户/组，基于 flux_duration_action）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';
require_once dirname(dirname(__DIR__)) . '/lib/reverse.php';

if (!function_exists('badash_top_flux')) {

function badash_top_flux($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 50);
    $period = badash_allowed(badash_param($params, 'period', '1day'), array('1day', '1week', '1month'), '1day');
    $dim = badash_allowed(badash_param($params, 'dim', 'user'), array('user', 'group'), 'user');

    if ($dim === 'group') {
        $field = '`group`';
        $table = badash_table('group_flux_midtable', $period, $start, $end);
    } else {
        $field = '`user`';
        $table = badash_table('flux_duration_action', $period, $start, $end);
    }

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . $field . ' `key`, sum(i(total_flux)) flux, sum(i(up_flux)) up_flux, '
        . 'sum(i(down_flux)) down_flux, sum(i(`count`)) cnt '
        . 'from ' . $table . ' group by `key` order by flux limit ' . $limit;

    $query = badash_query_id('top_flux', array($start, $end, $period, $dim, $limit));
    $ret = badash_sql($query, $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows_int(badash_rows($ret), 'flux');

    if ($dim === 'user') {
        $users = array();
        foreach ($rows as $row) {
            $users[] = $row['key'];
        }
        $names = badash_reverse_user($users);
        foreach ($rows as $index => $row) {
            $rows[$index]['name'] = badash_display_name($names, $row['key']);
        }
    } else {
        foreach ($rows as $index => $row) {
            $rows[$index]['name'] = $row['key'];
        }
    }

    return array('start' => $start, 'end' => $end, 'period' => $period, 'dim' => $dim, 'rows' => $rows);
}

badash_register('badash_top_flux', __FILE__);
}
