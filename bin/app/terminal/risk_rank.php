<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 风险终端排行（risk_term）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_risk_rank')) {

function badash_risk_rank($params)
{
    list($start, $end) = badash_date_range($params);
    $limit = badash_int($params, 'limit', 10, 1, 500);

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . 'risk_content `key`, risk_type, sum(i(`count`)) cnt, distinct_count(`user`) user_cnt '
        . 'from ' . badash_table('risk_report', '1day', $start, $end)
        . ' group by `key`, risk_type order by cnt limit ' . $limit;

    $ret = badash_sql(badash_query_id('risk_rank', array($start, $end, $limit)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    return array('start' => $start, 'end' => $end, 'rows' => badash_rows_int(badash_rows($ret), 'cnt'));
}

badash_register('badash_risk_rank', __FILE__);
}
