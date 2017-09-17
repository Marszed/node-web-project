var conf = require( '../conf' );
var pool = conf.openDB();  //打开数据库链接
var dao = require( '../models/dao' );

var query = 'select * from UserProfit where shopId=2';
var query_rp = 'insert into UserRP set val=?,userId=?';
//var query = 'select * from User';

pool.query( query, function (err, ret) {
    console.log( ret );
    console.log( '======>>>>一共n个用户: ', ret.length );
    initUserRP( ret, ret.length, function (err, ret) {
        console.log( '---->>>>>>>>>>搞定!!!!!!!!!!!!!!!!!! ' );
        console.log( total_rp );
    });
});

var total_rp = 0;
var initUserRP = function (ary, len_origin, fn) {
    if( !ary || !ary.length ){
        fn&&fn();
        return;
    }
    console.log( '进度: ==>>>', ary.length+'/'+len_origin );
    var up = ary.shift();
    console.log( '正在处理'+ up.userId +'的RP ' );
    var profit = up.totalPay - up.totalCost;
    if( profit > 0 ){//有钱赚才返给他RP
        var rp_return = (up.totalPay*0.015).toFixed(1);
    }else{//不赚钱那就不返他RP了
        initUserRP( ary, fn );
        return;
    }

    var rp = up.totalPay*0.015;//按照销售额的2% 返还RP, RP与人民币的汇率是100:1
    rp = Math.floor( rp*100 );
    console.log( up.userId+'总共收'+up.totalPay +'元, 利润为: ', profit, ' 返他RP: ', rp ) ;

    total_rp += rp;
    
    pool.query( query_rp, [ rp, up.userId ], function (err, ret) {
        if( err )console.log( '============>>>>>>>>>>>>', err );
        initUserRP( ary, fn );
    });

    

};

