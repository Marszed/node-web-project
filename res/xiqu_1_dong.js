var conf = require('../conf'),
	uutil = require('../lib/util'),
    shop_2_room_paser = require( './room_parsers/shop_2' );
	pool = conf.openDB();  //打开数据库链接


var query ='select * from UserOrder left join AddressBook on UserOrder.addressId=AddressBook.id where UserOrder.shopId=2 and UserOrder.addressId is not null and UserOrder.timeStamp>1399593600000';


pool.query( query,  function (err, ret) {
    console.log( ret.length );
    var building_1 = [];
    var tmp;
    ret.forEach(function (order) {
        //console.log( shop_2_room_paser.parser(order.address) );
        tmp =  shop_2_room_paser.parser(order.address);
        if( tmp&&tmp.building == 1 ){
            building_1.push( tmp );
        }
    });

    var map = {};
    building_1.forEach(function (room_buy) {
        map[ room_buy.room ] = true;
    });

    console.log( map );


    var rt = [];
    var label = '';
    for( var i=1; i<=6; i++ ){
        for( var j=1; j<=22; j++ ){
            label =  '1栋' + j + uutil.two( j );
            //console.log( label );
            if( !map[ label ] ){
                rt.push( label ) ;
            }
        }
 
    }

    //console.log( rt );
});
