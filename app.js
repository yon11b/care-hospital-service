require('dotenv').config();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
var logger = require('morgan');
const ejs = require('ejs');
const cors = require('cors');
const session = require('express-session');
const history = require('connect-history-api-fallback');
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);
const config = require('./config/config.json')[process.env.NODE_ENV || 'development'];
const viewPath = config.path;
var app = express();
const corsOptions = {
  origin: true,
  credentials: true,
};
app.use(cors(corsOptions));
app.engine('html', ejs.renderFile);
app.set('view engine', 'html');

app.use(logger(app.get('env') === 'development' ? 'dev' : 'default'));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use(cookieParser());

if (process.env.NODE_ENV === 'production') {
  app.use('/', express.static(path.join(__dirname, viewPath.index)));
} else {
  app.use('/', express.static(path.join(__dirname, viewPath.index)));
}

app.use('/', express.static(path.join(__dirname, config.path.upload_path)));

const pgPool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.username,
  password: config.db.password, // 문자열로
  database: config.db.database,
  ssl: { rejectUnauthorized: false }, // 필요 시
});

const sessionStore = new pgSession({
  pool: pgPool, // 직접 pool 전달
  tableName: 'session',
});
app.use(compression());
app.use(
  session({
    secret: 'yoyang2',
    proxy: true,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3 * 60 * 60 * 1000,
    },
  }),
);

app.use('/', require('./routes'));
app.use(history());

if (process.env.proxy == 'false') {
  app.use('/', express.static(path.join(__dirname, viewPath.index)));
}

if (process.env.proxy == 'true') {
  app.use('/', proxy('localhost:8001'));
}

//DB Sync

// const sequelize = require('sequelize');
// const models = require('./models');
// models.sequelize.sync();

//error handling

// / catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      result: false,
      message: err.message,
      error: err,
    });
  });
} else {
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.send({
      message: err.message,
      error: {},
      title: 'error',
    });
  });
}
module.exports = app;