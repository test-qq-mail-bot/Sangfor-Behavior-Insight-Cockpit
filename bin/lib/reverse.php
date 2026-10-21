<?php
/**
 * cus_insight 反查接口封装
 * 依据文档 2.2.1（api.core.result.reverse.app）与 2.2.2（api.core.result.reverse.user）。
 * 注意：配置较大，一次 load 后批量 reverse，最后统一 destroy。
 */

if (!function_exists('badash_reverse_app')) {

    function badash_reverse_app($app_ids)
    {
        $result = array();
        if (!is_array($app_ids) || count($app_ids) === 0) {
            return $result;
        }
        $reverse = ldb_require('api.core.result.reverse.app');
        if (!is_object($reverse)) {
            badash_error('require api.core.result.reverse.app failed');
            return $result;
        }
        $instance = $reverse();
        if (!is_object($instance)) {
            badash_error('create reverse app instance failed');
            return $result;
        }
        $config = call_user_func($instance->load);
        foreach ($app_ids as $app_id) {
            $name = call_user_func($instance->reverse, $config, $app_id);
            if (is_string($name) && $name !== '') {
                $result[$app_id] = $name;
            }
        }
        call_user_func($instance->destroy, $config);
        return $result;
    }

    function badash_reverse_user($users)
    {
        $result = array();
        if (!is_array($users) || count($users) === 0) {
            return $result;
        }
        $reverse = ldb_require('api.core.result.reverse.user');
        if (!is_object($reverse)) {
            badash_error('require api.core.result.reverse.user failed');
            return $result;
        }
        $instance = $reverse();
        if (!is_object($instance)) {
            badash_error('create reverse user instance failed');
            return $result;
        }
        $config = call_user_func($instance->load);
        foreach ($users as $user) {
            $name = call_user_func($instance->reverse, $config, $user, true);
            if (is_string($name) && $name !== '') {
                $result[$user] = $name;
            }
        }
        call_user_func($instance->destroy, $config);
        return $result;
    }

    /**
     * 反查失败或返回空时回退为原始值，避免前端显示 false / null。
     */
    function badash_display_name($names, $key)
    {
        if (isset($names[$key]) && is_string($names[$key]) && $names[$key] !== '') {
            return $names[$key];
        }
        return $key;
    }
}
