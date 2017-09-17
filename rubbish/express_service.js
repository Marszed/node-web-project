//快递业务
var asyncMgr = require('../lib/asyncMgr');
var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');
var logger = require('../controllers/logger');
var conf = require('../conf');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'service/express.js');
var ld = uutil.getLogger('DEBUG', 'servie/express.js');

//---------------------- 搞一些中间件来玩一下-------------------//
var middleware_load_user_by_wx_id = require( '../lib/middleware_load_user_by_wx_id' );
var middleware_get_config_of_shop = require( '../lib/middleware_get_config_of_shop' );

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 

//exports.isStop = true;
exports.route = function(app){

//活动首页
app.get('/dashixiongwx/express', middleware_load_user_by_wx_id, middleware_get_config_of_shop, function(req, res){



});

};//end route;
 
