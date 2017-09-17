var df = require( '../lib/date.format' );
var request = require('request');
var hash = require( '../lib/md5' );
var printer_host = 'http://130016.54060.com';
var service = '/service/sendPrintDataCombo.php';
//var service = '/service/sendPrintData.php';
//var secret = 'haoduojie@pyh';
var secret = 'auscarlin01%';
//var content = 'http://www.ksmimi.com';
var content = 'fuck you you are fool!!!!!!! \n';

var test = function () {
content += '=============================== \n';
content += '=========== 订单内容 ==========  \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += '------------------------------ \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += '---------------------------- \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
content += 'fuck you you are fool!!!!!!! \n';
};

test();

var qr_content = 'http://weixin.qq.com/q/JHUDzmfl5Eqd94An21ma';
var createtime = new Date().getTime();
var type = 'twin';

var raw = [
    content,
    createtime,
    qr_content,
    type
];
raw = raw.join();
raw += secret;

var sig = hash.md5( raw );
var url = printer_host+service;

console.log( url );
//console.log( 'content: ', content );

//content = encodeURIComponent( content );

//url += '?type='+ type +'&createtime='+createtime+'&content='+content+ '&qr_content='+qr_content +'&key='+sig;
//url += '?type='+ type +'&createtime='+createtime+'&content='+content+'&key='+sig;

console.log(  url );

//request( url , function (err, res, body) {
//    console.log( body );
//});
exports.printOrderById = function( shop_id, order_id, fn){
    request.post(url, {
    form : { 
        content : content,
        createtime : createtime,
        qr_content : qr_content,
        type : type,
        key : sig
    }
    }, function (err, res, body) {
        console.log( body );
    });
};







