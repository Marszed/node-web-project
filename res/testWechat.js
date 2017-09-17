var app_id = 'wx4f17193b2f6626aa';
var app_secret = 'fd48420c58c2f04f50f7e4364d2014de';

var API = require('wechat').API;
var api = new API(app_id, app_secret);

api.sendText('oXvPNjpMiebi1zBb4tMtohAzeKR8', '同学你好, 我们在后台系统看到你在下单的时候貌似遇到了一点困难. 请问有啥可以帮到你的？', function (err, ret) {
    console.log(err, ret);
});
