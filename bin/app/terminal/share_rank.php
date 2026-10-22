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
    $limit = badash_int($params, 'limit', 10, 1, 500);

    $sql = 'select /* COLLECT:collector.date@core */ '
        . '`user` `key`, shared_tm_count shared_cnt, terminal '
        . 'from ' . badash_table('share_access', '1day', $start, $end)
        . ' limit 5000';

    $ret = badash_sql(badash_query_id('share_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    $groups = array();
    foreach (badash_rows($ret) as $row) {
        $userKey = isset($row['key']) ? (string)$row['key'] : '';
        $terminal = isset($row['terminal']) ? (string)$row['terminal'] : '';
        $value = isset($row['shared_cnt']) ? badash_i64set($row['shared_cnt']) : 0;
        if (!isset($groups[$userKey])) {
            $groups[$userKey] = array();
        }
        if (!isset($groups[$userKey][$terminal]) || $value > $groups[$userKey][$terminal]['shared_cnt']) {
            $groups[$userKey][$terminal] = array(
                'key' => $userKey,
                'terminal' => $terminal,
                'shared_cnt' => $value,
            );
        }
    }

    $rows = array();
    foreach ($groups as $userGroups) {
        foreach ($userGroups as $group) {
            $rows[] = $group;
        }
    }
    usort($rows, function ($left, $right) {
        if ($left['shared_cnt'] === $right['shared_cnt']) {
            return strcmp($left['key'], $right['key']);
        }
        return $left['shared_cnt'] < $right['shared_cnt'] ? 1 : -1;
    });
    $rows = array_slice($rows, 0, $limit);

    foreach ($rows as $index => $row) {
        $rows[$index]['terminal_label'] = badash_terminal_label($row['terminal']);
    }

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
