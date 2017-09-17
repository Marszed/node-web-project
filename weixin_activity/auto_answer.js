var uutil = require('../lib/util');
var dashixiong = require('../controllers/dashixiong');
var words = require('../res/words');

//============================== 日志配置 ================================
var li = uutil.getLogger('INFO', 'auto_answer.js');
var ld = uutil.getLogger('DEBUG', 'auto_answer.js');


var map = words.map;//关键字的无逻辑自动回复

var getAnswer = function(msg, fn){
    var content = msg.content,
	    answ = map[content],
        user = msg.user;
	if(!answ){//没有预设的答案，那就看看是不是离开状态，如果是就显示离开的留言. 如果连离开留言都没有, 那就只能是求上帝保佑人工能够尽快回复了
		dashixiong.getCurLeaveStatus(user.shopId, function(err, _status){
			if(_status){
				fn(null, _status.content);
				return;
			}
			fn(null, null);
		});
        return;
	}
	fn(null, answ);
};

module.exports = function (msg, weixin, next) {
    console.log( '自动答复机器人启动...', msg.content );
	getAnswer(msg, function(err, answer){
        ld.debug('自动回答是 ' + answer);
		if(!answer){//没有自动回答, 这样的话就需要人工回答了
			//------------------邮件通知
			//dashixiong.sendEmail({
			//	recieverEmail : 'auscar@qq.com',
			//	subject : '【大师兄】'+msg.content,
			//	messageContent : msg.content
			//});
			

			uutil.sendWxMsg(weixin, {
                fromUserName : msg.toUserName, 
			    toUserName : msg.fromUserName, 
			    msgType : "text",
			    content : '',//用空消息回复一下微信, 不然微信在收不到消息5秒后关闭通道, 然后重试几次
			    funcFlag : 0 
            }, msg);
            //next();
			return;
		}

        //如果能运行到这里,说明预设的回答中有设有这个msg的回答 
		uutil.sendWxMsg(weixin, {
			fromUserName : msg.toUserName, 
			toUserName : msg.fromUserName, 
			msgType : "text",
			content : answer,
			funcFlag : 0 
		}, msg);
        //next();

	});//end getAnswer
    
};

