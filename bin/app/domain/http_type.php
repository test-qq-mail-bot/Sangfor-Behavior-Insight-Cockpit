<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * HTTP 协议 / 文件类型分布（http_flux_midtable）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_http_type')) {

function badash_http_type($params)
{
    list($start, $end) = badash_date_range($params);
    $group = badash_allowed(badash_param($params, 'group', 'httptype'), array('httptype', 'filetype'), 'httptype');

    $sql = 'select /* COLLECT:collector.date@core */ /* ORDER:int64_desc */ '
        . $group . ' `key`, sum(i(total_flux)) flux, distinct_count(`user`) user_cnt '
        . 'from ' . badash_table('http_flux_midtable', '1day', $start, $end)
        . ' group by `key` order by flux';

    $ret = badash_sql(badash_query_id('http_type', array($start, $end, $group)), $sql, false, array());
    if ($ret === null) {
        return null;
    }

    return array(
        'start' => $start,
        'end' => $end,
        'group' => $group,
        'rows' => badash_rows_int(badash_rows($ret), 'flux'),
    );
}

badash_register('badash_http_type', __FILE__);
}
