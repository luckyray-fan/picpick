var { doSearch } = require('./src/picpick');
var { get, getImg, getSource } = require('./src/get');
var { getLowDir } = require('./index');
var { waitIpPool } = require('./src/sauce');
var imgArr = getLowDir('D://project//fe//plugin//picpick//img//lowQuality');
var logger = require('./src/log');

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

var imgInfos = [];
(async () => {
  await waitIpPool();
  var searchArr = [];
  for (let i = 0; i < imgArr.length; i++) {
    let k = imgArr[i];
    let imgInfo = {
      name: k.name,
      upload: {
        url: '',
        size: ''
      },
      download: [],
      searchSite: {
        saucenao: '',
        ascii2d: '',
        iqdb: ''
      }
    };
    imgInfos.push(imgInfo);
    await sleep(2000);
    searchArr.push(
      doSearch(k.path, k.name, imgInfo).then((i) => {
        logger.imgLogger.info(i);
        return i;
      })
    ); //想打印
  }
  let results = await Promise.all(searchArr);
  let success = results.filter((i) => i == 1).length;
  console.log(`下载成功的数目${success}, 下载失败的数目为${results.length - success}`);
})();

// async function test() {
//   await getSource('http://nijie.info/view_popup.php?id=259046');
// }
// test();

//nijie
//saucenao change , ascii2d api test, 其他网站api
//timeout deal, socket closed deal, all problem that need retry
//filename png, jfif sort √
//模拟登陆, 代理池等
//fileObj = {name:,uploadurl:,downloadrul:[],searchsite:{saucenao:429,ascii2d:timeout},size:,downloadSize:[]}
//数据传递较多的情况下, 编写一个数据接口, 非常适用于面向对象
//包含有多个功能, 不同业务, 使用面向对象的编程方法, 这次太麻烦了就不这么弄了
//编写单个接口功能时, 先将其可能的错误都进行一定的处理, 使用错误code来代指错误情况
//打印log在业务逻辑中, 接口中仅传递信息code
//事先想好可能的bug并打印信息
//编写函数写一个js doc 方便debug时编写返回值等
//面向对象时, 每个发出请求的函数传入已定义好的请求

//bug fix: iqdb, https://undefined, sauce 429
//enhance: search flow(如果网站给出的source没法解析, 使用下一个网站的source), 当前下载数目
//并行下载数目控制, 为什么nodejs会卡住, 增加代理网站
//选择下载质量最好的网站, 有pixiv不要twitter等
//下载重试, 查询控制(每个ip 30秒内查5次, 并考虑查询重试的时间)
