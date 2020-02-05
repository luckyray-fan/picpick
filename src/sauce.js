var { get } = require('./get');
const logger = require('./log');
var Axios = require('axios');
var getIpPool = require('./proxyPool');
var config = require('../config');
var timeCount = 0,
  pools = '',
  currentProxy;

const errRes = { similarity: 0 };
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
var errArr = {};
async function getSearchResult(imgURL, localGet, retryNum = 3) {
  if (retryNum >= 0) {
    if (errArr[imgURL] === undefined) {
      errArr[imgURL] = [];
    }
    return await localGet(`https://saucenao.com/search.php`, {
      params: {
        db: 999,
        output_type: 2,
        numres: 3,
        url: imgURL,
        api_key: config.sauce.api_key
      }
    }).catch(async (i) => {
      errArr[imgURL].push(i.message);
      retryNum -= 1;
      return await getSearchResult(imgURL, getProxy(imgURL), retryNum);
    });
  } else {
    let tem = [].concat(errArr[imgURL]);
    return `访问${imgURL},重试了三次也没有成功, 失败原因为${tem}`;
  }
}
/**
 * @returns get 返回代理
 */
function getProxy(imgURL) {
  if (pools.length <= 0) return get;
  if (timeCount === pools.length) {
    timeCount = 0;
    logger.info(`使用一开始的Ip在sauce查询 ${imgURL}`);
    currentProxy = '一开始的IP';
    localGet = get;
  } else {
    currentProxy = pools[timeCount].host;
    logger.info(`切换代理Ip为 ${currentProxy} 在sauce查询 ${imgURL}`);
  }
  let temGet = Axios.create({
    proxy: pools[timeCount], //改变使用代理的方式为Axios自带
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36'
    },
    timeout: 20000
  }).get;
  timeCount += 1;
  return temGet;
}
async function waitIpPool() {
  logger.info('正在获取代理Ip');
  pools = await getIpPool();
  pools.push(...config.proxy.http); //自己的阿里云上的 tinyproxy
  console.log(pools);
  logger.info(`已获得代理Ip${pools.length}个`);
}
async function sauceResult(imgURL) {
  var localGet = getProxy(imgURL);

  let warnMsg = '';
  return await getSearchResult(imgURL, localGet)
    .then((ret) => {
      if (typeof ret.data !== 'object') {
        errRes.code = ret ? ret : `sauce没有返回信息`;
        return errRes;
      }
      let data = ret.data;
      //确保回应正确
      if (data.results && data.results.length > 0) {
        let {
          header: {
            short_remaining, //短时剩余
            long_remaining, //长时剩余
            similarity //相似度
          },
          data: { ext_urls }
        } = data.results[0];
        /**
         * 结果链接
         * @type {string}
         */
        let source = '';

        //剩余搜图次数
        if (long_remaining < 20) warnMsg += `注意，24h内搜图次数仅剩${long_remaining}次\n`;
        else if (short_remaining < 5) warnMsg += `注意，30s内搜图次数仅剩${short_remaining}次\n`;
        if (warnMsg) logger.warn(warnMsg);

        if (ext_urls) {
          source = ext_urls[0];
          //如果结果有多个，优先取danbooru
          for (let i = 1; i < ext_urls.length; i++) {
            if (ext_urls[i].indexOf('danbooru') !== -1) source = ext_urls[i];
          }
          source = source.replace('http://', 'https://');
        }

        return { similarity, source };
      } else {
        logger.error(data);
        errRes.code = data;

        return errRes;
      }
    })
    .catch((e) => {
      if (e.response) {
        //如果有response就是对方出的问题, 没有就是自己这边出的问题
        if (e.response.status == 429) {
          errRes.code = '429 访问过于频繁';
        } else {
          errRes.code = e.response.data;
          logger.error(`使用代理${currentProxy}saucenao发生了${e.response.data}`);
        }
      } else {
        errRes.code = e.message;
        logger.error(`使用代理${currentProxy}saucenao发生了${e.message}`);
      }
      return errRes;
    });
}
module.exports = { sauceResult, waitIpPool };
