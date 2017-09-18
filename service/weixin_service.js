var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr');
var fs = require('fs');

var request = require('request');
var dashixiong = require('../controllers/dashixiong');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'weixin_service.js');
var ld = uutil.getLogger('DEBUG', 'weixin_service.js');

//============================= 工具方法 ============================
var render = uutil.render;


//============================= 路由管理 =============================
exports.route = function (app) {
    app.get('/', function (req, res) {
        li.info('用户进入');
        render(req, res, 'index', {
            layout: true
        });
    });

    app.get('/register', function (req, res) {
        render(req, res, 'register', {
            layout: true
        });
    });

    app.post('/register/submit', function(req, res){
        var msg = req.body.msg;

        msg.query = req.query;
        msg.res = res;

        console.log(req.body)
        console.log(req.query)

        //处理非事件类型，如text，image
        if( msg.msgType && /text|image/.test(msg.msgType) ){
            handle(msg);
            return;
        }

        //模拟微信各类事件，如subscrib, unsubscrib, click等
        if(msg.msgType){
            msg.event = msg.msgType;
            msg.toUserName = '0000000000000000000';
            exports.eventHandle(msg ,res);
        }
    });

    app.get('/login', function (req, res) {
        render(req, res, 'login', {
            layout: true
        });
    });

    app.post('/login/submit', function(req, res){
        var msg = req.body.msg;

        msg.query = req.query;
        msg.res = res;

        //处理非事件类型，如text，image
        if( msg.msgType && /text|image/.test(msg.msgType) ){
            handle(msg);
            return;
        }

        //模拟微信各类事件，如subscrib, unsubscrib, click等
        if(msg.msgType){
            msg.event = msg.msgType;
            msg.toUserName = '0000000000000000000';
            exports.eventHandle(msg ,res);
        }
    });
};





