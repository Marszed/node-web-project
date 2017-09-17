var products = {
	'1' : {id:1, title : '【康师傅】红烧牛肉面', img:'1.jpg', price:3.3, promote_price:2.9, cost:2.95, unit:'桶'},
	'2' : {id:2, title : '【康师傅】鲜虾鱼板面', img:'18.jpg', price:3.3, promote_price:2.9, cost:2.95, unit:'桶'},
	'3' : {id:3, title : '【统一】老坛酸菜牛肉面', img:'3.jpg', price:3.3, promote_price:2.9, cost:2.95, unit:'桶'},
	'4' : {id:4, title : '【港穗园】麦香包 豆沙味', img:'7.jpg', price:1.0, cost:0.7, unit:'个'},
	'5' : {id:5, title : '【港穗园】金丝奶皇包', img:'9.jpg', price:1.0, cost:0.7, unit:'个'},
	'6' : {id:6, title : '【三利和】酱汁洞庭鱼籽 ', img:'12.jpg', price:1.0, cost:0.75, unit:'个'},
	'7' : {id:7, title : '【乐聚】香酥QQ鱼', img:'15.jpg', price:1.0, cost:0.75, unit:'个'},
	'8' : {id:8, title : '【鱼乐party】石锅鱼', img:'8.jpg', price:1.0, cost:0.75, unit:'个'},
	'9' : {id:9, title : '【双汇】玉米火腿肠', img:'13.jpg', price:1.0, cost:0.53, unit:'根'},
	'10' : {id:10, title : '【雀巢】脆脆鲨 巧克力味', img:'14.jpg', price:1.0, cost:0.8, unit:'根'},
	'11' : {id:11, title : '【沧州】日式照烧 猪肉脯', img:'11.jpg', price:1.0, cost:0.8, unit:'个'},
	'12' : {id:12, title : '【农夫山味】鹌鹑蛋', img:'10.jpg', price:1.0, cost:0.75, unit:'个'},


	'13' : {id:13, title : '维他奶 豆浆原味', img:'17.jpg', price:3, promote_price:2.5, cost:1.95, unit:'盒'},
	'14' : {id:14, title : '维他奶 柠檬茶', img:'16.jpg', price:3, promote_price:2.5, cost:1.95, unit:'盒'},
	'15' : {id:15, title : '加多宝', img:'5.jpg', price:3.5, promote_price:3.3, cost:3.1, unit:'罐'},
	

	'16' : {id:16, title : '【杜蕾斯】激情装 单片', img:'21.jpg', price:3.5, cost:2.3, unit:'片'},
	'17' : {id:17, title : '【杜蕾斯】超薄装 单片', img:'20.jpg', price:4.5, cost:3, unit:'片'},
	'18' : {id:18, title : '【杜蕾斯】挚爱装 单片', img:'19.jpg', price:3, cost:1.7, unit:'片'},

	'19' : {id:19, title : '【爽口佳】烤辣鸭脖子', img:'24.jpg', price:1, cost:0.77, unit:'包'},
	'20' : {id:20, title : '【川牌坊】霸王牛肉', img:'23.jpg', price:1.5, cost:0.75, unit:'包'},
	'21' : {id:21, title : '【无穷】爱辣鸡米', img:'22.jpg', price:1, cost:0.7, unit:'包'},

	'22' : {id:22, title : '咪咪虾条 儿时经典味道', img:'27.jpg', price:0.5, cost:0.34, unit:'包'},
	'23' : {id:23, title : '【大众旺】奶油法饼', img:'26.jpg', price:1, cost:0.8, unit:'包'},
	'24' : {id:24, title : '【旺仔】QQ糖 香橙味', img:'25.jpg', price:1, cost:0.7, unit:'包'},

	'25' : {id:25, title : '【乖媳妇】山椒凤爪 辣爽好吃', img:'28.jpg', price:2.5, cost:2, unit:'包'},
	'26' : {id:26, title : '【联鑫盛】小腿王鸭腿 ', img:'30.jpg', price:1.5, cost:1.1, unit:'包'},
	'27' : {id:27, title : '【飞旺】豆花串 五香豆干', img:'31.jpg', price:1, cost:0.75, unit:'包'},

	'28' : {id:28, title : '【金芙纤麦】夹心饼干 牛奶味', img:'35.jpg', price:0.5, cost:0.35, unit:'条'},
	'29' : {id:29, title : '【知欣】鱿鱼 烧烤味', img:'44.jpg', price:2, cost:1.5, unit:'包'},

	'30' : {id:30, title : '【日清】合味道杯面 香辣海鲜味', img:'33.jpg', price:4.5, cost:4, unit:'杯'},
	'31' : {id:31, title : '【日清】合味道杯面 海鲜风味', img:'34.jpg', price:4.5, cost:4, unit:'杯'},
	'32' : {id:32, title : '【公仔面】碗仔面 海鲜味', img:'32.jpg', price:4.5, cost:4, unit:'碗'},

	'33' : {id:33, title : '【洁柔】抽纸 600抽', img:'29.jpg', price:4, cost:3, unit:'包'},

	'34' : {id:34, title : '【苏菲】可爱包 日用装 10片', img:'43.jpg', price:9.5, cost:7.5, unit:'包'},
	'35' : {id:35, title : '【苏菲】超熟睡290 夜用装4片', img:'39.jpg', price:6, cost:5.8, unit:'包'},

	'36' : {id:36, title : '【安尔乐】夜用纤巧卫生巾', img:'37.jpg', price:6.5, cost:4, unit:'包'},
	'37' : {id:37, title : '【安尔乐】日用纤巧卫生巾', img:'41.jpg', price:6, cost:4, unit:'包'},

	'38' : {id:38, title : '【ABC】日用绵柔排湿卫生巾8片', img:'36.jpg', price:10.5, cost:7, unit:'包'},
	'39' : {id:39, title : '【ABC】夜用绵柔排湿卫生巾8片', img:'40.jpg', price:12.5, cost:8, unit:'包'},

	'40' : {id:40, title : '【小妮】周期装日夜组合24片', img:'38.jpg', price:18.9, cost:12, unit:'包'},
	'41' : {id:41, title : '【小妮】草本轻盈 卫生护垫 25片装', img:'42.jpg', price:6, cost:5.3, unit:'包'},

	'42' : {id:42, title : '【乡吧佬】五香茶蛋2只', img:'45.jpg', price:2, cost:1.5, unit:'包'},
	'43' : {id:43, title : '鲜虾鱼板+双汇玉米肠套餐', img:'46.jpg', price:3.9, promote_price:3.8, cost:3.48, unit:'套'},
	'44' : {id:44, title : '【乐事】薯片 清新清爽黄瓜味', img:'47.jpg', price:3, cost:2.5, unit:'包'},
	'45' : {id:45, title : '【洽洽】香瓜子 葵花籽', img:'48.jpg', price:5, cost:3.95, unit:'包'},
	'46' : {id:46, title : '【乐事】薯片 美国经典原味', img:'49.jpg', price:3, cost:2.5, unit:'包'},
	'47' : {id:47, title : '【伊利】经典纯牛奶', img:'51.jpg', price:3, cost:2.375, unit:'包'},
	'48' : {id:48, title : '【银鹭】好粥道 莲子玉米粥', img:'50.jpg', price:3.8, cost:3, unit:'罐'}
};
module.exports = products;
