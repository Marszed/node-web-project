var df = require( '../lib/date.format' );
var request = require('request');
var hash = require( '../lib/md5' );
var printer_host = 'http://130018.54060.com';//3号店打印机的id
var service = '/service/sendPrintDataCombo.php';
var service_text = '/service/sendPrintData.php';
//var secret = 'auscarlin01%';
var secret = 'haoduojie@pyh';
var content = 'fuck you you are fool!!!!!!! \n';


exports.printText = function(content, fn){
    var createtime = new Date().getTime();
    //var type = 'twin';
    var type = 'text';
    var raw = [
        content,
        createtime,
        //qr_content,
        type
    ];
    raw = raw.join();
    raw += secret;
    
    var sig = hash.md5( raw );
    var url = printer_host+service_text;

    console.log(  url );

    request.post(url, {
    form : { 
        content : content,
        createtime : createtime,
        //qr_content : qr_content,
        type : type,
        key : sig
    }
    }, function (err, res, body) {
        console.log( body );
        fn&&fn( null, body )
    });
};
exports.print = function(content, fn){
    var qr_content = 'http://weixin.qq.com/q/JHUDzmfl5Eqd94An21ma';//3号店的二维码
    var createtime = new Date().getTime();
    var type = 'twin';
    //var type = 'text';
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

    console.log(  url );

    console.log( content );

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
        fn&&fn( null, body )
    });
};









