var express = require('express');
var IdChecker = require('./lib/IdChecker');
var fs = require('fs');
var util = require('util');
var http = require('http');
var crypto = require('crypto');
var UserAuth = require('./lib/UserAuth');
var hash = require('./lib/md5');
var querystring = require('querystring');
var uutil = require('./lib/util');
var dashixiong = require('./controllers/dashixiong');
var artTmpl = require('art-template');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'app.js');
var ld = uutil.getLogger('DEBUG', 'app.js');


//创建一个随机的、不太可能重复的id, prefix可以是任意字符串
var getNewId = function (prefix) {
    return hash.md5(new Date().getTime() + '' + prefix + Math.random());
};

//service自己管理自己业务范围的路由. 此函数把app 传入每一个service当中, 让他们自己来搞定自己的路由
var registerService = function (service_name_ary, app) {
    var path = null;
    service_name_ary.forEach(function (service_name, i) {
        path = './service/' + service_name;
        if (fs.statSync(path).isFile()) {
            if (path.indexOf('.js') != -1) {
                li.info('正在加载服务:' + service_name);
                require(path).route(app);
            }
        }
    });
};

// ==================  初始化server ===================
var app = module.exports = express();

// 配置art-template
artTmpl.config('base', __dirname + '/views');
artTmpl.config('extname', '.htm');

if (uutil.isInDevelopment()) {
    artTmpl.config('cache', false); //开发环境 关闭页面缓存
} else {
    artTmpl.config('compress', true); //生产环境 压缩页面
}

app.use(express.json())
    .use(express.logger({format: ':method :url'}))
    //.use(express.bodyParser({keepExtensions:true, limit:10000000, defer:true}))
    .use(express.cookieParser())
    .use(express.urlencoded())
    .use(IdChecker(getNewId))
    .use(UserAuth()) //验证用户登录，如果已经登录，将用户信息保存在req.user，如果未登录，则跳转到登录页
    .use(express.compress()) //开启内容压缩功能
    .engine('.htm', artTmpl.__express)
    .set('view engine', 'htm')
    .set('views', __dirname + '/views')
    .set('view engine', 'html')
    .set('layout', true)
    .use(express.favicon())//忽略掉favicon的请求
    .engine('html', require('jqtpl-dsx').__express);

module.exports.ready = dashixiong.ready;


//================== 注册各种service ================ 
// 每一个service 模块必须提供route方法
fs.readdir('./service', function (err, files) {
    registerService(files, app);
});

