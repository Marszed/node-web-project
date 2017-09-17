var accounter = require( '../controllers/accounter' );
var dashixiong = require('../controllers/dashixiong');
var util = require('../lib/util');

module.exports = function (msg, weixin, next) {
    dashixiong.getUserByWxId( msg.fromUserName, function (err, ret) {
        if(err){
            util.sendWxMsg(weixin, {
                fromUserName : msg.toUserName, 
		        toUserName : msg.fromUserName, 
		        msgType : "text",
			    content : '出了一点小问题, 我们在狂修!',
		        funcFlag : 0 
            }, msg);
            return; 
        }
        var u = ret[0];
        accounter.getUserFromCacheById(u.id, function (err, user) {
        //========================================== 业务逻辑开始 ==========================================
            if(!user){
                next();//用户没有登录
                return;
            }

            var content = '';
            if( msg.content == '#' || msg.content == '发帖' ) {//开启或关闭发布模式
                if( user.wx_edit_mode ){//结束发布模式
                    //TODO: 在数据库插入一个article, 获得id然后构造查看链接
                    console.log( '关闭发布模式 ');
                    user.wx_edit_mode = false; 
                    if( !user.wx_article ){
                        accounter.cacheUser( user );
                        util.sendWxMsg(weixin, {
                            fromUserName : msg.toUserName, 
		                    toUserName : msg.fromUserName, 
		                    msgType : "text",
			                content : '发布模式【已关闭】. 你貌似没有发布什么东西哦~',
		                    funcFlag : 0 
                        }, msg);
                        return;
                    }

                    //截取前10字为title
                    var regx_imgs = /!\[.+\]\(.+\)/ig;
                    var title = user.wx_article.replace(regx_imgs, '');//把图片都去掉
                    title = title.substr(0, 10);
                    title = util.trim( title );
                    if(!title){
                        title = '[奇图共赏]';
                    }
                    var article = {
	                	title : title,
	                	content : user.wx_article,
                        author : msg.user.nick,
                        user_id : u.id,
                        shop_id : msg.user.shopId,
	                	intime : new Date().getTime()
	                };
                    dashixiong.insertArticle(article, function (err, ret) {
                        user.wx_article = '';
                        accounter.cacheUser( user );
                        //weixin.sendMsg({
                        //    fromUserName : msg.toUserName, 
		                //    toUserName : msg.fromUserName, 
		                //    msgType : "text",
			            //    content : '发布模式【已关闭】. 刚才的内容已成功发布到社区! <a href="http://www.ksmimi.com/dashixiongwx/shop/'+ u.shopId +'/article/'+ ret.insertId +'">点击</a>本消息查看',
		                //    funcFlag : 0 
                        //});

                        var url = 'http://www.ksmimi.com/dashixiongwx/shop/'+ u.shopId +'/article/'+ ret.insertId;
                        var articles = [];
                        var ar = {
	                    	title : '发布成功',
	                    	description : '你方才回复的内容已成功发布到咱们社区!发布模式【已关闭】',
	                    	picUrl : 'http://s.ksmimi.com/dashixiong_static/img/ok.jpg',
   	                    	url : url 
	                    };
                        //解析出封面图片
                        var post_img = util.parseImgsInMarkdown( article.content );
                        console.log( '===========',post_img );
                        if( post_img ){
                            post_img = post_img[0];
                            ar.picUrl = post_img;
                        }
                        console.log('发送的消息是 ', ar);
	                    articles.push(ar);
	                    util.sendWxMsg(weixin, {
	                    	fromUserName : msg.toUserName,
	                    	toUserName : msg.fromUserName,
	                    	msgType : "news",
	                    	articles : articles,
	                    	funcFlag : 0
	                    }, msg);


                    });
                    return;

                }
                
                console.log( '开启发布模式 ');
                user.wx_edit_mode = true;
                content = '发布模式【已开启】. 回复一些文字或照片看看~ ';
                accounter.cacheUser( user );
                util.sendWxMsg(weixin, {
                    fromUserName : msg.toUserName, 
		            toUserName : msg.fromUserName, 
		            msgType : "text",
			        content : content,
		            funcFlag : 0 
                }, msg);
                return; 
            }    
            
            /* 运行到这里, 说明msg 是一个普通消息, 如果发布模式打开了, 则表示用户往后发的内容都是发布帖子 */

            //查看一下是不是自己可以处理的业务
            if( (!user.wx_edit_mode) || msg.eventKey  ){//不在发布模式, 或者在发布模式但是处理的是一条事件消息, 就把这条消息给别的handler处理
                console.log( '不在编辑模式, 给别的handler处理=== 走你 ===>>> ');
                next();
                return;
            }
            
            /* 接下来将用户的内容存入缓存中, 不过要根据用户的内容是文本还是图片进行区别对待 */
            var str_msg_got = '内容已收到, 可继续输入。点击"发帖"按钮, 或者回复"发帖"二字即可马上发布';
            if( msg.msgType == 'text' ){//文本消息
                console.log('==========text');
                if( !user.wx_article ) user.wx_article = '';
                user.wx_article += '\n\n'+msg.content
                accounter.cacheUser( user );//把内容写入缓存
                //回复操作指引
                util.sendWxMsg(weixin, {
                    fromUserName : msg.toUserName, 
		            toUserName : msg.fromUserName, 
		            msgType : "text",
			        content : str_msg_got,
		            funcFlag : 0 
                }, msg);
            }else if( msg.msgType == 'image' ){//图片消息
                console.log('==========image');
                //TODO: 将图片下载至服务器, 生成大图和小图, 然后才回复
                user.wx_article += '\n\n![大师兄小卖部社区图片]('+ msg.picUrl +')';
                accounter.cacheUser( user );//把内容写入缓存
                //回复操作指引
                util.sendWxMsg(weixin, {
                    fromUserName : msg.toUserName, 
		            toUserName : msg.fromUserName, 
		            msgType : "text",
			        //content : '保存成功, 再次按"发帖"或者回复"#"可退出发布模式并预览',
			        content : str_msg_got,
		            funcFlag : 0 
                }, msg);
            }
            
        //====================================================================================
        });//end getUserFromCacheById
    });//end getUserByWxId
};
