// const runner = require('why-is-node-running');
var cheerio = require('cheerio');
var Axios = require('axios');
var logger = require('./log');
var { get } = require('./get');
const ProgressBar = require('progress');
var checkSite = 'https://icanhazip.com/'; //http://httpbin.org/get

var errorNum = 0,
  successNum = 0;
const progressBar = new ProgressBar(
  `-> 不可用的代理数目:errorNum, 验证成功的代理数目为:successNum `,
  { total: 1000 }
);
const CancelToken = Axios.CancelToken;
class Proxy {
  constructor(host, port, type) {
    this.host = host.trim();
    this.port = port.trim();
    this.type = type.trim();
  }
  getStr() {
    return this.type + '://' + this.host + ':' + this.port;
  }
}
var localGet = Axios.create({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36'
  }
}).get;
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
//TODO 应该集中获取网站内容然后解析, 为了让progressbar能好好显示
async function getElements(url, options, localGet, retryNum = 3) {
  if (retryNum > 0) {
    let cancel = CancelToken.source();
    var options = { cancelToken: cancel.token };
    setTimeout((i) => cancel.cancel(), 5000);
    var res = await localGet(url, options).catch(async (i) => {
      if (Axios.isCancel(i)) i.message = '超时被取消了'; //被cancel的请求返回的值不能get, 会栈溢出
      retryNum -= 1;
      logger.error(`${3 - retryNum}--访问${url} 发生 ${i.message}`);
      await sleep(2000);
      return await getElements(url, options, localGet, retryNum);
    });
    if (typeof res !== 'object') return '';
    var $ = cheerio.load(res.data);
    return $;
  } else {
    return;
  }
}
//连接代理出现的错误和连接代理访问网站出现错误
async function checkIp(ip) {
  let cancel = CancelToken.source();
  var options = { cancelToken: cancel.token }; //!!! TODO 草, 设成5000这个xici的ip终于肯返回了, 时灵时不灵
  var flag = true;
  options.proxy = ip;
  //在服务端运行用request最合适
  setTimeout((i) => cancel.cancel(), 5000);
  var res = await Axios.get(checkSite, options).catch((i) => {
    if (Axios.isCancel(i)) {
      // logger.error(`使用 ${ip.getStr()} 出现${i.message}`);
      // logger.error(`${ip.getStr()}对方服务器小气的很, 连上了也不回答, 读取超时啦`);
    }
    return '';
  });
  if (!res.data) flag = false;
  else flag = res.data.trim() === ip.host;
  flag ? successNum++ : errorNum++;
  progressBar.tick({
    errorNum,
    successNum
  });
  return flag;
}
var ipsArr = new Set();

async function getIpPool() {
  var sites = [
    'https://ip.ihuan.me/today/',
    'http://www.xicidaili.com/nn/',
    'https://www.kuaidaili.com/free/inha/',
    'http://www.superfastip.com/welcome/freeip/'
  ];

  var test1 = await Promise.all(
    sites.map(async (i) => {
      switch (i.split('.')[1]) {
        case 'xicidaili':
          let test2 = await Promise.all(
            [1, 2].map(async (j) => {
              let requestUrl = i + j;
              let $ = await getElements(requestUrl, '', get);
              if ($ === '') {
                logger.error(`访问xici-${j}失败`);
                return '';
              }
              logger.info(`访问xici-${j}页面成功`);
              let tet = await Promise.all(
                $('tr')
                  .map(async (i, elem) => {
                    if (i === 0) return;
                    var tem = $(elem).find('td');
                    var ip = tem.eq(1).text(),
                      port = tem.eq(2).text(),
                      type = tem.eq(5).text();
                    var proxy = new Proxy(ip, port, type);
                    if (await checkIp(proxy)) ipsArr.add(proxy);
                  })
                  .get()
              );
              console.log(j + '---' + tet.length);
              return 'xici的测试';
            })
          );
          console.log(test2);
          break;
        case 'ihuan':
          //需要事先获取一下cookie
          var date = new Date();
          let requestUrl = `${i}${date.getFullYear()}/${
            (date.getMonth() + '').length < 2 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1
          }/${(date.getDate() + '').length < 2 ? '0' + date.getDate() : date.getDate()}/${
            (date.getHours() + '').length < 2 ? '0' + date.getHours() : date.getHours()
          }.html`;
          var cookie = `__cfduid=d1164f990301d8c847e9a5a1c94253bed1579953097; Hm_lvt_8ccd0ef22095c2eebfe4cd6187dea829=1579953099,1579967399,1580015419; Hm_lpvt_8ccd0ef22095c2eebfe4cd6187dea829=1580653762; cf_clearance=d7656157cc257fcacbea74ebd0ea48430dbbb1c6-1580654626-0-250`;
          let $ = await getElements(
            requestUrl,
            {
              headers: {
                cookie,
                referer: requestUrl,
                origin: 'https://ip.ihuan.me'
              }
            },
            get
          );
          if ($ == '' || $('.text-left').length <= 0) {
            logger.error('访问ihuan失败');
            return 'ihuan的测试';
          }
          var $text = $('.text-left');
          $text = $($text[0].children).filter((i, j) => j.type === 'text');
          return await Promise.all(
            $text
              .map(async (i, j) => {
                let tem = $(j)
                  .text()
                  .trim()
                  .split('@');
                var proxy = new Proxy(
                  tem[0].split(':')[0],
                  tem[0].split(':')[1],
                  tem[1].slice(0, 5) === 'HTTPS' ? 'HTTPS' : 'HTTP'
                );
                if (await checkIp(proxy)) ipsArr.add(proxy);
              })
              .get()
          );
        case 'kuaidaili':
          let test3 = await Promise.all(
            [1, 2].map(async (j) => {
              var requestUrl = i + j;
              var options = {
                headers: {
                  Referer: 'https://www.kuaidaili.com/free/inha/',
                  Host: 'www.kuaidaili.com'
                }
              };
              var $ = await getElements(requestUrl, options, get);
              await sleep(500); //仍然是503, 也许要换个ip, 或者加个cookie,或者干脆无头浏览器?算了, 不重要
              if ($ == '') {
                logger.error(`访问kuaidaili-${j}失败`);
                return '';
              }
              logger.info(`访问kuaidaili-${j}页面成功`);
              await Promise.all(
                $('.table-striped tr')
                  .map(async (i, j) => {
                    if (i == 0) return;
                    var tem = $(j).find('td');
                    var proxy = new Proxy(tem.eq(0).text(), tem.eq(1).text(), tem.eq(3).text());
                    if (await checkIp(proxy)) ipsArr.add(proxy);
                  })
                  .get()
              );
              return 'kuaidaili的测试';
            })
          );
          console.log(test3);
          break;
        case 'superfastip':
          let test4 = await Promise.all(
            [1, 2].map(async (j) => {
              var requestUrl = i + j;
              var options = {
                headers: {
                  Referer: 'http://www.superfastip.com/welcome/freeip/',
                  Host: 'www.superfastip.com'
                }
              };
              var $ = await getElements(requestUrl, options, localGet);
              await sleep(500);
              if ($ == '') {
                logger.error(`访问superfastip-${j}失败`);
                return '';
              }
              logger.info(`访问superfastip-${j}页面成功`);
              await Promise.all(
                $('.table')
                  .eq(1)
                  .find('tr')
                  .map(async (i, j) => {
                    if (i == 0) return;
                    var tem = $(j).find('td');
                    var proxy = new Proxy(tem.eq(0).text(), tem.eq(1).text(), tem.eq(3).text());
                    if (await checkIp(proxy)) ipsArr.add(proxy);
                  })
                  .get()
              );
              return 'superfastip的测试';
            })
          );
          console.log(test4);
          break;
        default:
          break;
      }
      return '最外面的大循环的测试';
    })
  );
  console.log(test1);
  var arr = Array.from(ipsArr);
  return arr;
}

// (async (i) => {
//   try {
//     var j = await getIpPool();
//   } catch (i) {
//     console.log(i);
//   }
//   logger.info(j);
//   // console.log(process._getActiveHandles());
//   // console.log(process._getActiveRequests());
//   // setTimeout(function() {
//   //   runner(); // logs out active handles that are keeping node running
//   // }, 100);
// })().catch((i) => console.log(i));

module.exports = getIpPool;
