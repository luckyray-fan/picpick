# picpick

批量图片获取并对相应 url 下载图片

项目是如何写成的可以看[这里](https://luckyray-fan.github.io/2020/02/02/nodejs-app-picpick)

**效果**

![部分图片](https://luckyray-fan.github.io/image/picpick-1.png)

## 使用说明

如果有符合以下条件可以试着使用

- node 版本最新
- 七牛云
- 拥有可以访问 twitter 等网站的代理

## 使用方法

- git clone
- 配置

  - 创建一个文件 config.user.js: 因为不想上传我的配置

    > 内容 module.exports={}

  - 七牛云
  - socks 代理
  - 要搜索的文件夹目录地址

- 在文件夹目录下使用 node index
  - 如果有暂停没有动, ctrl + c 停止
  - 运行 node test

## 使用建议

目前刚刚写好, 最多一次连续查询了 150+ 的图, 下载成功 350+ 张, 应该是没问题如果想看日志, 可以看 `imageInfo.log`, 图的搜索历程就在其中

## 简单介绍

目的流程: 筛选出不清晰的图片 -> 利用图片搜索结果 -> 下载

- 筛选: 如果图片大小小于 300k 就搜索
- 搜索: 查询 sauce, ascii2d, iqdb
- 下载: 解析查询结果, 使用 socket 代理建立连接下载(毕竟不少图片是 pixiv 和 twitter)

> 关于网站查询结果 sauce: pixiv, twitter 居多, 能找到很多其他网站 ascii: pixiv, twitter iqdb: 各大图库, 例如 danbooru tineye: 没能解析, 使用了 cloud 防护, 尝试了 puppteer 后放弃了, 可以手动访问然后请求带上 cookie 试试
