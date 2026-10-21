<?php
require_once(ldb_ext_root() . "/bin/mapreduce/api/core.php");
/**
 * 查看表结构（文档 2.1.4.1 的 desc 语法）。
 * 参数：table 表名（多级目录用冒号分隔）。
 */

require_once dirname(dirname(__DIR__)) . '/lib/common.php';
require_once dirname(dirname(__DIR__)) . '/lib/endpoint.php';
require_once dirname(dirname(__DIR__)) . '/lib/tables.php';

if (!function_exists('badash_schema')) {

function badash_schema_file($table, $period, $start, $end)
{
    $root = rtrim(str_replace('\\', '/', badash_root()), '/') . '/';
    $dates = array($end, $start, date('Ymd'));
    $dirs = @glob($root . '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]', GLOB_ONLYDIR);
    if (is_array($dirs)) {
        rsort($dirs);
        foreach ($dirs as $dir) {
            $dates[] = basename($dir);
        }
    }
    $dates = array_values(array_unique($dates));
    foreach ($dates as $date) {
        $files = @glob($root . $date . '/midtable/' . $table . '/' . $period . '/*/schema');
        if (is_array($files)) {
            foreach ($files as $file) {
                if (@is_readable($file)) {
                    return $file;
                }
            }
        }
    }
    return null;
}

function badash_schema_columns($schema)
{
    $columns = array();
    if (!is_array($schema)) {
        return $columns;
    }
    foreach ($schema as $name => $info) {
        if (is_array($info)) {
            $columns[] = array(
                'name' => $name,
                'type' => isset($info['type']) ? $info['type'] : '',
                'params' => isset($info['params']) ? $info['params'] : '',
            );
        } else {
            $columns[] = array('name' => $name, 'type' => (string)$info, 'params' => '');
        }
    }
    return $columns;
}

function badash_schema($params)
{
    $table = (string)badash_param($params, 'table', '');
    if ($table === '' || !badash_table_exists($table)) {
        badash_error('schema: unknown table ' . $table);
        return null;
    }

    $tables = badash_tables();
    $periods = $tables[$table]['periods'];
    $period = badash_allowed(badash_param($params, 'period', $periods[0]), $periods, $periods[0]);
    list($start, $end) = badash_date_range($params);

    $schemaFile = badash_schema_file($table, $period, $start, $end);
    if ($schemaFile !== null) {
        $rawSchema = @file_get_contents($schemaFile);
        $schema = json_decode($rawSchema, true);
        if (is_array($schema)) {
            return array('table' => $table, 'columns' => badash_schema_columns($schema));
        }
    }

    $dates = array($end, $start, date('Ymd'));
    $dates = array_values(array_unique($dates));

    $ret = null;
    foreach ($dates as $date) {
        $rel = $date . ':midtable:' . $table . ':' . $period;
        $ret = badash_sql(badash_query_id('schema', array($table, $period, $date)), 'desc ' . $rel, false, array());
        if ($ret !== null) {
            break;
        }
    }
    if ($ret === null) {
        return null;
    }
    if (is_string($ret)) {
        $decoded = json_decode($ret, true);
        if (!is_array($decoded)) {
            return array('table' => $table, 'raw' => $ret);
        }
        $ret = $decoded;
    }

    $columns = array();
    $isList = true;
    foreach ($ret as $key => $value) {
        if (!is_int($key)) {
            $isList = false;
            break;
        }
    }

    if ($isList) {
        foreach (badash_rows($ret) as $row) {
            $columns[] = array(
                'name' => isset($row['name']) ? $row['name'] : '',
                'type' => isset($row['type']) ? $row['type'] : '',
                'params' => isset($row['params']) ? $row['params'] : '',
            );
        }
    } else {
        foreach ($ret as $name => $info) {
            if (is_array($info)) {
                $columns[] = array(
                    'name' => $name,
                    'type' => isset($info['type']) ? $info['type'] : '',
                    'params' => isset($info['params']) ? $info['params'] : '',
                );
            } else {
                $columns[] = array('name' => $name, 'type' => (string)$info, 'params' => '');
            }
        }
    }

    return array('table' => $table, 'columns' => $columns);
}

badash_register('badash_schema', __FILE__);
}
