var uutil = require('../lib/util'),
    end = uutil.end;
var endErr = uutil.endErr,
    sureAry = uutil.sureAry,
    sureObj = uutil.sureObj;

var dashixiong = require('../controllers/dashixiong'),
    render = uutil.render;

//--------------------------- 中间件 ----------------------------//
var middleware_load_products_map = require('../lib/middleware_load_products_map_of_shop');
var middleware_load_user_by_wx_id = require('../lib/middleware_load_user_by_wx_id');
var middleware_get_config_of_shop = require('../lib/middleware_get_config_of_shop');
var middleware_power = require('../lib/middleware_power');//这个模块里面有各种权限的中间件

var middle_only_id = function (req, res, next) {
    console.log('========================================================= middle_only_id');
    if (/^[0-9]+$/.test(req.params.shop_id)) {//这种路由是我们需要的
        next();
        return;
    }
    next('route');
};


exports.route = function (app) {

    //我的订单
    app.get('/dashixiongwx/my/orders',
        middleware_load_user_by_wx_id, //wx_id=oXvPNjv6ZxctraFq85u4ro2m04S4---此中间件根据微信id查询用户id
        function(req, res){
            var user_id = req.user.id || 0;//利用中间件查询用户id
            dashixiong.getUserOrderByUserId(user_id,function(err, ret){      //先查询UserOrder表
                var userOrderId = ret[0].id;
                var productIds = ret[0].productIds;
                var timeStamp = ret[0].timeStamp;
                var dt = new Date(timeStamp);
                var month = dt.getMonth()+1;
                var date = dt.getDate();
                var hour = dt.getHours();
                var second = dt.getSeconds();
                //根据查询到的productIds查询Product表中的title、img、price
                //把productIds拆分成单个的菜品productId
                dashixiong.getProductByProductIds(productIds, function(err2, ret2){

                    //从ProductComment表中查询订单中的菜品已评论
                    dashixiong.getCommentStatusByUserOrderIdProductId(userOrderId,productIds,function(err3,ret3){
                        var status = [];
                        if(ret3.length){
                            status = ret3;
                        }
                        //渲染到页面
                        render(req, res, 'productComment/my-orders', {
                            layout : false,
                            user_id:user_id,
                            month:month,
                            date:date,
                            hour:hour,
                            second:second,
                            products:ret2,
                            wx_id:req.query.wx_id,
                            userOrderId:userOrderId,
                            status:status
                        });
                    });
                });
            });
    });


    //订单评论
    app.get('/dashixiongwx/product/comment', function(req, res){
        var userOrderId = req.query.userOrderId;
        var wx_id = req.query.wx_id;
        var userId = req.query.userId;
        var productId = req.query.productId;
        var title = req.query.title;
        var img = req.query.img;
        var price = req.query.price;
        render(req, res, 'productComment/product-comment', {
            layout : false,
            userId:userId,
            userOrderId:userOrderId,
            productId:productId,
            img:img,
            title:title,
            price:price,
            wx_id:wx_id
        });
    });

    //提交评论到数据库
    app.post('/dashixiongwx/product/comment/submit',function(req,res){
        var userId = req.body.userId,
            productId = req.body.productId,
            content = req.body.content,
            userOrderId = req.body.userOrderId;
        var timeStamp = new Date().getTime();
        dashixiong.submitComment(userOrderId,userId,productId,content,timeStamp,function(err,ret){
            res.end("评论成功");
        });
    });


    //订单评价完成
    app.get('/dashixiongwx/product/comment/finish',function(req, res){
        render(req, res, 'productComment/comment-finish', {
            layout : false
        });
    });


    //根据productId从评论数据库查询每种2条评论信息，并渲染在页面
    app.post('/dashixiongwx/product/comment/render',function(req, res){
        var productIdArr = req.body.productIdArr;
        dashixiong.getAllProductComment(productIdArr,function(err, ret){
            //一、将ret中的评论封装成json格式的数据
            var data = {};
            ret = sureAry(ret);
            ret.forEach(function(v, i){
                //记录不存在
                if( !data[v.productId] ){
                    data[v.productId] = [{
                        head : v.head,
                        content : v.content
                    }];
                    return;
                }
                //记录已经存在，直接追加到对应的数组内
                data[v.productId].push({
                    head : v.head,
                    content : v.content
                });
            });

            //二、将json数据渲染到页面
            end(res, data);
        });
    });
};




