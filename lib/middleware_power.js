var conf = require( '../conf' );
var hash = require( './md5' );
var uutil = require('./util');

//------------------- 常用的工具方法 ---------------------------//
var end = uutil.end; 

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'lib/middleware_power_parttime_primary.js');
var ld = uutil.getLogger('DEBUG', 'lib/middleware_power_parttime_primary.js');
var backcontent = "<a href='javascript:history.go(-1)' style='font-size: 24px;'>back</a>";

//检查用户是否有权限登录到别的店
var checkShop = function(req, res){
    var status = true,
        user = req.user,
        power = user.power,
        shop_id = req.params.shop_id;
    console.log( 'shopId='+shop_id );
    console.log( 'bindTo='+user.bindTo );
    res.setHeader('Content-Type', 'text/html; charset=utf8');

    //权限够高的话，可以直接跨店
    if( power >= 4 ) return status;
    //没有shopId的时候不用验证
    if( !shop_id ) return true;

    //绑定的店铺和自己关注的店铺不一致，不通过
    //----lufeng---start---
    var bindToArr = new Array();
    if( typeof user.bindTo == 'number' ) user.bindTo += '';
    bindToArr = user.bindTo.split(',');
    for(var i = 0; i < bindToArr.length; i++){
        /*if( shop_id && shop_id != user.bindTo ){
            status = false;
        }*/
        if( shop_id && shop_id == bindToArr[i] ){
            status = true;
            break;
        }else{
            status = false;
        }
    }
    //----lufeng---end---

    return status;
};

//初级兼职, 送货, 拿快递
exports.parttime_primary = function (req, res, next) {
    if( !req.user ){
        end( res, '404 not found!/apache 2.5' );//随便输出一些东西, 骗他
        return;
    }

    if( !checkShop(req, res) ){
        res.render('admin/error_low_power',{
            layout : false
        });
        return;
    }

    if( req.user.power < 1 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }
    next();
};

//高级兼职, 打单, 配货
exports.parttime_senior = function (req, res, next) {
    console.log('========================================================= parttime_senior');
    if( !req.user ){
        end( res, '404 not found!/apache 2.5' );//随便输出一些东西, 骗他
        return;
    }

    console.log('req.user.power=' + req.user.power);

    if( !checkShop(req, res) ){
        res.render('admin/error_low_power',{
            layout : false
        });
        return;
    }

    if( req.user.power < 2 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }
    next();
};

//正式员工
exports.worker = function (req, res, next) {
    if( req.user.power < 3 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }

    if( !checkShop(req, res) ){
        res.render('admin/error_low_power',{
            layout : false
        });
        return;
    }

    next();
};

//客服
exports.customer_service = function (req, res, next) {
    if( req.user.power < 4 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }

    next();
};

//店长
exports.shopkeeper = function (req, res, next) {
    if( req.user.power < 5 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }

    next();
};

//运营
exports.operator = function (req, res, next) {
    if( req.user.power < 6 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }
    next();
};

//老板
exports.boss = function (req, res, next) {
    if( req.user.power < 10 ){//不够权限
        res.end("low power!"+backcontent);
        return;
    }
    next();
};



