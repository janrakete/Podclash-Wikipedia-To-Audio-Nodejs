const dotenv = require('dotenv');
dotenv.config();

const appConfig = {
  PORT: process.env.PORT || 3000,
};

module.exports = appConfig;