var printer = require( './printer' );//打印机服务
var dashixiong = require( '../controllers/dashixiong' );
var uutil = require( '../lib/util' );
var asyncMgr = require( '../lib/asyncMgr' );

//--------------------------- 日志配置 ---------------------------//
var li = uutil.getLogger('INFO', 'order_printer.js');
var ld = uutil.getLogger('DEBUG', 'order_printer.js');


exports.printOrderById = function (shop_id, order_id, fn) {
    if( shop_id-0 != 3 )return;//目前只有3号店能自动打印

    var a = new asyncMgr.AsyncAction();
    a.register( 'get_shop_config' );
    a.register( 'get_order' );
    a.register( 'get_motto' );

    a.onAllDone = function () {
        //console.log('=============== order');
        //console.log( this.order);

        var content = [];
        //拼接订单内容, 开始打印
        content.push( '\n' ) ;
        content.push( 'BC!-BC!大师兄小卖部('+ this.config_obj.shopName +')订单\n' );
        //content.push( '大师兄小卖部('+ this.config_obj.shopName +')订单\n' );
        content.push( '\n' ) ;
        content.push( '“'+this.notice.content+'”\n' );
        content.push( '\n' ) ;
        content.push( '============ 收货信息 ==========\n' );
        content.push( '\n' ) ;
        content.push( '1.' + this.order.name + '\n' );
        content.push( '2.' + this.order.mobile + '\n' );
        content.push( '3.' + this.order.address + '\n' );
        content.push( '\n' );
        content.push( '============ 订单详情 ========== \n' );
        var snapshot = [];
        try {
            snapshot = JSON.parse( this.order.snapshot );
            var deliver_text = '';
            var deliver_info = uutil.getDeliverFee( snapshot.products_bought, snapshot.total_pay , shop_id ,a.config_obj );
            if( deliver_info ){//需要邮费
                snapshot.total_pay += deliver_info.price;
                deliver_text += '(含'+ deliver_info.price +'元跑腿费)';
            }
            content.push( snapshot.total_num +'件东西, '+'共'+ snapshot.total_pay.toFixed(1) +'元'+  deliver_text +'\n' );

            content.push( '================================ \n' );
        } catch (e) { ld.debug( e ); }
        snapshot.products_bought.forEach(function (product, i) {
            content.push( (i+1)+'. '+product.title+'x'+product.count +'\n' );
        });
        content.push( '\n' );
        content.push( '============ 如何吐槽 ========== \n' );
        content.push( '1. 微信直接回复我们即可\n' );
        content.push( '2. 新浪微博搜素 @大师兄小卖部\n' );
        content.push( '3. 店长手机: '+ this.config_obj.tel + '\n' );
        content.push( '\n' );
        content.push( '======= 如何使用我们的服务====== \n' );
        content.push( '微信-> 添加朋友-> 查找公众号-> 输入“大师兄小卖部”->点击第一个账号->点击关注即可\n' );
        content.push( '\n' );
        content.push( '或者扫描以下二维码:\n' );
        


        printer.print( content.join(''), function (err, res) {
            //fn&&fn( null, res );
            //printer.printText( '------------\n--------------\n-------------\n----------------\n--------------\n---------------\n' , function (err, res) {
            //printer.printText( '                  \n                   \n                    \n                    \n                  \n                   \n' , function (err, res) {
            printer.printText( '    \n     \n     \n      \n     \n     \n' , function (err, res) {
                fn&&fn( null, res );
            });
        });

    };
     
    dashixiong.getOrderById( order_id, function (err, ret) {
        if( !err ){
            a.order = ret[0];
        }
        a.thisDone( 'get_order' );
    });

    dashixiong.getConfigOfShop( shop_id, function (err, ret) {
        if( !err ){
            a.config_obj = uutil.settingArrayToObj( ret );
        }
        a.thisDone( 'get_shop_config' );
        
    });
    //获取公告
	dashixiong.getCurMotto(shop_id, function(err, ret){
		if(!err){
			a.notice = ret[0] || {content:'小卖部，大志向!'};
			a.thisDone('get_motto');
			return;
		}
		ld.debug(err);
		a.thisDone('get_motto');
	});
};












