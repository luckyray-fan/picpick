var Axios = require('axios');
var { get, getImg } = require('./src/get');
// Axios.get('https://icanhazip.com/', {
//   proxy: {
//     host: '127.0.0.1',
//     port: '5555', //错端口会 econnrefused
//     type: 'test'
//   }
// })
//   .then((i) => console.log(i.data))
//   .catch((i) => console.log(i.message));
// get('https://danbooru.donmai.us/posts/3609292')
//   .then((i) => console.log(i.data))
//   .catch((i) => console.log(i.message));
getImg(
  'https://danbooru.donmai.us/data/__minato_aqua_and_wooper_pokemon_and_1_more_drawn_by_coria__d2aa721596cfb285076c8a7ca028eef3.jpg'
)
  .then((i) => console.log(i))
  .catch(console.log);
