//根据用户信息获取用户所在店铺的信息, 必须得保证之前调过中间件 middleware_load_user_by_wx_id
var dashixiong = require( '../controllers/dashixiong' );
var uutil = require( '../lib/util' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'middleware_get_config_of_shop.js');
var ld = uutil.getLogger('DEBUG', 'middleware_get_config_of_shop.js');


module.exports = function (req, res, next) {
    var user = req.user || {};
	var shop_id = req.params.shop_id || user.shopId;//每个用户是会和具体的一个分店绑定在一起的
    //好, 接下来继续获取这个店的所有配置
	dashixiong.getConfigOfShop(shop_id, function(err, config){
	    if(err){
	        ld.debug(err);
	    }   
        req.config = config;
        req.config_obj = uutil.settingArrayToObj( config );
        li.info( '========= 读取店铺'+ shop_id +'的配置 ======== ' );
        next();
    });
}; 
