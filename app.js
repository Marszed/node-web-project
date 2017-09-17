var express = require('express');
var IdChecker = require( './lib/IdChecker' );
var fs = require('fs');
var util = require('util');
var http = require('http');
var crypto = require('crypto');
var UserAuth = require( './lib/UserAuth' );
var hash = require( './lib/md5' );
var querystring = require('querystring');
var uutil = require('./lib/util');
var dashixiong = require('./controllers/dashixiong');
//var os = require('os');
var artTmpl = require('art-template');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'app.js');
var ld = uutil.getLogger('DEBUG', 'app.js');


//创建一个随机的、不太可能重复的id, prefix可以是任意字符串
var getNewId = function(prefix){
	return hash.md5(new Date().getTime()+''+prefix+Math.random());
};

var app;
//service自己管理自己业务范围的路由. 此函数把app 传入每一个service当中, 让他们自己来搞定自己的路由
var registerService = function( service_name_ary, app ){
    var path = null;
	service_name_ary.forEach(function(service_name, i){
        path = './service/'+service_name;
        if( fs.statSync( path ).isFile() ){
            if( path.indexOf('.js') != -1 ){
                li.info('正在加载服务:'+service_name);
                require( path ).route( app );
            }
        }
	});
};

// ==================  初始化server ===================
var port = 6789;
app = module.exports = express();

//配置art-template
artTmpl.config('base', __dirname+'/views');
artTmpl.config('extname', '.htm');

//处在开发环境
if( uutil.isInDevelopment() ){
    artTmpl.config('cache', false); //闭页面缓存
}else{ //生产环境才压缩页面
    artTmpl.config('compress', true);
}

app.engine('.htm', artTmpl.__express);
app.set('view engine','htm');

function app_route(req, res, next){
    return [
        function(){
            console.log('I am the first Function!');
            next();
        },
        function(){
            console.log('I am the second one!');
            next();
        }
    ];
}

app
    .use(express.json())
    .use( express.logger({format : ':method :url'}))
    //.use(express.bodyParser({keepExtensions:true, limit:10000000, defer:true}))
    .use(express.cookieParser())
    .use(express.urlencoded())
    .use(IdChecker(getNewId))
    .use(UserAuth()); //验证用户登录，如果已经登录，将用户信息保存在req.user，如果未登录，则跳转到登录页
    //.use(app_route());
app.use(express.compress()); //开启内容压缩功能
app.set('views', __dirname+'/views');
app.set('view engine','html');
app.set('layout',true);
app.use(express.favicon());//忽略掉favicon的请求
app.engine('html', require('jqtpl-dsx').__express);
module.exports.ready = dashixiong.ready;


//================== 注册各种service ================ 
// 主要的service有:
// 客户购物服务: store_service.js , 下单, 文章, 外卖单等功能
// 管理员服务: admin_service.js, 订单查询, 产品管理等功能
// 微信消息处理服务: weixin_service.js, 消息验证, 应答各种微信消息
// 每一个service 模块必须提供route方法
fs.readdir('./service', function (err, files) {
    registerService( files, app );
});

