<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 概览汇总：总流量、上行、下行、活跃用户、事件次数。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_overview')) {

function badash_overview($params)
{
    list($start, $end) = badash_date_range($params);

    $sql = 'select /* COLLECT:collector.date@core */ '
        . 'sum(i(total_flux)) flux, sum(i(up_flux)) up_flux, sum(i(down_flux)) down_flux, '
        . 'distinct_count(`user`) user_cnt, sum(i(`count`)) event_cnt '
        . 'from ' . badash_table('flux_duration_action', '1day', $start, $end);

    $ret = badash_sql(badash_query_id('overview', array($start, $end)), $sql, false, array());
    if ($ret === null) {
        return null;
    }
    $rows = badash_rows($ret);
    $summary = count($rows) > 0 ? $rows[0] : array();

    $domainSql = 'select /* COLLECT:collector.date@core */ distinct_count(domain) domain_cnt '
        . 'from ' . badash_table('domain_access', '1day', $start, $end);
    $domainRows = badash_rows(badash_sql(badash_query_id('overview_domain', array($start, $end)), $domainSql, false, array()));

    $riskSql = 'select /* COLLECT:collector.date@core */ sum(i(`count`)) risk_cnt '
        . 'from ' . badash_table('risk_report', '1day', $start, $end);
    $riskRows = badash_rows(badash_sql(badash_query_id('overview_risk', array($start, $end)), $riskSql, false, array()));

    return array(
        'start' => $start,
        'end' => $end,
        'flux' => isset($summary['flux']) ? intval($summary['flux']) : 0,
        'up_flux' => isset($summary['up_flux']) ? intval($summary['up_flux']) : 0,
        'down_flux' => isset($summary['down_flux']) ? intval($summary['down_flux']) : 0,
        'user_cnt' => isset($summary['user_cnt']) ? intval($summary['user_cnt']) : 0,
        'event_cnt' => isset($summary['event_cnt']) ? intval($summary['event_cnt']) : 0,
        'domain_cnt' => isset($domainRows[0]['domain_cnt']) ? intval($domainRows[0]['domain_cnt']) : 0,
        'risk_cnt' => isset($riskRows[0]['risk_cnt']) ? intval($riskRows[0]['risk_cnt']) : 0,
    );
}

badash_register('badash_overview', __FILE__);
}
