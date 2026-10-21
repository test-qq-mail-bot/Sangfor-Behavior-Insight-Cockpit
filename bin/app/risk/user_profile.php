<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 人员行为画像：合并风险报表与行为明细排行。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';
require_once dirname(dirname(__DIR__)) . '/lib/reverse.php';

if (!function_exists('badash_user_profile')) {

function badash_user_profile($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 50);

    $riskSql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . '`user` `key`, sum(`count`) risk_cnt '
        . 'from ' . badash_table('risk_report', '1day', $start, $end)
        . ' group by `user` order by risk_cnt limit ' . $limit;

    $actionSql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . '`user` `key`, sum(i(`count`)) action_cnt '
        . 'from ' . badash_table('action_collect', '1day', $start, $end)
        . ' group by `user` order by action_cnt limit ' . $limit;

    $riskRows = badash_rows(badash_sql(badash_query_id('profile_risk', array($start, $end, $limit)), $riskSql, false, array()));
    $actionRows = badash_rows(badash_sql(badash_query_id('profile_action', array($start, $end, $limit)), $actionSql, false, array()));
    if (count($riskRows) === 0 && count($actionRows) === 0) {
        return array('start' => $start, 'end' => $end, 'rows' => array());
    }

    $merged = array();
    foreach ($riskRows as $row) {
        $key = isset($row['key']) ? $row['key'] : '';
        if ($key === '') {
            continue;
        }
        if (!isset($merged[$key])) {
            $merged[$key] = array('key' => $key, 'risk_cnt' => 0, 'action_cnt' => 0);
        }
        $merged[$key]['risk_cnt'] += isset($row['risk_cnt']) ? intval($row['risk_cnt']) : 0;
    }
    foreach ($actionRows as $row) {
        $key = isset($row['key']) ? $row['key'] : '';
        if ($key === '') {
            continue;
        }
        if (!isset($merged[$key])) {
            $merged[$key] = array('key' => $key, 'risk_cnt' => 0, 'action_cnt' => 0);
        }
        $merged[$key]['action_cnt'] += isset($row['action_cnt']) ? intval($row['action_cnt']) : 0;
    }

    $users = array();
    foreach ($merged as $row) {
        $users[] = $row['key'];
    }
    $names = badash_reverse_user($users);

    $rows = array();
    foreach ($merged as $row) {
        $row['user_name'] = badash_display_name($names, $row['key']);
        $row['score'] = $row['risk_cnt'] * 3 + $row['action_cnt'];
        $rows[] = $row;
    }
    usort($rows, 'badash_profile_compare');
    $rows = array_slice($rows, 0, $limit);

    return array('start' => $start, 'end' => $end, 'rows' => $rows);
}

function badash_profile_compare($a, $b)
{
    if ($a['score'] === $b['score']) {
        return 0;
    }
    return ($a['score'] < $b['score']) ? 1 : -1;
}

badash_register('badash_user_profile', __FILE__);
}
