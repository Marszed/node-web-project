//通过API在我们自己的后台管理微信的功能
var uutil = require('../lib/util');
var asyncMgr = require('../lib/asyncMgr');
var dashixiong = require('../controllers/dashixiong');
var admin = require('../controllers/admin');
var request = require('request');
var hash = require( '../lib/md5' );
var conf = require('../conf');
var API = require('wechat').API;
var api = new API(conf.wx.wx_app_id, conf.wx.wx_app_secret);

//--------------------------- 中间件 ----------------------------//
var middleware_load_products_map = require( '../lib/middleware_load_products_map_of_shop' );
var middleware_get_config_of_shop = require( '../lib/middleware_get_config_of_shop' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'admin_service.js');
var ld = uutil.getLogger('DEBUG', 'admin_service.js');

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 

var token_obj = null,
    token_obj_hjdsx = null;

//获取访问微信高级权限的access_token
var accessToken = function (fn) {
    var now = new Date().getTime();

    if( token_obj ){//看看是不是过期了, 过期之后得重新获取一下access_token
        if( now - token_obj.expires_in_future >= 0  ){//过期了
            ld.debug( 'access_token 过期了, set 为null. 即将重新请求' );
            token_obj = null; 
        }
    }
    
    if( !token_obj ){//还没有token 或者 token过期
        request({
            url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ conf.wx.wx_app_id +'&secret=' + conf.wx.wx_app_secret
        }, function(err, res_obj, body){
            token_obj = JSON.parse(body);
            token_obj.expires_in_future = new Date().getTime() + token_obj.expires_in*1000;//未来某个时间过期, 目前微信token 过期的时间是120分钟(7200秒)

            ld.debug( '请求到的token是: ' );
            ld.debug( token_obj );

            fn&&fn( null, token_obj);
        });
        return;
    }
    
    ld.debug( 'access_token 还有'+ ( token_obj.expires_in_future - now )/1000  +'秒过期' );
    fn( null, token_obj );
};


var accessToken_hj = function (fn) {
    var now = new Date().getTime();

    if( token_obj_hjdsx ){//看看是不是过期了, 过期之后得重新获取一下access_token
        if( now - token_obj_hjdsx.expires_in_future >= 0  ){//过期了
            ld.debug( 'access_token 过期了, set 为null. 即将重新请求' );
            token_obj_hjdsx = null;
        }
    }

    if( !token_obj_hjdsx ){//还没有token 或者 token过期
        request({
            url : 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid='+ conf.wxs['hjdsx'].wx_app_id +'&secret=' + conf.wxs['hjdsx'].wx_app_secret
        }, function(err, res_obj, body){
            token_obj_hjdsx = JSON.parse(body);
            token_obj_hjdsx.expires_in_future = new Date().getTime() + token_obj_hjdsx.expires_in*1000;//未来某个时间过期, 目前微信token 过期的时间是120分钟(7200秒)

            ld.debug( '请求到的token是: ' );
            ld.debug( token_obj_hjdsx );

            fn&&fn( null, token_obj_hjdsx);
        });
        return;
    }

    ld.debug( 'access_token 还有'+ ( token_obj_hjdsx.expires_in_future - now )/1000  +'秒过期' );
    fn( null, token_obj_hjdsx );

};

exports.route = function(app){

//列出当前公众账号有什么分组 ---- 小卖部
app.get('/dashixiongwx/admin/weixin/group/list', function(req, res){
    var is_ajax = req.query.is_ajax;
    var url = 'https://api.weixin.qq.com/cgi-bin/groups/get?access_token=';
    accessToken(function ( err, obj ) {
        request( url+obj.access_token, function (err, response, body) {
            //end( res, body );
            var obj = JSON.parse( body );
            
            if( is_ajax ){//ajax请求
                end( res, {
                    groups : obj.groups
                });
                return;
            }

            render( req, res, 'admin/wx_group_list', {
                layout : 'admin/layout',
                groups : obj.groups
            });

        });
        
    });
});


//列出当前公众账号有什么分组, ---- 呼叫大师兄
app.get('/dashixiongwx/admin/weixin/group/list/hjdsx', function(req, res){
    var is_ajax = req.query.is_ajax;
    var url = 'https://api.weixin.qq.com/cgi-bin/groups/get?access_token=';
    accessToken_hj(function ( err, obj ) {
        request( url+obj.access_token, function (err, response, body) {
            //end( res, body );
            var obj = JSON.parse( body );

            if( is_ajax ){//ajax请求
                end( res, {
                    groups : obj.groups
                });
                return;
            }

            render( req, res, 'admin/wx_group_list_hjdsx', {
                layout : 'admin/layout',
                groups : obj.groups
            });

        });

    });
});

//将一个客户放到一个分组去
app.get('/dashixiongwx/admin/weixin/group/move/:wx_id/:wx_group_id', function(req, res){
    accessToken(function ( err, obj ) {
        request({
            url : 'https://api.weixin.qq.com/cgi-bin/groups/members/update?access_token='+obj.access_token,
            method : 'POST',
            body : JSON.stringify({
                openid : req.params.wx_id,
                to_groupid : req.params.wx_group_id
            })
        }, function (err, response, body) {
            end( res, JSON.parse(body) );
        });
    });//end accessToken
});























};//end route

