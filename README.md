# redis install (MAC)
1. download --> [官网下载](https://redis.io/download)
2. unZip --> tar -xzf redis-xx.xx.x.tar.gz
3. mv --> mv **/redis-xx.xx.x.tar.gz /user/local (没权限加sudo)
4. test --> make test
5. install --> sudo make install
6. redis start --> redis-server
启动成功的标识<br>
![](https://github.com/Marszed/node-web-project/raw/master/gitImage/redis-server.png)

## ======redis自定义配置======
1: /user/local/redis-xx.xx.x 下新建 log(日志文件) bin(启动路径) etc(配置文件) db (本地数据库路径)<br>
2: 将 /user/local/redis-xx.xx.x/src 下的 mkreleasehdr.sh，redis-benchmark， redis-check-rdb， redis-cli， redis-server拷贝到新建的bin (mv **/* **/*)<br>
3: log 新建log-redis.log (vim log-redis.log)<br>
4: 在etc目录下新建redis.conf配置文件 (vim redis.conf)<br>
5: 配置如下:<br>
```ssh
#修改为守护模式
daemonize yes

#设置进程锁文件
pidfile /usr/local/redis-xx.xx.x/redis.pid

#端口
port 6379

#客户端超时时间
timeout 300

#日志级别
loglevel debug

#日志文件位置
logfile /usr/local/redis-xx.xx.x/log/log-redis.log

#设置数据库的数量，默认数据库为16，可以使用SELECT 命令在连接上指定数据库id
databases 16

##指定在多长时间内，有多少次更新操作，就将数据同步到数据文件，可以多个条件配合
#save

#Redis默认配置文件中提供了三个条件：
save 900 1
save 300 10
save 60 10000

#指定存储至本地数据库时是否压缩数据，默认为yes，Redis采用LZF压缩，如果为了节省CPU时间，
#可以关闭该#选项，但会导致数据库文件变的巨大
rdbcompression yes

#指定本地数据库文件名
dbfilename dump.rdb

#指定本地数据库路径
dir /usr/local/redis-xx.xx.x/db/

#指定是否在每次更新操作后进行日志记录，Redis在默认情况下是异步的把数据写入磁盘，如果不开启，可能
#会在断电时导致一段时间内的数据丢失。因为 redis本身同步数据文件是按上面save条件来同步的，所以有
#的数据会在一段时间内只存在于内存中
appendonly no

#指定更新日志条件，共有3个可选值：
#no：表示等操作系统进行数据缓存同步到磁盘（快）
#always：表示每次更新操作后手动调用fsync()将数据写到磁盘（慢，安全）
#everysec：表示每秒同步一次（折衷，默认值）
appendfsync everysec
```
6: 验证自定义配置<br>
7: 先启动redis-server服务 redis-server /user/local/redis-xx.xx.x/etc/redis/conf<br>
8: 打开redis-cli 客户端 redis-cli, 输入set get试试结果，😆😆
配置成功的标识<br>
![](https://github.com/Marszed/node-web-project/raw/master/gitImage/redis-cli.png)



## ======redis常用命令说明======
redis-server redis服务器<br>
redis-cli redis客户端 (redis-cli -h 127.0.0.1 -p 6379 指定端口启动)<br>
redis-benchmark redis性能测试工具<br>
redis-check-aof AOF文件修复工具<br>
redis-check-rdb RDB文件修复工具<br>
ps aux|grep redis 查看redis进程，端口号

# mysql install (MAC)
1: [官网下载](https://www.mysql.com/downloads/) （现在需要注册oracle账户了，😶😳）<br>
2: 安装包(pkg) 一路点击下一步就好，需要备份初始账号密码 (弹框有提示)<br>
3: command + space 搜索 mysql， 点击 start mysql server<br>
    ![](https://github.com/Marszed/node-web-project/raw/master/gitImage/mysql.png)<br>
4: 将mysql加入到系统的环境变量<br>
    cd /usr/local/mysql/bin<br>
    vim ~/.bash_profile (新建一个.bash_profile文件)<br>
    ```ssh
    export NUM_DIR=~/.num
    #set color
    export CLICOLOR=1
    export LSCOLORS=EXFXBXDXCXegedabagacad
    #在该文件中添加mysql/bin的目录
    PATH=$PATH:/usr/local/mysql/bin
    ```<br>
5: OK! 现在可以进行mysql登录了, mysql -u root -p (第一次使用初始密码)<br>
6: 修改密码 SET PASSWORD FOR 'root'@'localhost' = PASSWORD('123456')<br>
7: enjoy yourself!😆😆

## ======mysql终端基础常用命令======
0: mysql -u root -p (本地用户登录)
1: show databases; (展示所有数据库)<br>
2: create dataBase XXX; (新建数据库)<br>
2: drop dataBase XXX; (删除数据库)<br>
3: user XXX; (应用新建的数据库)<br>
4: show tables; (当前数据库的所有表)<br>
5: source XXX.sql; (导入sql脚本)<br>
6: mysqldump -uroot -p -B dbname > dbname.sql (备份单个数据库)<br>
7: mysqldump -uroot -p --all-databases > all.sql (备份全部数据库)<br>
8: mysqldump -uroot -p -B dbname --table tablename > tablename.sql(备份表)<br>
9: mysql -uroot -p < name.sql (恢复数据库)<br>
10: mysql -uroot -p dbname < name.sql (恢复表,必须指定数据库)<br>
11: mysql：mysql -h ip -u user -p (远程登录)<br>
12: show variables like 'character%';(查看当前的编码)<br>
13: desc Table; (展示表结构)<br>
14: balabala...(😓😲😓)

# nginx install (MAC)
1: [官网下载](https://brew.sh/index_zh-cn.html) （通过homebrew软件包管理器安装）<br>
2: brew install nginx

## ======nginx常用命令======
sudo nginx start 启动<br>
nginx -s quit 退出<br>
nginx -s reload 重新加载<br>
nginx -t 测试nginx.conf配置<br>
/usr/local/etc/nginx(ngix.conf配置文件)<br>
/usr/local/cellarbr<br>
/usr/local/var

# pm2 install
npm install -g pm2

## ======pm2常用命令======
``` javascript
// 安装更新卸载
npm install pm2 -g //安装pm2,可能需要sudo权限
pm2 update // 更新pm2
pm2 uninstall pm2 //移除pm2

// 开启关闭
pm2 start server.js //启动server.js进程
pm2 start server.js -i 4 //启动4个server.js进程
pm2 restart server.js //重启server.js进程
pm2 stop all // 停止所有进程
pm2 stop server.js //停止server.js进程
pm2 stop 0 //停止编号为0的进程

// 配置启动信息
pm2 start app.json
{
  "apps" : [{
    "script"    : "server.js",  //进程名
    "instances" : "max",   //开启进程数，可为数值，也可为max。与服务器cpu核数相关
    "exec_mode" : "cluster" // 可选：fork(服务器单核推荐) cluster(多核推荐)
  }]
}

// 查看
pm2 list //查看当前正在运行的进程
pm2 show 0 //查看执行编号为0的进程

// 监控
pm2 monit //监控当前所有的进程
pm2 monit 0 //监控批评行编号为0的进程
pm2 monit server.js //监控名称为server.js的进程

// 日志
pm2 logs //显示所有日志
pm2 logs 0 //显示执行编号为0的日志
pm2 logs server.js //显示名称为server.js的进程
pm2 flush  //清洗所有的数据[注：我没有试出来效果]
```




