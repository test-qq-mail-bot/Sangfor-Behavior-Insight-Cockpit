<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 终端类型排行（term_type）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_term_rank')) {

function badash_term_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 500);

    $sql = 'select /* COLLECT:collector.date@core */ '
        . 'terminal `key`, `user`, mt_count cnt '
        . 'from ' . badash_table('term_type', '1day', $start, $end)
        . ' limit 50000';

    $ret = badash_sql(badash_query_id('term_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    $groups = array();
    foreach (badash_rows($ret) as $row) {
        $key = isset($row['key']) ? (string)$row['key'] : '';
        $user = isset($row['user']) ? (string)$row['user'] : '';
        $value = isset($row['cnt']) ? badash_i64set($row['cnt']) : 0;
        if (!isset($groups[$key])) {
            $groups[$key] = array('key' => $key, 'cnt' => 0, 'users' => array());
        }
        $groups[$key]['cnt'] += $value;
        if ($user !== '') {
            $groups[$key]['users'][$user] = 1;
        }
    }

    $rows = array();
    foreach ($groups as $group) {
        $rows[] = array(
            'key' => $group['key'],
            'cnt' => $group['cnt'],
            'user_cnt' => count($group['users']),
        );
    }
    usort($rows, function ($left, $right) {
        if ($left['cnt'] === $right['cnt']) {
            return strcmp($left['key'], $right['key']);
        }
        return $left['cnt'] < $right['cnt'] ? 1 : -1;
    });
    $rows = array_slice($rows, 0, $limit);

    foreach ($rows as $index => $row) {
        $rows[$index]['terminal_label'] = badash_terminal_label($row['key']);
    }

    return array('start' => $start, 'end' => $end, 'rows' => $rows);
}

badash_register('badash_term_rank', __FILE__);
}
