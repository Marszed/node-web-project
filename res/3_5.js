var conf = require('../conf'),
	uutil = require('../lib/util'),
	pool = conf.openDB();  //打开数据库链接

var query_3 = "select distinct userId from UserOrder where timeStamp>1393632000000 and timeStamp<1396310400000 and userId in ( select id from User where timeStamp>1393632000000 and timeStamp<1396310400000);";

pool.query(query_3, function (err, ret) {
    console.log( '3月份关注的人当中有'+ ret.length +'人在当月进行了购买 ' );

    var ids_for_4 = [];
    ret.forEach(function (user) {
        ids_for_4.push( user.userId );
    });

    var query_4 = "select distinct userId from UserOrder where timeStamp>1396310400000 and timeStamp<1398902400000 and userId in (  "+ ids_for_4.join() +" );";
    var query_5 = "select distinct userId from UserOrder where timeStamp>1398902400000 and timeStamp<1401580800000 and userId in (  "+ ids_for_4.join() +" );";

    pool.query(query_4, function (err, ret) {
        console.log( '3月份购买的人当中，'+ ret.length +'人在4月份也进行了购买' );

        var ids_for_4_buy = [];
        ret.forEach(function (user) {
            ids_for_4_buy.push( user.userId );
        });

        pool.query(query_5, function (err, ret) {
            console.log( '3月份购买的人当中，'+ ret.length +'人在5月份也进行了购买' );
        });

        var query_5_buy = "select distinct userId from UserOrder where timeStamp>1398902400000 and timeStamp<1401580800000 and userId in (  "+ ids_for_4_buy.join() +" );";
        pool.query(query_5_buy, function (err, ret) {
            console.log( '3月、4月都购买的人当中，'+ ret.length +'人在5月份也进行了购买' );
        });

    });

});

pool.query(query_3, function (err, ret) {
    console.log( '3月份关注的人当中有'+ ret.length +'人在当月进行了购买 ' );

    var query_4 = "select distinct userId from UserOrder where timeStamp>1396310400000 and timeStamp<1398902400000 and userId in (  select id from User where timeStamp>1393632000000 and timeStamp<1396310400000 );";
    var query_5 = "select distinct userId from UserOrder where timeStamp>1398902400000 and timeStamp<1401580800000 and userId in (  select id from User where timeStamp>1393632000000 and timeStamp<1396310400000 );";

    pool.query(query_4, function (err, ret) {
        console.log( '3月份关注的人当中，'+ ret.length +'人在4月份也进行了购买' );

        pool.query(query_5, function (err, ret) {
            console.log( '3月份关注的人当中，'+ ret.length +'人在5月份也进行了购买' );
        });

    });

});

