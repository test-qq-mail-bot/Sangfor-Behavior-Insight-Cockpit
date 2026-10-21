<?php
/**
 * 可查询的 mdd 中间表元数据（文档 2.1.5 节）。
 * 供前端选择表与周期使用，同时作为 SQL 白名单。
 */

if (!function_exists('badash_tables')) {

    function badash_tables()
    {
        return array(
            'flux_duration_action' => array(
                'title' => '流量时长行为分析',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'line', 'serv_app'),
                'value' => array('up_flux', 'down_flux', 'total_flux', 'seconds', 'duration_per_5min', 'count'),
            ),
            'user_serv_duration' => array(
                'title' => '用户应用时长',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'term_type', 'terminal', 'site', 'line', 'serv'),
                'value' => array('up_flux', 'down_flux', 'total_flux', 'seconds', 'duration_per_5min'),
            ),
            'user_flux_trend' => array(
                'title' => '用户流速趋势',
                'periods' => array('5min', '1hour', '4hour'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'line', 'serv_app', 'time_slice'),
                'value' => array('up_flux', 'down_flux', 'total_flux', 'count'),
            ),
            'group_flux_trend' => array(
                'title' => '组流速趋势',
                'periods' => array('5min', '1hour', '4hour'),
                'key' => array('devid', 'group', 'terminal', 'site', 'line', 'serv_app', 'time_slice'),
                'value' => array('up_flux', 'down_flux', 'total_flux', 'count'),
            ),
            'channel_midtable' => array(
                'title' => '通道流速趋势',
                'periods' => array('5min'),
                'key' => array('devid', 'channel_path', 'line', 'time_slice'),
                'value' => array('total_users', 'active_users', 'up_flux', 'down_flux', 'total_flux'),
            ),
            'group_flux_midtable' => array(
                'title' => '组流量排行',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'group', 'terminal', 'site', 'line', 'serv_app'),
                'value' => array('up_flux', 'down_flux', 'total_flux', 'count'),
            ),
            'domain_access' => array(
                'title' => '域名访问排行',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'line', 'domain'),
                'value' => array('up_flux', 'down_flux', 'total_flux', 'seconds', 'count'),
            ),
            'http_flux_midtable' => array(
                'title' => 'HTTP 协议分析',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'line', 'httptype', 'filetype'),
                'value' => array('up_flux', 'down_flux', 'total_flux'),
            ),
            'web_access_trend' => array(
                'title' => '网站访问趋势',
                'periods' => array('1hour', '4hour'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'line', 'serv_app', 'time_slice'),
                'value' => array('count'),
            ),
            'web_bbs' => array(
                'title' => '论坛热帖访问',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'categories', 'bbs_title', 'bbs_url', 'bbs_id'),
                'value' => array('count'),
            ),
            'action_trend' => array(
                'title' => '应用行为趋势',
                'periods' => array('1hour', '4hour'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'categories', 'time_slice'),
                'value' => array('count'),
            ),
            'action_summary' => array(
                'title' => '行为汇总',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'categories'),
                'value' => array('count'),
            ),
            'action_collect' => array(
                'title' => '行为明细排行',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'categories', 'emailtype', 'chatype', 'keyword', 'sendtype', 'filetype'),
                'value' => array('count'),
            ),
            'im' => array(
                'title' => '即时通讯会话',
                'periods' => array('1day'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'chatype', 'session'),
                'value' => array('count'),
            ),
            'share_access' => array(
                'title' => '共享接入',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'srcip_user', 'terminal', 'site'),
                'value' => array('shared_tm_count'),
            ),
            'term_type' => array(
                'title' => '终端类型',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'srcip_user', 'terminal', 'site'),
                'value' => array('mt_count'),
            ),
            'risk_term' => array(
                'title' => '风险终端',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site', 'risk_type', 'risk_name', 'risk_level'),
                'value' => array('count'),
            ),
            'user_active' => array(
                'title' => '用户活跃天数',
                'periods' => array('1day'),
                'key' => array('devid', 'user', 'srcip', 'terminal', 'site'),
                'value' => array('days'),
            ),
            'user_access_trend' => array(
                'title' => '接入用户数趋势',
                'periods' => array('5min', '1hour', '4hour'),
                'key' => array('devid', 'group', 'log_type', 'time_slice'),
                'value' => array('usr_online_count', 'usr_logon_count'),
            ),
            'virus' => array(
                'title' => '网关杀毒',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'ip', 'srcip', 'terminal', 'site', 'virus_type'),
                'value' => array('threat_count'),
            ),
            'risk_report' => array(
                'title' => '风险报表',
                'periods' => array('1day', '1week', '1month'),
                'key' => array('devid', 'user', 'risk_type', 'risk_content'),
                'value' => array('count'),
            ),
        );
    }

    function badash_table_exists($table)
    {
        $tables = badash_tables();
        return isset($tables[$table]);
    }
}
