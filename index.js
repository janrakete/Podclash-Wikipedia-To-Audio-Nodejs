const express = require('express');
const bodyParser = require('body-parser');
const appConfig = require('./config');

var app = express();
app.use(
  bodyParser.urlencoded({
    limit: '40mb',
    extended: false,
  })
);
app.use(bodyParser.json());
app.use(express.static('static'));

const routes = require('./routes/podclash');
app.use('/', routes);

app.listen(process.env.PORT, function () {
  console.log('Server listening on port ' + process.env.PORT);
});
