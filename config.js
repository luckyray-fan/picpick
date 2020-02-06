var conf = require('./config.user');
var config = {
  pic: {
    prefix: 'IMG' //用来统一名称, 方便文件系统排序,IMG
  },
  qiniu: {
    bucket: '', //空间名称
    accessKey: '', //密钥
    secretKey: '',
    domain: '', //它给的暂时域名, 或者你绑定的域名
    zone: (qiniu) => qiniu.zone.Zone_z0, //如果要使用请查询七牛nodejs 文档, 区域对不上会报错的
    imageMagick: '' // 图片接口, 在七牛云图片样式中设置, 没有的话如果有 webp 等格式 iqdb 会报错
  },
  smms: {
    TOKEN: '', //smms token
    url: 'https://sm.ms/api/v2',
    uploadApi: '/upload'
  },
  sauce: {
    api_key: '' //测试后没什么用
  },
  proxy: {
    sock: 'socks://127.0.0.1:1080', //你懂的, 这是ssr同构!(正声)
    http: [
      {
        host: '',
        port: ''
      }
    ]
  },
  user: {
    pixiv: {
      user: '',
      pass: ''
    },
    nijie: {
      user: '',
      pass: ''
    }
  },
  path: {
    source: '',
    out: '',
    move: ''
  },
  output: {
    //事实证明这样写反而不好改
    start: '开始下载:',
    connect: (i) => `正在与${i}建立连接....`,
    done: (i, j) => `图片${i} 下载完成 大小为 ${j}k`,
    date: `当前日期为${new Date().toISOString().slice(0, 10)}`,
    move: (i, j) => `检测到文件 ${i} 大小为 ${j}k 小于 300k, 已经移动成功`,
    filesNum: (i) => `下载文件个数为${i}`,
    upload: (i) => `文件${i}上传完成, 开始查询与之相似的图片`,
    sauce: {
      '1': 'sauce 没有搜索到该图片',
      '2': 'sauce 使用次数已经达到上限'
    }
  }
};
config = Object.assign(config, conf);
//path 配置
if (!config.path.out) {
  config.path.out = config.path.source + '//out';
}
if (!config.path.move) {
  config.path.move = config.path.source + '//lowQuality';
}

module.exports = config;
