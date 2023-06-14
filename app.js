const createError = require('http-errors');
const express = require('express');
const router = express.Router();
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongodb = require("mongodb");
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');


const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
// Підключення до бази даних MongoDB
mongoose.connect('mongodb://localhost:27017/express', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log('Connected to MongoDB');
    })
    .catch((error) => {
      console.error('Error connecting to MongoDB:', error);
    });

// Створення моделі користувача
const User = mongoose.model('User', {
  first_name: String,
  second_name: String,
  email: String,
  password: String
},'Users');

// Middleware для обробки JSON даних
app.use(bodyParser.json());

// TODO  Обробник форми реєстрації
// Роутер для обробки реєстрації
app.post('/create', async (req, res) => {
  try {
    const { first_name,second_name,email,password } = req.body;

    // Перевірка, чи користувач з таким ім'ям вже існує
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).send('<script>alert("Даний E-mail уже зареєстрований в системі"); window.history.back();</script>');
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Створення нового користувача
    const newUser = new User({ first_name,second_name,email, password: hashedPassword });
    await newUser.save();
    return res.send('<script>alert("Реєстрація пройшла успішно"); window.location.href = "/";</script>');

  } catch (error) {
    console.error('Error during registration:', error);
    return res.send('<script>alert("Виникла помилка під час реєстрації"); window.history.back();</script>');
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
module.exports = app;
