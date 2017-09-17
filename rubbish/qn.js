var qn = require('qn'),
    fs = require('fs'),
    request = require('request');

var conf = require('../conf'),
	pool = conf.openDB();  //打开数据库链接

var client = qn.create({
  accessKey: 'hC90HGK2sef1ukzbH_TlfiAi-G3OzjbOupcklkkc',
  secretKey: 'x6dUQJoLryQHdyOcFfwZwHqKjV4geNGKtEhD6cDA',
  bucket: 'dashixiong',
  domain: 'http://dashixiong.qiniudn.com'
});


var ksmimi = 'http://img.ksmimi.com/uploads/products/',
    dsx = 'http://dashixiong.qiniudn.com/';



//获取所有产品
pool.query('select id,img from Product', function(err, ret){
    var count = 0,
        total = 0;

    function uploadImg( img, fn ){
        if( !img ){
            fn && fn({});
            return;
        }
        request.get({
                url : ksmimi + img.img,
                encoding : null
            },
            function(err, resp, body){

            client.upload(body, {filename: img.img}, function (err, result) {
                if(err) console.log(err);
                if(result && result.key) pool.query('update Product set imgQN=? where id=?', [result.key, img.id], function(){});
                fn && fn(result);
            });
        });
    }

    function init(items, fn){
        for(var i = 0; i < 5; i++){
            var img = items.shift();
            var r_img = /\.jpg$/ig;

            if( !img ){
                console.log('All done ...');
                return;
            }

            console.log('正在处理第' + (total+i+1) + ' 张图片...');

            if( !r_img.test(img.img) ){ //如果图片不合法
                img = null;
            }
            uploadImg(img, fn);
        }
    }

    function checkQueue(){
        if( count == 0 ){
            init(ret, function(){
                count++;
                total++;

                console.log('成功上传 ' + (total+count) + ' 张图片');

                if( count >= 5 ){
                    count = 0;
                    console.log('完成一个回合');
                    checkQueue();
                }
            })
        }
    }

    checkQueue();

});




