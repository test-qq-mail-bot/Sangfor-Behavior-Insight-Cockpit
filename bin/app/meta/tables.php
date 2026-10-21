<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 返回可查询的 mdd 中间表清单（文档 2.1.5），供前端筛选。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';
require_once dirname(dirname(__DIR__)) . '/lib/tables.php';

if (!function_exists('badash_meta_tables')) {

function badash_meta_tables($params)
{
    $tables = badash_tables();
    $list = array();
    foreach ($tables as $name => $info) {
        $list[] = array(
            'name' => $name,
            'title' => $info['title'],
            'periods' => $info['periods'],
            'key' => $info['key'],
            'value' => $info['value'],
        );
    }

    return array(
        'app' => 'cus_insight',
        'tables' => $list,
    );
}

badash_register('badash_meta_tables', __FILE__);
}
