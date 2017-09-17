var takeaway = require( '../controllers/takeaway' );
var dashixiong = require( '../controllers/dashixiong' );
var logger = require('../controllers/logger');
var uutil = require('../lib/util');

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'takeaway_service.js');
var ld = uutil.getLogger('DEBUG', 'takeaway_service.js');

//=============== 常用的工具方法 =================
var render = uutil.render; 
var end = uutil.end; 
var endErr = uutil.endErr; 

exports.route = function(app){

//导入外卖单
//var t = require( '../res/food' );
//t.food.forEach(function (f, i) {
//    setTimeout(function () {
//        var takeaway_list = {
//            shop_id : 1,//注意这个是分店id, 不是外
//            name : f.shop.name,
//            address : f.shop.address,
//            description : f.shop.desc,
//            tels : JSON.stringify( f.shop.tels ),
//            food : JSON.stringify( f.food )
//        };
//
//        takeaway.insertTakeawayList(takeaway_list, function (err, ret) {
//
//        });
//        
//    }, i*500);
//
//});

var show_takeaway_list_handler = function (req, res) {
    var wx_id = req.query.wx_id || 'wx_323mmdiVsds2fbklsdopwvMMn';
	var user;
    console.log( req.originalUrl );
    console.log( req.query);
	//获取用户信息, 然后做统计
	dashixiong.getUserByWxId(wx_id, function(err, ret){
		if(err){
		    ld.debug(err);
			return;
		}
        user = ret[0]?ret[0]:{};
        if( !user.shopId && !(req.query.shop_id) ){
            render(req, res, 'wx/select_shop_general', {
		        layout : true,
                wx_id : wx_id
	        }); 
            return;
        }

        if( !user.shopId && req.query.shop_id ){//用户没有shopId, 不过链接上有shop_id是数据, 就是用这个数据更新一下用户的数据
            dashixiong.updateUser({
                id : user.id,
                shopId : req.query.shop_id - 0
            }, function(err, ret){
			    err&&ld.debug(err);
			});       

            user.shopId = req.query.shop_id - 0 ;
        }

        takeaway.listTakeaways( user.shopId, function (err, food) {
            food.forEach(function (f) {
                f.tels = JSON.parse( f.tels );
                f.food = JSON.parse( f.food );
            });
            render(req, res, 'wx/takeaway_list', {
		        layout : true,
		        food : food
	        });
        });

        
			
		//---------------- 统计使用外卖单的人数
		var log_str = user?user.id+'___'+wx_id : wx_id;
		logger.log('enter_takeaway', log_str, user.shopId );
        
	}); 
};

// 外卖单功能, 为用提供一个学校周边外卖的聚合页
app.get('/dashixiongwx/takeaway/list', show_takeaway_list_handler);




//------------------ takeaway 外卖单 ------------------------ //
app.get('/dashixiongwx/admin/shop/:shop_id/takeaway/add', function(req,res){
    render(req, res, 'admin/takeaway_add', {
        layout : true
    });
});
app.get('/dashixiongwx/admin/shop/:shop_id/takeaway/del/:takeaway_list_id', function(req,res){
    takeaway.delTakeawayList(req.params.takeaway_list_id-0, function () {
        res.redirect( '/dashixiongwx/admin/shop/'+ req.params.shop_id +'/takeaway/list' );
    });
});

app.get('/dashixiongwx/admin/shop/:shop_id/takeaway/edit/:id', function(req,res){
    var id = req.params.id - 0;
    takeaway.getTakeawayListById( id, function (err, ret) {
        if( err ){
            end(res, '出了点小问题, 刷新试试. 要还不行, 那就是不行了。歇息会吧. ');
            return;
        }
        var takeaway_list  = ret[0];
        takeaway_list.tels = JSON.parse( takeaway_list.tels );
        takeaway_list.tels = takeaway_list.tels.join('');
        render(req, res, 'admin/takeaway_edit', {
            layout : true,
            takeaway : ret[0]
        });
    });
});

app.get('/dashixiongwx/admin/shop/:shop_id/takeaway/food/:id', function(req,res){
    var id = req.params.id - 0;
    console.log( '==== id is ',id );
    takeaway.getTakeawayListById( id, function (err, ret) {
        console.log(err, ret);
        if( err ){
            end(res, '出了点小问题, 刷新试试. 要还不行, 那就是不行了。歇息会吧. ');
            return;
        }
        console.log( ret[0] );
        render(req, res, 'admin/takeaway_food', {
            layout : true,
            takeaway_list : ret[0]
        });
    });
    
    
});
app.post('/dashixiongwx/admin/shop/:shop_id/takeaway/food/update/:takeaway_list_id', function(req,res){
    var takeaway_list_id = req.params.takeaway_list_id - 0;
    var shop_id = req.params.shop_id - 0;

    takeaway.updateTakeawayList( {
        id : takeaway_list_id,
        food : req.body.food
    }, function (err, ret) {
        //res.redirect( '/dashixiongwx/admin/shop/shop_id/takeaway/list' );
        end(res, {
            code : 0,
            msg : 'sus'
        });
    });
});


app.post('/dashixiongwx/admin/shop/:shop_id/takeaway/doadd', function(req,res){
    var takeaway_list = {
        shop_id : req.params.shop_id-0,//注意这个是分店id, 不是外
        name : req.body.name,
        address : req.body.address,
        description : req.body.description,
        tels : req.body.tels.split('\n')
    };

    takeaway_list.tels = JSON.stringify( takeaway_list.tels );
    takeaway_list.food = JSON.stringify( [] );

    takeaway.insertTakeawayList(takeaway_list, function (err, ret) {
        res.redirect( '/dashixiongwx/admin/shop/'+ req.params.shop_id +'/takeaway/list' );
    });
});

app.post('/dashixiongwx/admin/shop/:shop_id/takeaway/doedit', function(req, res){
    var takeaway_list = req.body.takeaway; 

    console.log( takeaway_list );

    takeaway_list.tels = JSON.stringify( takeaway_list.tels.split('\n') );

    takeaway.updateTakeawayList(takeaway_list, function (err, ret) {
        console.log(err, ret);
        res.redirect( '/dashixiongwx/admin/shop/'+ req.params.shop_id +'/takeaway/list' );
    });
});

app.get('/dashixiongwx/admin/shop/:shop_id/takeaway/list', function(req,res){
    var shop_id = req.params.shop_id - 0;
    
    takeaway.listTakeaways(shop_id, function (err, _takeaways) {
        render(req, res, 'admin/takeaway_list', {
            takeaways : _takeaways 
        });
    });

});




};
