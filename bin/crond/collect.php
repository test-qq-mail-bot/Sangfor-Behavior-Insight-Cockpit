<?php
/**
 * 定时任务入口（对照示例应用 bin/crond/collect.php）。
 * regedit.conf 的 task.crond 通过 crond.collect@cus_insight 调度本文件，
 * 本文件只负责拉起 procedure.collect@cus_insight。
 */

require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");

call_user_func(function () {

    $is_timeout = function ($object, $now) {
        $diff = abs($now - $object->now);
        if ($diff < 60) {
            return false;
        }
        $object->now = $now;
        return true;
    };

    $procedure = function ($object) {
        return 'procedure.collect@cus_insight';
    };

    $args = function ($object) {
        return array();
    };

    $constructor = function ($now) use (&$is_timeout, &$procedure, &$args) {
        return (object)array(
            'is_timeout' => $is_timeout,
            'procedure' => $procedure,
            'args' => $args,
            'now' => $now,
        );
    };

    ldb_register(__FILE__, $constructor);
});
