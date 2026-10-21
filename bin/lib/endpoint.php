<?php
/**
 * 自定义应用接口注册helper（对照示例应用 cus_demo 的写法）。
 * app 接口约定：
 *   1) 用 ldb_mapreduce_invoke("register", id, $constructor) 注册；
 *   2) main($object, $params) 内通过 ldb_output_arr() 输出 JSON；
 *   3) 失败时设置 $object->lasterr 并返回 -1。
 */

require_once dirname(__FILE__) . '/common.php';

if (!function_exists('badash_watch_fatal')) {

    function badash_watch_fatal()
    {
        static $registered = false;
        if ($registered || !function_exists('register_shutdown_function')) {
            return;
        }
        $registered = true;
        register_shutdown_function(function () {
            $error = error_get_last();
            if (!is_array($error)) {
                return;
            }
            $fatal = array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR);
            if (!in_array($error['type'], $fatal, true)) {
                return;
            }
            badash_error('fatal: ' . $error['message'] . ' in ' . $error['file'] . ':' . $error['line']);
        });
    }
}

badash_watch_fatal();

if (!function_exists('badash_register')) {

    function badash_register($handler, $file)
    {
        $main = function ($object, $params) use ($handler) {
            try {
                $result = call_user_func($handler, is_array($params) ? $params : array());
                if ($result === null) {
                    $message = badash_last_error();
                    if ($message === '') {
                        $message = 'query failed, please check custom app log';
                    }
                    $message = substr($message, 0, 500);
                    $object->lasterr = $message;
                    ldb_output_arr(array('success' => false, 'msg' => $message));
                    return 0;
                }
                ldb_output_arr(array('success' => true, 'data' => badash_json_safe($result)));
                return 0;
            } catch (Exception $exception) {
                $message = substr($exception->getMessage(), 0, 500);
                badash_error('uncaught exception: ' . $message);
                $object->lasterr = $message;
                ldb_output_arr(array('success' => false, 'msg' => $message));
                return 0;
            }
        };

        $error = function ($object) {
            return isset($object->lasterr) ? $object->lasterr : '';
        };

        $destroy = function ($object) {
        };

        $constructor = function () use (&$main, &$error, &$destroy) {
            return (object)array(
                'main' => $main,
                'error' => $error,
                'destroy' => $destroy,
                'result' => null,
                'lasterr' => null,
            );
        };

        ldb_mapreduce_invoke('register', ldb_mapreduce_invoke('uniqid', $file), $constructor);
    }
}
