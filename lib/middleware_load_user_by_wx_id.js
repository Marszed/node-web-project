var dashixiong = require( '../controllers/dashixiong' );
var uutil = require( '../lib/util' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'middleware_load_user_by_wx_id.js');
var ld = uutil.getLogger('DEBUG', 'middleware_load_user_by_wx_id.js'),
    end = uutil.end;


var render = uutil.render; 


var middleware_load_user_by_wx_id = module.exports = function (req, res, next) {
//	var wx_id = req.query.wx_id || req.params.wx_id || 'wx_323mmdiVsds2fbklsdopwvMMn';
//	var wx_id = req.query.wx_id || req.body.wx_id || req.params.wx_id || req.cookies.wx_id;
	var wx_id = req.cookies.wx_id || req.params.wx_id;//修复回复“道具”，链接无效
    if(req.query.orderId){//客户评论模板消息链接
        wx_id = req.query.wx_id;
    }
    if(!wx_id && uutil.isInDevelopment()){
        wx_id = req.query.wx_id;
    }
    //临时
    /*if(!wx_id){
        wx_id = req.query.wx_id;
    }*/


    var user = null;

    if( !wx_id ){
        render(req,res,'admin/sorry_tips',{
            layout : false,
            shop_id : req.params.shop_id || 0
        });
        return;
    }
    
	//获取用户的账号信息
	dashixiong.getUserByWxId(wx_id, function(err, ret){
		if(err){
			res.end(JSON.stringify(err));
            end( res, '很抱歉, 无法获取你的账户信息...' );
			return;
		}

		user = ret.length?ret[0]:{};
		li.info('========== 用户信息是 ===========');
		li.info(user);

        //如果cookie里面没有user_id和wx_id，存进去
        if( !req.cookies.wx_id || !req.cookies.user_id ){
            uutil.setCookie('wx_id', wx_id, res);
            uutil.setCookie('user_id', user.id, res);
        }

		console.log('wx_id,shop_id=== ', req.query.wx_id, req.query.shop_id);
        if( (!user.id) && req.query.shop_id){//没有用户id 但是有query中有shop_id, 说明用户在选择shop页面选择了自己的分店, 然后提交了这个请求. 有足够的信息进行自动注册了
		    ld.debug('========== 可能是以前很老的一批惠经的关注者, 没买过东西, 没有user, 自动注册 ===========');
		    console.log('===== 自动给TA注册一个号 ~~~~~');
		    dashixiong.newUser({shop_id : req.query.shop_id-0, qId : 0}, function(err, new_user_id){
			    //获得新用户id之后, 绑定微信id, 然后跟注册过的是一个流程了
				dashixiong.bindUser(new_user_id, wx_id, function () { //TODO: 绑定流程就不管他是不是成功了, 有空可以改进
                    console.log('绑定成功,跳转到首页 ', new_user_id, wx_id);
                    req.query.wx_id = wx_id;
                    req.query.shop_id = null;
			        //productListAll( req, res );//注册完之后重走流程
                    middleware_load_user_by_wx_id( req, res, next);//注册完之后重走load_user流程
				});
			});
            return;

        }

        //已注册用户但是自己没有shopId, 通过搜索关注. 用户在选择shop页面选择了自己的分店, 然后提交了这个请求. 更新一下他的shopId
        if( user.id && (!user.shopId) && req.query.shop_id){
		    ld.debug('========== 用户通过搜索关注！已经自动注册, 但是没有shopId ===========');
		    console.log('===== 更新一下他的shopId ~~~~~', req.query.shop_id);
		    dashixiong.updateUser({
                id : user.id,
                status : 1,
                shopId : req.query.shop_id - 0
            }, function (err, ret) {
                middleware_load_user_by_wx_id( req, res, next);//注册完之后重走load_user流程
            });
            return;

        }

        //--------------------- 如果用户信息为空, 引导用户到 选择店铺首页 --------------//
        if( (!user) || (!user.id) || !user.shopId ){
            //为什么要拦截？！！！！！！！！！！！！！！！！！！！！！！！！！！！！！！
            //res.end('No wx_id given!');
            //return;
            console.log('让他选shop ' );
            dashixiong.getAllSchoolAddress(function(err, selectShopAddress){
                render(req, res, 'wx/select_shop', {
                    layout: true,
                    ShopAddressList:selectShopAddress,
                    wx_id: wx_id
                });
            });
            return;
        }

        req.user = user;
        next();
    });//end getUserByWxId
    
};
