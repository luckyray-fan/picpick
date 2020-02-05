var { get } = require('./get');
var Axios = require('axios');
const logger = require('./log');
var Cheerio = require('cheerio');

/**
 * ascii2d 搜索
 *
 * 色合検索: 宽高相同, 仅在图片没有更改过有效, twitter等优先
 * 特徴検索: 裁剪甚至旋转都能找到, 但这方面有点不如tineye, pixiv优先
 * @param {string} url 图片地址
 * @returns 色合検索 和 特徴検索 结果
 */
async function asciiResult(url, fileName) {
  let { colorHTML } = await Axios.get(`https://ascii2d.net/search/url/${encodeURIComponent(url)}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36'
    },
    timeout: 20000
  })
    .then((r) => ({
      colorURL: r.request.res.responseUrl,
      colorHTML: r.data
    }))
    .catch((i) => {
      errInfo = i.response ? i.response.statusText : i.message;
      logger.error(`${url}访问ascii2d发生了  + ${errInfo}`);
      return {};
    });
  if (typeof colorHTML !== 'string') {
    return {
      color: {}
    };
  }
  logger.info(`文件${fileName} 解析ascii2d网页成功 -色合検索 `);
  // let bovwURL = colorURL.replace('/color/', '/bovw/');
  // let bovwHTML = await get(bovwURL)
  //   .then((r) => r.data)
  //   .catch((i) => logger.error(i));
  // logger.info(`文件${fileName} 解析ascii2d网页成功 -特徴検索 `);
  return {
    color: getDetail(colorHTML)
  }; //color找到twitter,bovw找到pixiv
}

/**
 * 解析 ascii2d 网页结果
 *
 * @param {string} html ascii2d HTML
 * @returns 画像搜索结果
 */
function getDetail(html) {
  const $ = Cheerio.load(html, {
    decodeEntities: false
  });
  const $itembox = $('.item-box');
  for (let i = 0; i < $itembox.length; i++) {
    const $box = $($itembox[i]);
    const $link = $box.find('.detail-box a');
    if ($link.length === 0) continue;
    const $title = $($link[0]);
    return $title.attr('href');
  }
  return {};
}

module.exports = { asciiResult };
