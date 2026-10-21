<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * JSON 数据导入为 blob（文档 2.3，api.t_load@custom）。
 * 参数：table 必填，path 必填，date 可选(YYYYMMDD)，app 可选。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_import')) {

function badash_import($params)
{
    $table = preg_replace('/[^a-zA-Z0-9_.]/', '', (string)badash_param($params, 'table', ''));
    $path = (string)badash_param($params, 'path', '');
    $date = preg_replace('/[^0-9]/', '', (string)badash_param($params, 'date', date('Ymd')));
    $app = preg_replace('/[^a-z0-9_]/', '', strtolower((string)badash_param($params, 'app', 'cus_insight')));

    if ($table === '' || $path === '') {
        badash_error('import: table and path are required');
        return null;
    }
    if (strlen($date) !== 8) {
        $date = date('Ymd');
    }

    $config = array(
        'table' => $table,
        'path' => $path,
        'date' => $date,
        'app' => $app,
    );

    $blob = ldb_require('api.t_load@custom');
    if (!is_object($blob)) {
        badash_error('require api.t_load@custom failed');
        return null;
    }
    $instance = $blob($config);
    if (!is_object($instance)) {
        badash_error('create t_load instance failed: ' . (is_string($instance) ? $instance : ''));
        return null;
    }

    $ret = call_user_func($instance->main, $instance, $config);
    if ($ret) {
        $err = call_user_func($instance->error, $instance);
        badash_error('import failed: ' . $err);
        call_user_func($instance->destroy, $instance);
        return null;
    }
    call_user_func($instance->destroy, $instance);
    badash_info('import ok table=' . $table . ' date=' . $date);

    return array('table' => $table, 'path' => $path, 'date' => $date, 'app' => $app, 'result' => 'ok');
}

badash_register('badash_import', __FILE__);
}
