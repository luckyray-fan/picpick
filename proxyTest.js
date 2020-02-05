var Axios = require('axios');
var { get } = require('./src/get');
Axios.get('https://icanhazip.com/', {
  proxy: {
    host: '127.0.0.1',
    port: '5555', //错端口会 econnrefused
    type: 'test'
  }
})
  .then((i) => console.log(i.data))
  .catch((i) => console.log(i.message));
// get('https://danbooru.donmai.us/posts/3609292')
//   .then((i) => console.log(i.data))
//   .catch((i) => console.log(i.message));
