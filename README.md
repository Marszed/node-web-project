# redis install (MAC)
1. download --> https://redis.io/download 官网下载
2. unZip --> tar -xzf redis-*.*.*.tar.gz
3. mv --> mv **/redis-*.*.*.tar.gz /user/local (没权限加sudo)
4. test --> make test
5. install --> sudo make install
6. redis start --> redis-server
启动成功的标识<br>
![](https://github.com/Marszed/node-web-project/raw/master/gitImage/redis-server.png)

## ======redis自定义配置======
1: /user/local/redis-*.*.* 下新建 log(日志文件) bin(启动路径) etc(配置文件) db (本地数据库路径)
2: 将 /user/local/redis-*.*.*/src 下的 mkreleasehdr.sh，redis-benchmark， redis-check-rdb， redis-cli， redis-server拷贝到新建的bin (mv **/* **/*)
3: log 新建log-redis.log (vim log-redis.log)
4: 在etc目录下新建redis.conf配置文件 (vim redis.conf)
5: 配置如下:<br>
```ssh
#修改为守护模式
daemonize yes

#设置进程锁文件
pidfile /usr/local/redis-*.*.*/redis.pid

#端口
port 6379

#客户端超时时间
timeout 300

#日志级别
loglevel debug

#日志文件位置
logfile /usr/local/redis-*.*.*/log/log-redis.log

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
dir /usr/local/redis-*.*.*/db/

#指定是否在每次更新操作后进行日志记录，Redis在默认情况下是异步的把数据写入磁盘，如果不开启，可能
#会在断电时导致一段时间内的数据丢失。因为 redis本身同步数据文件是按上面save条件来同步的，所以有
#的数据会在一段时间内只存在于内存中
appendonly no

#指定更新日志条件，共有3个可选值：
#no：表示等操作系统进行数据缓存同步到磁盘（快）
#always：表示每次更新操作后手动调用fsync()将数据写到磁盘（慢，安全）
#everysec：表示每秒同步一次（折衷，默认值）
appendfsync everysec
```ssh



## ======redis常用命令说明======

redis-server redis服务器
redis-cli redis客户端
redis-benchmark redis性能测试工具
redis-check-aof AOF文件修复工具
redis-check-rdb RDB文件修复工具
