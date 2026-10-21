<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 视图生成（文档 2.4，api.t_view@custom）。
 * 参数：table/view/key/value 必填；dat_table/depend/filter/period/save_days/
 *       forces/interval/max_dates/max_count/override/combine/dsl/last_days 可选。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';

if (!function_exists('badash_view')) {

function badash_view($params)
{
    $config = array();

    $required = array('table', 'view', 'key', 'value');
    foreach ($required as $field) {
        if ((string)badash_param($params, $field, '') === '') {
            badash_error('view: missing required param ' . $field);
            return null;
        }
    }

    $textFields = array(
        'table', 'view', 'key', 'value', 'dat_table', 'depend', 'filter',
        'period', 'combine', 'dsl',
    );
    foreach ($textFields as $field) {
        $value = badash_param($params, $field, '');
        if ($value !== '') {
            $config[$field] = $value;
        }
    }

    $intFields = array('save_days', 'forces', 'interval', 'max_dates', 'max_count', 'last_days');
    foreach ($intFields as $field) {
        $value = badash_param($params, $field, '');
        if ($value !== '') {
            $config[$field] = intval($value);
        }
    }

    $config['app'] = preg_replace('/[^a-z0-9_]/', '', strtolower((string)badash_param($params, 'app', 'cus_insight')));
    $config['override'] = badash_param($params, 'override', '') !== '' ? true : false;

    $view = ldb_require('api.t_view@custom');
    if (!is_object($view)) {
        badash_error('require api.t_view@custom failed');
        return null;
    }
    $instance = $view($config);
    if (!is_object($instance)) {
        badash_error('create t_view instance failed: ' . (is_string($instance) ? $instance : ''));
        return null;
    }

    $ret = call_user_func($instance->main, $instance, $config);
    if ($ret) {
        $msg = call_user_func($instance->error, $instance);
        badash_error('view failed: ' . $msg);
        call_user_func($instance->destroy, $instance);
        return null;
    }
    $msg = call_user_func($instance->result, $instance);
    call_user_func($instance->destroy, $instance);

    return array('config' => $config, 'dsl' => $msg);
}

badash_register('badash_view', __FILE__);
}
