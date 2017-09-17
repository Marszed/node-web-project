/**
 * Created by lufeng on 15-1-9.
 */
var request = require('request');
var msg = 'hello hayagu 你好';
var pusMsgTohayagu = function(msg,hostname,port,fn){
     request({
         url : 'http://'+hostname+':'+port+'/dashixiongwx/api/app/wechat',
         method : 'POST',
         form : {
                msg : msg
             }
     },function(err, res, body){
         if(err){
             console.log("****app--error****");
             console.log(err);
             return ;
         }
         fn(err,body);
     });
}
module.exports = pusMsgTohayagu;
