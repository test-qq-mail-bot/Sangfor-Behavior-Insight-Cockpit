<?php
/**
 * 定时采集过程：汇总前一天流量与风险数据并写入日志。
 * 由 crond.collect@cus_insight 拉起（对照示例应用 bin/procedure/import_data.php）。
 */

require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
require_once dirname(__DIR__) . '/lib/common.php';

call_user_func(function () {

    $main = function ($object) {
        $yesterday = date('Ymd', time() - 86400);

        $sql = 'select /* COLLECT:collector.date@core */ '
            . 'sum(i(up_flux)) up_flux, sum(i(down_flux)) down_flux, distinct_count(`user`) user_cnt '
            . 'from ' . badash_table('flux_duration_action', '1day', $yesterday, $yesterday);

        $rows = badash_rows(badash_sql(badash_query_id('crond_daily', array($yesterday)), $sql, false, array()));
        if (count($rows) === 0) {
            $object->lasterr = 'empty result for ' . $yesterday;
            badash_error('crond collect: ' . $object->lasterr);
            return -1;
        }

        $up = isset($rows[0]['up_flux']) ? badash_num($rows[0]['up_flux']) : 0;
        $down = isset($rows[0]['down_flux']) ? badash_num($rows[0]['down_flux']) : 0;
        $flux = $up + $down;
        $users = isset($rows[0]['user_cnt']) ? badash_num($rows[0]['user_cnt']) : 0;
        badash_info('daily summary date=' . $yesterday . ' flux=' . $flux . ' users=' . $users);
        return 0;
    };

    $error = function ($object) {
        return isset($object->lasterr) ? $object->lasterr : '';
    };

    $destroy = function ($object) {
    };

    $constructor = function ($context) use (&$main, &$error, &$destroy) {
        return (object)array(
            'main' => $main,
            'error' => $error,
            'destroy' => $destroy,
            'lasterr' => null,
            'context' => $context,
        );
    };

    ldb_register(__FILE__, $constructor);
});
