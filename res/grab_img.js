/**
 * Created by zed on 15-3-6.
 */
//依赖模块
var imageinfo = require('imageinfo');//版本^1.0.4,这个模块可以获得图片大小，格式，长宽
var fs = require('fs');
var http = require('http');
var request = require("request");
var conf = require( '../conf' );
var pool = conf.getPool();  //打开数据库链接
var hash = require('../lib/md5');

//---------------首先备份数据库，防止意外--------------
//1>，node update_user_wx_info.js
//2>
//线上配置nginx位置
//---/upload/heads
//alias----/home/uploads/dashixiong/user_head/
//3>重启nginx
//4>检查有没有install imageinfo
//5>node grab_img.js
//6> 进数据库,访问测试下有没有问题
var sql = 'select id,head from User where head is not null';//select id,head from User
var dir = '/home/uploads/dashixiong/user_head/';//物理路径----/home/zed/grab_img/
var head = 'http://img.ksmimi.com/upload/heads';//数据库路径-----http://img.ksmimi.com/grab_img/

pool.query( sql, function (err, ret) {
    var start = new Date().getTime();
    var len = ret.length;
    var tlen = 0;

    //循环取出数据库中图片绝对路径
    ret.forEach(function(dol,i){
        if(dol.head&&dol.head.indexOf('http://')==0){
            tlen +=1 ;
            console.log( '进度', (i+1)+'/'+len+'  ===  '+dol.id+'----success' );
            download(dol.head,dol.id);
        }else{
            console.log( '进度', (i+1)+'/'+len+'  ===  '+dol.id+'----no path' );
        }
        if(i==len-1){
            console.log('写入有效头像图片 '+tlen+' 张');
            console.log('读取数据库头像路径次数 '+len+' 次');
            var t_deta = new Date().getTime() -start;
            console.log('更新微信头像到rockcy服务器总耗时,未计算图片读写时间');
            console.log( '==='+'【'+ t_deta/1000 +'】秒'+'===' );
            return;
        }
    });

    //下载头像到本地
    function download(url,id) {
        //无脑请求图片地址
        http.get(url, function (res) {
            var chunks = [];
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });
            res.on('end', function () {
                var buf =Buffer.concat(chunks);
                var hashname = hash.md5(id+new Date().getTime);//加密下头像图片名称
                var pathname = dir+hashname;
                //1 先写入图片
                fs.writeFileSync(pathname+'.jpg' , buf);//先随意以一种图片格式写入
                //2 直接取得图片格式
                var fileData = fs.readFileSync(dir+hashname+'.jpg');
                var info = imageinfo(fileData);//可以获得png, jpg, gif, swf大小，格式，长宽,只要你想要！
                //3 处理图片格式
                var str = info.format;
                var imgType = '.'+str.toLowerCase();
                //4 文件重命名,默认写为jgp格式,在对破图进行重命名
                var rename = hashname+imgType;
                //如过是正确格式，则不进行重命名操作，提高效率
                if(str.toLowerCase()!='jpg'){
                    fs.renameSync(pathname+'.jpg',dir+rename);
                }
                //5 更新sql头像地址
                var sqlurl = rename;//数据库只存文件名
                pool.query('update User set head = ? where id =?',[sqlurl,id],function(err){
                    if(err){
                        console.log(err);
                    }
                });
            });
        }).on('error', function (err) {
            console.log(err);
        });
    };

});



